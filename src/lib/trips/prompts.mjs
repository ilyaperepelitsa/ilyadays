/** Model calls for a trip. Each call returns one JSON object; none of them invent image URLs. */

const str = { type: "string" };

/**
 * @param {Record<string, unknown>} properties
 * @param {string[]} required
 */
function obj(properties, required) {
  return { type: "object", additionalProperties: false, required, properties };
}

/**
 * @param {import("./types").TripBrief} brief
 */
function paceLine(brief) {
  if (brief.pace === "linger") {
    return "Pace is linger: a sight is 45–90 minutes. Prefer one room done slowly over a checklist. Each sight names one thing to stand in front of.";
  }
  return "Pace is rapid: a sight is 20–40 minutes. Still name one thing to look at, without planning a deep visit.";
}

/**
 * @param {import("./types").TripBrief} brief
 */
function spineLine(brief) {
  if (brief.sharedSpine) {
    return "sharedSpine is true. Choose one real place — a gate, a ferry, a market, a square — and put that same stop on at least two routes. Name it in spine.";
  }
  return "sharedSpine is false. Every stop id belongs to one route only. spine.name, spine.why and spine.whyRu are empty strings.";
}

/**
 * @param {import("./types").TripBrief} brief
 */
function tasteLine(brief) {
  const preferences = String(brief.preferences || "").trim();
  const wishes = Array.isArray(brief.wishes) ? brief.wishes : [];
  const mood = preferences
    ? `Preferences: ${preferences}. Let this shape the food, the shops, and the mood. A secret bar is a real small bar. Modern local food and traditional local food are different meals.`
    : "No extra food or shop preferences were given.";
  const along = wishes.length
    ? `Wishes, not tied to a day: ${wishes.join("; ")}. Put each wish on exactly one route, whichever walk actually passes that kind of place. Copy the wish text into that stop's wish field. Every other stop has an empty wish. A wish uses one of the counted stops, not an extra one. A bar, café, tea shop or meal is a food stop when that route still has a food slot. Otherwise it is a short sight. A store, workshop or monument is a sight.`
    : "There are no wishes. Every stop's wish field is an empty string.";
  return `${mood} ${along}`;
}

/**
 * @param {import("./types").TripBrief} brief
 */
export function themeCall(brief) {
  const developer = [
    "You name walking routes for one city. Return exactly the number of themes you are asked for.",
    "Each theme is one day on foot.",
    "The title is two to five words and is not just the city name. Titles differ from each other.",
    "The description is two or three sentences: the streets, the kind of places, and what a walker should notice. It is not a list of stops.",
    "Do not invent a festival, a museum, or a custom you are not sure exists.",
    "Write English and Russian. The Russian is the same theme, not a new one.",
    paceLine(brief),
    spineLine(brief),
    tasteLine(brief),
  ].join(" ");
  const schema = obj(
    {
      themes: {
        type: "array",
        minItems: brief.routes,
        maxItems: brief.routes,
        items: obj(
          { title: str, description: str, titleRu: str, descriptionRu: str },
          ["title", "description", "titleRu", "descriptionRu"],
        ),
      },
    },
    ["themes"],
  );
  return {
    name: "trip_themes",
    developer,
    user: JSON.stringify({
      city: brief.city,
      routes: brief.routes,
      hours: brief.hours,
      placesPerRoute: brief.placesPerRoute,
      foodBreaks: brief.foodBreaks,
      pace: brief.pace,
      sharedSpine: brief.sharedSpine,
      preferences: brief.preferences || "",
      wishes: brief.wishes || [],
    }),
    schema,
  };
}

/**
 * @param {import("./types").TripBrief} brief
 * @param {import("./types").Theme[]} themes
 */
