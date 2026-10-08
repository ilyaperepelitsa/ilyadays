/** Run the template in small calls: themes, then routes, then facts, then pictures. */

import { TripShapeError } from "./brief.mjs";
import { notesCall, outlineCall, themeCall } from "./prompts.mjs";
import { parseNotes, parseOutline, parseThemes } from "./parse.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {import("./types").TripBrief} brief
 * @param {(call: import("./types").LlmCall) => Promise<unknown>} client
 */
export async function suggestThemes(brief, client) {
  return parseThemes(await client(themeCall(brief)), brief.routes);
}

/**
 * @param {object} input
 * @param {import("./types").TripBrief} input.brief
 * @param {import("./types").Theme[]} input.themes
 * @param {(call: import("./types").LlmCall) => Promise<unknown>} input.client
 * @param {(stop: import("./types").DraftStop, facts: import("./types").PlaceFacts, city: string) => Promise<import("./types").TripPlace>} input.enrich
 * @param {string} input.id
 * @param {string} input.created
 * @param {(event: { stage: string, done: number, total: number }) => void} [input.onProgress]
 * @param {number} [input.pauseMs]
 * @param {(ms: number) => Promise<void>} [input.wait]
 */
export async function buildTrip(input) {
  const { brief, themes, client, enrich, id, created } = input;
  const pauseMs = input.pauseMs ?? 200;
  const pause = input.wait ?? wait;
  if (themes.length !== brief.routes) throw new TripShapeError("themes");
  input.onProgress?.({ stage: "routes", done: 0, total: 1 });
  const outline = parseOutline(await client(outlineCall(brief, themes)), brief);
  /** @type {Map<string, import("./types").PlaceFacts>} */
  const facts = new Map();
  for (let i = 0; i < outline.routes.length; i += 1) {
    input.onProgress?.({ stage: "notes", done: i, total: outline.routes.length });
    const routeFacts = parseNotes(await client(notesCall(brief, outline.routes[i])), outline.routes[i]);
    for (const [stopId, row] of routeFacts) if (!facts.has(stopId)) facts.set(stopId, row);
  }
  /** @type {Map<string, import("./types").TripPlace>} */
  const places = new Map();
  const unique = [...facts.keys()];
  for (let i = 0; i < unique.length; i += 1) {
    input.onProgress?.({ stage: "pictures", done: i, total: unique.length });
    const stopId = unique[i];
    const stop = outline.routes.flat().find((item) => item.id === stopId);
    if (!stop) continue;
    places.set(stopId, await enrich(stop, facts.get(stopId), brief.city));
    if (pauseMs) await pause(pauseMs);
  }
  return {
    id,
    created,
    city: brief.city,
    brief,
    spine: outline.spine,
    routes: outline.routes.map((stops, index) => ({
      theme: themes[index],
      stops: stops.map((stop) => places.get(stop.id)).filter((place) => place != null),
    })),
  };
}
