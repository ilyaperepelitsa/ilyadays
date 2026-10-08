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
});
