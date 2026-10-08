/** In-memory localStorage and window events for the trip store. */

const bag = new Map();
const listeners = new Map();
let generation = 0;

globalThis.localStorage = {
  getItem(key) {
    if (bag.get("__throwRead")) throw new Error("denied");
    return bag.has(key) ? bag.get(key) : null;
  },
  setItem(key, value) {
    if (bag.get("__throwWrite")) throw new Error("denied");
    bag.set(key, String(value));
  },
  removeItem(key) {
    bag.delete(key);
  },
};

globalThis.window = {
  addEventListener(name, fn) {
    const list = listeners.get(name) || [];
    list.push(fn);
    listeners.set(name, list);
  },
  removeEventListener(name, fn) {
    listeners.set(name, (listeners.get(name) || []).filter((item) => item !== fn));
  },
  dispatchEvent(event) {
    for (const fn of [...(listeners.get(event.type) || [])]) fn();
    return true;
  },
};

/** Force the store cache to miss on the next read. */
export function resetStorage() {
  bag.clear();
  listeners.clear();
  generation += 1;
  bag.set("ilyadays-trips-v1", `reset-${generation}`);
}

export function denyReads() {
  bag.set("__throwRead", "1");
}

export function denyWrites() {
  bag.set("__throwWrite", "1");
}
