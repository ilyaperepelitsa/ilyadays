/** One structured call to the OpenAI responses API. The key is the caller's. */

/**
 * @param {string} key
 * @param {string} model
 * @param {string} effort
 * @param {import("./types").LlmCall} call
 */
export async function completeJson(key, model, effort, call) {
  const body = {
    model,
    reasoning: { effort },
    input: [
      { role: "developer", content: call.developer },
      { role: "user", content: call.user },
    ],
    text: { format: { type: "json_schema", name: call.name, strict: true, schema: call.schema } },
  };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  let text = "";
  for (const item of data.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) if (part.type === "output_text") text += part.text;
  }
  if (!text) throw new Error("empty");
  return JSON.parse(text);
}
