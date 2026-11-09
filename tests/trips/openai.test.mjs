import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { completeJson } from "../../src/lib/trips/openai.mjs";

const call = { name: "trip_themes", developer: "Be exact.", user: "{\"city\":\"Lisbon\"}", schema: { type: "object" } };

/**
 * @param {unknown} payload
 * @param {number} [status]
 */
function stub(payload, status = 200) {
  const seen = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), init });
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
  };
  return {
    seen,
    restore() { globalThis.fetch = previous; },
  };
}

describe("responses API", { concurrency: false }, () => {
test("a structured call sends the schema and reads only the answer text", async () => {
  const fake = stub({
    output: [
      { type: "reasoning", content: [{ type: "output_text", text: "{\"no\":true}" }] },
      { type: "message", content: [{ type: "output_text", text: "{\"city\":" }, { type: "output_text", text: "\"Lisbon\"}" }] },
    ],
  });
  try {
    const parsed = await completeJson("sk-test", "gpt-6.1-sol", "medium", call);
    assert.deepEqual(parsed, { city: "Lisbon" });
    const body = JSON.parse(fake.seen[0].init.body);
    assert.equal(fake.seen[0].url, "https://api.openai.com/v1/responses");
    assert.equal(fake.seen[0].init.headers.Authorization, "Bearer sk-test");
    assert.equal(body.model, "gpt-6.1-sol");
    assert.equal(body.reasoning.effort, "medium");
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.name, "trip_themes");
    assert.equal(body.input[0].content, "Be exact.");
    assert.equal(JSON.stringify(body).includes("sk-test"), false);
    assert.ok(fake.seen[0].init.signal instanceof AbortSignal);
  } finally {
    fake.restore();
  }
});

test("an API error and an empty answer both throw", async () => {
  const denied = stub({ error: { message: "bad key" } }, 401);
  try {
    await assert.rejects(() => completeJson("sk-test", "gpt-6.1-sol", "low", call), /bad key/);
  } finally {
    denied.restore();
  }
  const empty = stub({ output: [{ type: "message", content: [{ type: "refusal", text: "no" }] }] });
  try {
    await assert.rejects(() => completeJson("sk-test", "gpt-6.1-sol", "low", call), /empty/);
  } finally {
    empty.restore();
  }
});

test("a busy API is tried once more; a spent quota and a bad key are not", async () => {
  const previous = globalThis.fetch;
  const statuses = [503, 200];
  let calls = 0;
  globalThis.fetch = async () => {
    const status = statuses[calls++];
    const payload = status === 200
      ? { output: [{ type: "message", content: [{ type: "output_text", text: "{\"ok\":true}" }] }] }
      : { error: { message: "busy" } };
    return { ok: status === 200, status, headers: { get: () => "2" }, json: async () => payload };
  };
  const waits = [];
  try {
    const parsed = await completeJson("sk-test", "gpt-6.1-sol", "low", call, { wait: async (ms) => { waits.push(ms); } });
    assert.deepEqual(parsed, { ok: true });
    assert.equal(calls, 2);
    assert.deepEqual(waits, [2000]);
    calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return { ok: false, status: 429, json: async () => ({ error: { message: "quota", code: "insufficient_quota" } }) };
    };
    await assert.rejects(() => completeJson("sk-test", "gpt-6.1-sol", "low", call, { wait: async () => {} }), /quota/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous;
  }
});

test("a timeout, a dropped connection and a cut-off answer each get their own code", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); };
    await assert.rejects(() => completeJson("sk-test", "m", "xhigh", call), (error) => error.code === "timeout");
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; throw new TypeError("fetch failed"); };
    await assert.rejects(() => completeJson("sk-test", "m", "low", call, { wait: async () => {} }), (error) => error.code === "network");
    assert.equal(calls, 2);
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ status: "incomplete", output: [] }) });
    await assert.rejects(() => completeJson("sk-test", "m", "low", call), (error) => error.code === "incomplete");
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: "{\"cut" }] }] }),
    });
    await assert.rejects(() => completeJson("sk-test", "m", "low", call), (error) => error.code === "incomplete");
    globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError("html"); } });
    await assert.rejects(() => completeJson("sk-test", "m", "low", call, { attempts: 1 }), /HTTP 502/);
  } finally {
    globalThis.fetch = previous;
  }
});
});

test('event discovery forces live search and only keeps URLs the tool actually consulted', async () => {
  const fake = stub({ output: [
    { type: 'web_search_call', action: { sources: [{ url: 'https://publisher.example/event' }] } },
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ urls: ['https://publisher.example/event', 'https://invented.example/fake'] }), annotations: [] }] },
  ] });
  try {
    assert.deepEqual(await completeJson('test-key', 'gpt-6.1-sol', 'low', { ...call, webSearch: true }), { urls: ['https://publisher.example/event'] });
    const body = JSON.parse(fake.seen[0].init.body);
    assert.deepEqual(body.tools, [{ type: 'web_search' }]);
    assert.equal(body.tool_choice, 'required');
    assert.deepEqual(body.include, ['web_search_call.action.sources']);
  } finally { fake.restore(); }
});
