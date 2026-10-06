// Portions and units for recipe pages: rewrites the quantity spans that src/quantities.py marks up.
// One file for both sites — recipes/static (loaded as a module by app.js) and ilyadays.com (copied by `npm run sync`
// to src/lib/units.js, typed by units.d.ts) — so both scale and convert exactly the same way.
//
//   <span class="q" data-k="vol" data-u="tbsp" data-a="1" data-b="2">1–2 tbsp</span>
//   k: mass | vol | count | temp | len    u: source unit    a, b: number or range    s="0": never scales
//   x="1": a size "a × b"    alt="1": the bracketed alternative after another amount    f: noun forms    n: digits
//
// Metric at ×1 shows the original wording. Spoons and cups are kitchen units in both systems.

const G = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
const ML = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 240, floz: 29.5735 };
const IMPERIAL = new Set(["tsp", "tbsp", "cup", "floz", "oz", "lb"]);
const family = (u) => ({ l: "ml", kg: "g", lb: "oz", qt: "cup" })[u] || u;
const FRACS = [[0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"], [5 / 8, "⅝"],
  [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"]];

const NAMES = {
  en: { g: "g", kg: "kg", ml: "ml", l: "l", tsp: "tsp", tbsp: "tbsp", cup: ["cup", "cups"], oz: "oz", lb: "lb",
    floz: "fl oz", qt: "qt", F: "°F", in: "in" },
  ru: { g: "г", kg: "кг", ml: "мл", l: "л", tsp: "ч. л.", tbsp: "ст. л.", cup: ["стакан", "стакана", "стаканов"],
    oz: "унц.", lb: "фунт.", floz: "жидк. унц.", qt: "кварт.", F: "°F", in: "дюйм." },
};

/** Index of the noun form for a number: English [one, many]; Russian [1, 2–4, 5+, fractions (if not as 2–4)]. */
export function plural(n, forms) {
  if (forms.length === 2) return n > 0 && n <= 1 ? 0 : 1;
  if (Math.abs(n - Math.round(n)) > 1e-9) return forms.length > 3 ? 3 : 1;
  const k = Math.round(n) % 100;
  if (k % 10 === 1 && k !== 11) return 0;
  if (k % 10 >= 2 && k % 10 <= 4 && (k < 12 || k > 14)) return 1;
  return 2;
}

/** Nearest multiple of `step` (never rounds a positive amount down to 0). */
export function roundTo(x, step) {
  const r = Math.round(x / step + 1e-9) * step;
  return x > 0 && r < step / 2 ? step : r;
}

/** 1.5 → "1½", 0.25 → "¼": a number that's already on a kitchen fraction. */
export function frac(x) {
  const whole = Math.floor(x + 1e-6);
  const rest = x - whole;
  let best = FRACS[0];
  for (const f of FRACS) if (Math.abs(f[0] - rest) < Math.abs(best[0] - rest)) best = f;
  if (Math.abs(1 - rest) < Math.abs(best[0] - rest)) return String(whole + 1);
  return whole === 0 && best[1] ? best[1] : `${whole}${best[1]}`;
}

/** Decimal for metric amounts: "1.5" / "1,5". */
export function dec(x, lang) {
  const s = String(Math.round(x * 100) / 100);
  return lang === "ru" ? s.replace(".", ",") : s;
}

/** Cups on the fractions people measure with: ¼ ⅓ ½ ⅔ ¾. */
function cupRound(c) {
  const whole = Math.floor(c);
  let best = 0;
  for (const f of [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1]) if (Math.abs(whole + f - c) < Math.abs(whole + best - c)) best = f;
  const r = whole + best;
  return r === 0 ? 1 / 4 : r;
}

// A plan says which unit to show a value in and how to round it. Chosen from the larger end of a range.
function volPlan(ml, us, fromCup) {
  if (ml < 14.5) return { unit: "tsp", per: 5, round: (v) => roundTo(v, v < 0.5 ? 1 / 8 : 1 / 4), frac: true };
  if (ml < (us || fromCup ? 59 : 149)) return { unit: "tbsp", per: 15, round: (v) => roundTo(v, 1 / 2), frac: true };
  if (us || fromCup) {
    if (us && ml >= 1890) return { unit: "qt", per: 946.353, round: (v) => roundTo(v, 1 / 4), frac: true };
    return { unit: "cup", per: 240, round: cupRound, frac: true };
  }
  return mlPlan(ml);
}

function mlPlan(ml) {
  if (ml >= 1000) return { unit: "l", per: 1000, round: (v) => roundTo(v, 0.1), frac: false };
  return { unit: "ml", per: 1, round: (v) => roundTo(v, v < 10 ? 1 : 5), frac: false };
}

function gPlan(g) {
  if (g >= 1000) return { unit: "kg", per: 1000, round: (v) => roundTo(v, 0.05), frac: false };
  return { unit: "g", per: 1, round: (v) => roundTo(v, v < 5 ? 0.5 : v < 100 ? 1 : 5), frac: false };
}

function ozPlan(g) {
  const oz = g / G.oz;
  if (oz >= 16) return { unit: "lb", per: G.lb, round: (v) => roundTo(v, v < 10 ? 1 / 4 : 1 / 2), frac: true };
  return { unit: "oz", per: G.oz, round: (v) => roundTo(v, v < 1 ? 1 / 8 : v < 4 ? 1 / 4 : 1 / 2), frac: true };
}

function flozPlan() {
  return { unit: "floz", per: ML.floz, round: (v) => roundTo(v, v < 1 ? 1 / 4 : v < 8 ? 1 / 2 : 1), frac: true };
}

function inchPlan() {
  return { unit: "in", per: 2.54, round: (v) => roundTo(v, v < 1 ? 1 / 8 : v < 4 ? 1 / 4 : v < 12 ? 1 / 2 : 1), frac: true };
}

function unitName(unit, n, lang) {
  const name = (NAMES[lang] || NAMES.en)[unit];
  return Array.isArray(name) ? name[plural(n, name)] : name;
}

function joinRange(lo, hi, show) {
  return lo === null || show(lo) === show(hi) ? show(hi) : `${show(lo)}–${show(hi)}`;
}

/**
 * The text for one quantity. d: the span's data (k, u, a, b, x, s, f, n, alt as strings or numbers) plus `o`, its
 * original text. opts: { factor, units: "metric" | "us", lang: "en" | "ru" }.
 * Returns { text, unit } — unit is the shown unit (used to hide an alternative that would repeat it).
 */
export function formatQ(d, opts) {
  const lang = opts.lang === "ru" ? "ru" : "en";
  const us = opts.units === "us";
  const fixed = String(d.s) === "0";
  const f = fixed ? 1 : opts.factor;
  const a = Number(d.a);
  const b = d.b === undefined || d.b === null || d.b === "" ? null : Number(d.b);
  const size = String(d.x) === "1";
  const u = d.u;
  const same = Math.abs(f - 1) < 1e-9;

  if (d.k === "count") {
    if (same) return { text: d.o, unit: "" };
    const n = Number(d.n) || 0;
    const r = (v) => (v < 1 ? roundTo(v, 1 / 4) : v < 4 ? roundTo(v, 1 / 2) : Math.round(v));
    const hi = (b ?? a) * f;
    const lo = b === null ? null : a * f;
    const loR = lo === null ? null : r(lo);
    const hiR = r(hi);
    const approx = Math.abs(hiR - hi) > 0.01 * hi || (lo !== null && Math.abs(loR - lo) > 0.01 * lo);
    let rest = String(d.o).slice(n);
    if (d.f) {
      const forms = String(d.f).split("|");
      const words = forms[0].split(" ").length; // "небольшая луковица" replaces two words
      rest = rest.replace(new RegExp(`(?:\\S+\\s+){${words - 1}}\\S+$`), forms[plural(hiR, forms)]);
    }
    const numText = loR === null || loR === hiR ? frac(hiR) : `${frac(loR)}–${frac(hiR)}`;
    return { text: `${approx ? "≈ " : ""}${numText}${rest}`, unit: "" };
  }

  if (d.k === "temp") {
    if (!us) return { text: d.o, unit: "C" };
    const F = (c) => { const v = c * 1.8 + 32; return c < 100 ? Math.round(v) : roundTo(v, 5); };
    return { text: `${joinRange(b === null ? null : F(a), F(b ?? a), String)} ${unitName("F", 0, lang)}`, unit: "F" };
  }

  if (d.k === "len") {
    if (!us) return { text: d.o, unit: u };
    const cm = (v) => (u === "mm" ? v / 10 : v);
    const p = inchPlan();
    const show = (v) => frac(p.round(cm(v) / p.per));
    const nums = size ? `${show(a)} × ${show(b)}` : joinRange(b === null ? null : a, b ?? a, show);
    return { text: `${nums} ${unitName("in", 0, lang)}`, unit: "in" };
  }

  // mass and volume
  const imperialSource = IMPERIAL.has(u);
  if (same && (!us || imperialSource)) return { text: d.o, unit: family(u) };
  const base = d.k === "mass" ? G[u] : ML[u];
  const ref = a * f * base; // a range is shown in the unit that suits its smaller end
  let p;
  if (d.k === "mass") p = us || u === "oz" || u === "lb" ? ozPlan(ref) : gPlan(ref);
  else if (us && String(d.alt) === "1" && (u === "ml" || u === "l")) p = flozPlan();
  else if (u === "ml" || u === "l") p = us ? volPlan(ref, true, false) : mlPlan(ref);
  else p = volPlan(ref, us, u === "cup");
  const conv = (v) => p.round((v * f * base) / p.per);
  const show = (v) => (p.frac ? frac(v) : dec(v, lang));
  const hi = conv(b ?? a);
  const lo = b === null ? null : conv(a);
  return { text: `${joinRange(lo, hi, show)} ${unitName(p.unit, hi, lang)}`, unit: family(p.unit) };
}

/** Rewrite every quantity span under `root`. Returns how many changed from the original text. */
export function applyQuantities(root, opts) {
  let changed = 0;
  root.querySelectorAll("span.q").forEach((el) => {
    if (el.dataset.o === undefined) el.dataset.o = el.textContent;
    const r = formatQ({ ...el.dataset }, opts);
    if (el.textContent !== r.text) el.textContent = r.text;
    el.dataset.du = r.unit;
    if (r.text !== el.dataset.o) changed++;
  });
  // "2 lb (~2 lb)": drop a bracketed alternative that now says the same thing in the same unit
  root.querySelectorAll("span.qalt").forEach((el) => {
    const alt = el.querySelector("span.q");
    let prev = el.previousElementSibling;
    while (prev && !prev.matches("span.q")) prev = prev.previousElementSibling;
    el.hidden = !!(alt && prev && alt.dataset.du && alt.dataset.du === prev.dataset.du && opts.units === "us");
  });
  return changed;
}

/** Scale factor for a recipe's portions state. info: { mode: "people" | "batch", serves }. */
export function factorFor(state, info) {
  if (info.mode === "people") return state.perPerson ? 1 / info.serves : state.n / info.serves;
  return state.n;
}

export const UNITS_KEY = "units";
export const portionsKey = (slug) => `portions:${slug}`;

// ---------------------------------------------------------------- the portions + units control

export const UNITS_EVENT = "units-change"; // window event, detail: "metric" | "us"
export const REFRESH_EVENT = "quantities-refresh"; // dispatch on window after putting new quantity spans in the page

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null; // storage blocked
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage blocked */
    }
  },
};

