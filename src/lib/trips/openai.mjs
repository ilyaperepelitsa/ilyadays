/** One structured call to the OpenAI responses API. The key is the caller's. */

import { TripShapeError } from "./brief.mjs";

/** Higher effort thinks longer before answering; give it room instead of cutting it off at a fixed minute and a half. */
const TIMEOUT_MS = { low: 60000, medium: 120000, high: 240000, xhigh: 360000 };
/** Busy or briefly unavailable: worth one more try. A bad key, a bad model name or a spent quota is not. */
const RETRY_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {{ headers?: { get?: (name: string) => string | null } }} res
 * @param {number} attempt
 */
function backoff(res, attempt) {
  const header = Number(res.headers?.get?.("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header, 20) * 1000;
  return 1500 * attempt;
}

/**
 * @param {Record<string, any> | null} data
 */
function answerText(data) {
  let text = "";
  for (const item of data?.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) if (part.type === "output_text") text += part.text;
  }
  return text;
}

/**
 * @param {string} key
 * @param {string} model
 * @param {string} effort
 * @param {import("./types").LlmCall} call
 * @param {{ attempts?: number, wait?: (ms: number) => Promise<void> }} [options]
 */
export async function completeJson(key, model, effort, call, options = {}) {
  const attempts = Math.max(1, options.attempts ?? 2);
  const wait = options.wait ?? sleep;
  const body = JSON.stringify({
    model,
    reasoning: { effort },
    input: [
      { role: "developer", content: call.developer },
      { role: "user", content: call.user },
    ],
    ...(call.webSearch ? { tools: [{ type: "web_search" }], tool_choice: "required", include: ["web_search_call.action.sources"] } : {}),
    text: { format: { type: "json_schema", name: call.name, strict: true, schema: call.schema } },
  });
  for (let attempt = 1; ; attempt += 1) {
    let res;
    try {
      res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS[/** @type {keyof typeof TIMEOUT_MS} */ (effort)] ?? TIMEOUT_MS.medium),
      });
    } catch (error) {
      // A timeout already waited the whole budget; another try would only double it.
      if (error instanceof Error && error.name === "TimeoutError") throw new TripShapeError("timeout");
      if (attempt < attempts) {
        await wait(1500 * attempt);
        continue;
      }
      throw new TripShapeError("network");
    }
    /** @type {Record<string, any> | null} */
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const quota = data?.error?.code === "insufficient_quota";
      if (RETRY_STATUS.has(res.status) && !quota && attempt < attempts) {
        await wait(backoff(res, attempt));
        continue;
      }
      throw new Error(data?.error?.message || `HTTP ${res.status}`);
    }
    const text = answerText(data);
    if (!text && data?.status === "incomplete") throw new TripShapeError("incomplete");
    if (!text) throw new Error("empty");
    try {
      const parsed = JSON.parse(text);
      if (!call.webSearch) return parsed;
      const consulted = new Set();
      for (const item of data?.output || []) {
        if (item.type === "web_search_call") for (const source of item.action?.sources || []) if (typeof source.url === "string") consulted.add(source.url.split("#")[0]);
        if (item.type === "message") for (const part of item.content || []) for (const source of part.annotations || []) if (source.type === "url_citation" && typeof source.url === "string") consulted.add(source.url.split("#")[0]);
      }
      return { urls: Array.isArray(parsed?.urls) ? parsed.urls.filter((url) => typeof url === "string" && consulted.has(url.split("#")[0])).slice(0, 8) : [] };
    } catch {
      throw new TripShapeError("incomplete");
    }
  }
}