export function outlineCall(brief, themes) {
  const developer = [
    `Plan ${brief.routes} walking routes in ${brief.city}.`,
    `Each route has exactly ${brief.placesPerRoute} sights and exactly ${brief.foodBreaks} food stops, in walking order.`,
    "Return the routes in the same order as the themes. Do not rename the themes.",
    "A sight is a real place a visitor can find. A food stop is a real café, market or simple local restaurant on that walk, not a chain.",
    "Put meals between sights when there is more than one sight, not piled at the end.",
    "Each stop has its own lat and lon in decimal degrees. Two stops on one route do not share a coordinate.",
    "minutes is the time spent at the stop, not the walk to it.",
    paceLine(brief),
    `The day is ${brief.hours} hours including walking, so the sum of minutes on a route is at most ${brief.hours * 60}.`,
    spineLine(brief),
    tasteLine(brief),
    "why and whyRu are one sentence each: why this stop is on this route.",
    "local is the name in the city's own language, or an empty string.",
    "id is a short ascii slug.",
  ].join(" ");
  const stop = obj(
    {
      id: str,
      name: str,
      local: str,
      lat: { type: "number" },
      lon: { type: "number" },
      minutes: { type: "integer" },
      kind: { type: "string", enum: ["sight", "food"] },
      why: str,
      whyRu: str,
      wish: str,
    },
    ["id", "name", "local", "lat", "lon", "minutes", "kind", "why", "whyRu", "wish"],
  );
  const schema = obj(
    {
      spine: obj({ name: str, why: str, whyRu: str }, ["name", "why", "whyRu"]),
      routes: {
        type: "array",
        minItems: brief.routes,
        maxItems: brief.routes,
        items: obj(
          {
            stops: {
              type: "array",
              minItems: brief.placesPerRoute + brief.foodBreaks,
              maxItems: brief.placesPerRoute + brief.foodBreaks,
              items: stop,
            },
          },
          ["stops"],
        ),
      },
    },
    ["spine", "routes"],
  );
  return {
    name: "trip_outline",
    developer,
    user: JSON.stringify({
      city: brief.city,
      themes: themes.map((theme) => ({ title: theme.title, description: theme.description })),
      preferences: brief.preferences || "",
      wishes: brief.wishes || [],
    }),
    schema,
  };
}

/**
 * @param {import("./types").TripBrief} brief
 * @param {import("./types").DraftStop[]} stops
 */
export function notesCall(brief, stops) {
  const developer = [
    `You write visitor facts for stops in ${brief.city}.`,
    "Use only the ids you are given, once each.",
    "access says whether a visitor can go in. days says the usual pattern. hours is a short sentence, not a promise.",
    "If you are not sure a monument is open, say to ask that day.",
    "A sight needs at least two facts, and one of them is keeps. A meal needs one.",
    "Kinds: build (how it was made), events (what happened there), literature (a real book), film (a real film), keeps (what to go and look at).",
    "Do not invent a book, a film, or a closure. If you have no book or film, use build and keeps.",
    "For a sight, one keeps fact names a specific thing to locate — a column, a tomb, a mosaic, a doorway — and spotSearch is a short Commons search for a photograph of that thing, including the city.",
    "If there is nothing particular to find, spotSearch is an empty string. A meal always has an empty spotSearch.",
    "wikiTitle is the English Wikipedia article title, or empty if you are not sure of the exact title.",
    "If a stop has a wish, the keeps fact is the thing the walker asked to pass through.",
    "Do not write image URLs. Write English and Russian for every sentence.",
  ].join(" ");
  const note = obj(
    { kind: { type: "string", enum: ["build", "events", "literature", "film", "keeps"] }, en: str, ru: str },
    ["kind", "en", "ru"],
  );
  const place = obj(
    {
      id: str,
      accessEn: str,
      accessRu: str,
      daysEn: str,
      daysRu: str,
      hours: str,
      wikiTitle: str,
      spotSearch: str,
      notes: { type: "array", minItems: 1, maxItems: 4, items: note },
    },
    ["id", "accessEn", "accessRu", "daysEn", "daysRu", "hours", "wikiTitle", "spotSearch", "notes"],
  );
  return {
    name: "trip_notes",
    developer,
    user: JSON.stringify({
      city: brief.city,
      stops: stops.map((stop) => ({ id: stop.id, name: stop.name, kind: stop.kind, why: stop.why, wish: stop.wish || "" })),
    }),
    schema: obj({ places: { type: "array", minItems: stops.length, maxItems: stops.length, items: place } }, ["places"]),
  };
}