/** The reader's units ("metric" by default). */
export function readUnits() {
  return store.get(UNITS_KEY) === "us" ? "us" : "metric";
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Wire up a portions control (markup from build.py / Portions.tsx) and rewrite the page's quantities.
 * el: the [data-portions] element; root: what to rewrite (the recipe article). Returns a cleanup function.
 * Data on el: data-slug, data-mode ("people" | "batch"), data-serves, data-lang.
 */
export function mountPortions(el, root) {
  const info = { mode: el.dataset.mode === "people" ? "people" : "batch", serves: Number(el.dataset.serves) || 1 };
  const lang = el.dataset.lang === "ru" ? "ru" : "en";
  const key = portionsKey(el.dataset.slug || location.pathname);
  const people = info.mode === "people";
  const min = people ? 1 : 0.25;
  const max = people ? 50 : 20;
  const base = people ? info.serves : 1;
  let state = { n: base, perPerson: false };
  try {
    const s = JSON.parse(store.get(key) || "null");
    if (s && Number.isFinite(s.n)) state = { n: clamp(s.n, min, max), perPerson: people && !!s.perPerson };
  } catch {
    /* bad JSON: start fresh */
  }
  let units = readUnits();

  const input = el.querySelector("input[data-n]");
  const word = el.querySelector("[data-people-word]");
  const note = (name) => el.querySelector(`[data-note="${name}"]`);
  const freeText = [...root.querySelectorAll('.step-body span.q[data-s="0"]')].some(
    (q) => (q.dataset.k === "mass" || q.dataset.k === "vol") && !q.closest(".amt"));

  const render = () => {
    const factor = factorFor(state, info);
    applyQuantities(root, { factor, units, lang });
    if (input && document.activeElement !== input) input.value = String(state.n);
    if (word) {
      const forms = [word.dataset.one, word.dataset.many];
      const n = state.n;
      const one = lang === "ru" ? n % 10 === 1 && n % 100 !== 11 : n === 1;
      word.textContent = forms[one ? 0 : 1] || "";
    }
    el.querySelectorAll("[data-x]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.x) === state.n)));
    el.querySelectorAll("[data-view]").forEach((b) =>
      b.setAttribute("aria-pressed", String((b.dataset.view === "one") === state.perPerson)));
    el.querySelectorAll("[data-units]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.units === units)));
    el.querySelectorAll("[data-step], input[data-n]").forEach((c) => { c.disabled = state.perPerson; });
    const show = (name, on) => { const n = note(name); if (n) n.hidden = !on; };
    show("one", state.perPerson);
    show("steps", Math.abs(factor - 1) > 1e-9 && freeText);
    show("big", factor > 3);
    el.classList.toggle("scaled", Math.abs(factor - 1) > 1e-9);
  };
  const save = () => store.set(key, JSON.stringify(state));
  const set = (patch) => {
    state = { ...state, ...patch };
    state.n = clamp(state.n, min, max);
    save();
    render();
  };

  const onClick = (e) => {
    const b = e.target.closest("button");
    if (!b || !el.contains(b)) return;
    if (b.dataset.step) {
      const step = Number(b.dataset.step);
      const n = people ? state.n + step : (step > 0 ? (state.n < 1 ? state.n * 2 : state.n + 1) : (state.n <= 1 ? state.n / 2 : state.n - 1));
      set({ n });
    } else if (b.dataset.x) set({ n: Number(b.dataset.x) });
    else if (b.dataset.view) set({ perPerson: b.dataset.view === "one" });
    else if (b.dataset.units) {
      units = b.dataset.units === "us" ? "us" : "metric";
      store.set(UNITS_KEY, units);
      window.dispatchEvent(new CustomEvent(UNITS_EVENT, { detail: units }));
      render();
    }
  };
  const onInput = () => {
    const v = Number(String(input.value).replace(",", "."));
    if (input.value !== "" && Number.isFinite(v) && v >= min && v <= max) set({ n: people ? Math.round(v) : v });
  };
  const onBlur = () => { input.value = String(state.n); };
  const onUnits = (e) => {
    const u = e.detail === "us" ? "us" : "metric";
    if (u !== units) { units = u; render(); }
  };
  const onRefresh = () => render();

  el.addEventListener("click", onClick);
  input?.addEventListener("input", onInput);
  input?.addEventListener("blur", onBlur);
  window.addEventListener(UNITS_EVENT, onUnits);
  window.addEventListener(REFRESH_EVENT, onRefresh);
  render();
  return () => {
    el.removeEventListener("click", onClick);
    input?.removeEventListener("input", onInput);
    input?.removeEventListener("blur", onBlur);
    window.removeEventListener(UNITS_EVENT, onUnits);
    window.removeEventListener(REFRESH_EVENT, onRefresh);
  };
}
