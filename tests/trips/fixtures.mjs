/** Shared trip fixtures. Each outline() call is a fresh object. */

export const brief = {
  city: "Lisbon",
  routes: 2,
  hours: 8,
  placesPerRoute: 2,
  foodBreaks: 1,
  pace: "linger",
  sharedSpine: true,
  preferences: "",
  wishes: [],
};

/**
 * @param {string} id
 * @param {"sight" | "food"} kind
 * @param {number} lat
 */
export function stop(id, kind, lat) {
  return {
    id,
    name: id,
    local: "",
    lat,
    lon: -9.14,
    minutes: 40,
    kind,
    why: "Because it belongs on the walk.",
    whyRu: "Потому что оно на этом пути.",
    wish: "",
  };
}

export function outline() {
  return {
    spine: { name: "The ferry", why: "Both days cross the river.", whyRu: "Оба дня переходят реку." },
    routes: [
      { stops: [stop("castle", "sight", 38.71), stop("ferry", "sight", 38.7), stop("lunch", "food", 38.72)] },
      { stops: [stop("ferry", "sight", 38.7), stop("belem", "sight", 38.69), stop("cafe", "food", 38.695)] },
    ],
  };
}

/**
 * @param {string} id
 * @param {"sight" | "food"} kind
 */
export function facts(id, kind) {
  const notes = kind === "sight"
    ? [
      { kind: "build", en: "Old stone.", ru: "Старый камень." },
      { kind: "keeps", en: "The door.", ru: "Дверь." },
    ]
    : [{ kind: "keeps", en: "Eat here.", ru: "Ешьте здесь." }];
  return {
    id,
    accessEn: "Yes.",
    accessRu: "Да.",
    daysEn: "Daily.",
    daysRu: "Ежедневно.",
    hours: `${id} hours`,
    wikiTitle: id,
    spotSearch: kind === "sight" ? `${id} door` : "",
    notes,
  };
}
