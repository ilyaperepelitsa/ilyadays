"use client";
// Batch calculator for a recipe's vinegar mix (cucumber marinade): how much vinegar, water, mirin and sugar for a
// jar of a given size, or for N recipes. The vinegar is the one picked in the ingredients panel (localStorage
// "vinegar", shared with VinegarPicker); the calculator's own inputs live in localStorage too. Never a cookie.
import { useCallback, useState, useSyncExternalStore } from "react";
import type { Batch, VinegarOption } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { formatQ, UNITS_EVENT, UNITS_KEY } from "@/lib/units.js";

const KEY = "calc:cucumber-mix";
const VINEGAR_KEY = "vinegar";
const EVENT = "batch-calc";

type Saved = { mode: "jar" | "recipes"; jar: number; recipes: number };
const DEFAULTS: Saved = { mode: "jar", jar: 500, recipes: 6 };

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked
  }
};

function subscribe(onChange: () => void) {
  const picker = document.querySelector("[data-vinegar-picker]");
  // VinegarPicker stores the choice in its own change listener, which may run after this one: read it a tick later.
  const onPick = () => setTimeout(onChange, 0);
  window.addEventListener(EVENT, onChange);
  window.addEventListener(UNITS_EVENT, onChange); // metric / US switched in the ingredients panel
  window.addEventListener("storage", onChange);
  picker?.addEventListener("change", onPick);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener(UNITS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    picker?.removeEventListener("change", onPick);
  };
}

function parse(raw: string | null): Saved {
  try {
    const s = { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) } as Saved;
    return {
      mode: s.mode === "recipes" ? "recipes" : "jar",
      jar: Number.isFinite(s.jar) && s.jar > 0 ? s.jar : DEFAULTS.jar,
      recipes: Number.isFinite(s.recipes) && s.recipes > 0 ? s.recipes : DEFAULTS.recipes,
    };
  } catch {
    return DEFAULTS;
  }
}

const FRAC: Record<number, string> = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** Kitchen amounts, like the recipe's own: spoons + ml when small, ml (to 5 ml above 100) when large. */
function volume(ml: number, u: Record<string, string>) {
  if (ml < 1) return "—";
  const spoon = (n: number, step: number, unit: string) => {
    const q = Math.round((ml / n) * step) / step;
    const whole = Math.floor(q);
    return `${whole || ""}${FRAC[q - whole] ?? ""} ${unit} (${Math.round(ml)} ${u.ml})`.trim();
  };
  if (ml < 13) return spoon(5, 2, u.tsp);
  if (ml < 60) return spoon(15, 4, u.tbsp);
  return `${ml > 100 ? Math.round(ml / 5) * 5 : Math.round(ml)} ${u.ml}`;
}

/** US units (the metric / US switch at the top of the ingredients): cups and spoons, sugar in ounces. */
const usVolume = (ml: number, lang: Lang) =>
  ml < 1 ? "—" : formatQ({ k: "vol", u: "ml", a: ml, o: "" }, { factor: 1, units: "us", lang }).text;
const usMass = (g: number, lang: Lang) => formatQ({ k: "mass", u: "g", a: g, o: "" }, { factor: 1, units: "us", lang }).text;

/** A number box that lets you clear it and type freely; only whole numbers in range are passed on. */
function NumberField(props: { value: number; min: number; max: number; step?: number; label?: string; onValue: (v: number) => void }) {
  const { value, min, max, step, label, onValue } = props;
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = Math.round(Number(e.target.value));
        if (e.target.value !== "" && v >= min && v <= max) onValue(v);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function BatchCalc({ batch, options, lang }: { batch: Batch; options: Record<string, VinegarOption>; lang: Lang }) {
  const u = batch.text;
  const us = useSyncExternalStore(subscribe, () => read(UNITS_KEY), () => null) === "us";
  const vol = (ml: number) => (us ? usVolume(ml, lang) : volume(ml, u));
  const mass = (g: number) => (us ? usMass(g, lang) : `${Math.round(g)} ${u.g}`);
  const saved = parse(useSyncExternalStore(subscribe, () => read(KEY), () => null));
  const storedVinegar = useSyncExternalStore(subscribe, () => read(VINEGAR_KEY), () => null);
  const vinegar = storedVinegar && batch.kinds[storedVinegar] ? storedVinegar : "rice";

  const save = useCallback((patch: Partial<Saved>) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...parse(read(KEY)), ...patch }));
    } catch {
      /* storage blocked */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  // Picking a vinegar here ticks the same radio in the ingredients panel, which updates the page and remembers it.
  const pickVinegar = (key: string) => {
    const radio = document.querySelector<HTMLInputElement>(`[data-vinegar-picker] input[value="${CSS.escape(key)}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      try {
        localStorage.setItem(VINEGAR_KEY, key);
      } catch {
        /* storage blocked */
      }
      window.dispatchEvent(new Event(EVENT));
    }
  };

  const k = batch.kinds[vinegar];
  const n = saved.mode === "jar" ? saved.jar / k.use_ml : saved.recipes;
  const total = n * k.use_ml;
  const fill = (s: string, vars: Record<string, string | number>) =>
    s.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
  const custom = !batch.jars_ml.includes(saved.jar);

  return (
    <section className="block batch" id="batch">
      <h2>{u.title}</h2>
      <p className="batch-lede">{u.lede}</p>
      <div className="batch-card">
        <label className="batch-vinegar">
          <span>{u.vinegar}</span>
          <select value={vinegar} onChange={(e) => pickVinegar(e.target.value)}>
            {Object.keys(batch.kinds).map((key) => (
              <option key={key} value={key}>
                {options[key]?.label ?? key}
              </option>
            ))}
          </select>
        </label>

        <div className="batch-mode" role="group">
          {(["jar", "recipes"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={saved.mode === m}
              className={saved.mode === m ? "on" : undefined}
              onClick={() => save({ mode: m })}
            >
              {m === "jar" ? u.by_jar : u.by_recipes}
            </button>
          ))}
        </div>

        {saved.mode === "jar" ? (
          <fieldset className="batch-input">
            <legend>{u.jar}</legend>
            <div className="batch-jars">
              {batch.jars_ml.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  aria-pressed={saved.jar === ml}
                  className={saved.jar === ml ? "on" : undefined}
                  onClick={() => save({ jar: ml })}
                >
                  {ml} {u.ml}
                </button>
              ))}
              <label className={custom ? "batch-other on" : "batch-other"}>
                <span>{u.other}</span>
                <NumberField value={saved.jar} min={50} max={5000} step={50} onValue={(jar) => save({ jar })} />
              </label>
            </div>
          </fieldset>
        ) : (
          <fieldset className="batch-input">
            <legend>{u.recipes}</legend>
            <div className="batch-stepper">
              <button type="button" aria-label={u.less} onClick={() => save({ recipes: Math.max(1, saved.recipes - 1) })}>
                −
              </button>
              <NumberField
                value={saved.recipes}
                min={1}
                max={100}
                label={u.recipes}
                onValue={(recipes) => save({ recipes })}
              />
              <button type="button" aria-label={u.more} onClick={() => save({ recipes: Math.min(100, saved.recipes + 1) })}>
                +
              </button>
            </div>
          </fieldset>
        )}

        <ul className="batch-out" aria-live="polite">
          <li>
            <span className="ing-name">{options[vinegar]?.name ?? u.vinegar}</span>
            <span className="ing-amt">{vol(n * k.vinegar_ml)}</span>
          </li>
          <li className={k.water_ml < 0.5 ? "batch-none" : undefined}>
            <span className="ing-name">{u.water}</span>
            <span className="ing-amt">{k.water_ml < 0.5 ? "—" : vol(n * k.water_ml)}</span>
          </li>
          <li>
            <span className="ing-name">{u.mirin}</span>
            <span className="ing-amt">{vol(n * batch.mirin_ml)}</span>
          </li>
          <li>
            <span className="ing-name">{u.sugar}</span>
            <span className="ing-amt">{mass(n * k.sugar_g)}</span>
          </li>
        </ul>
        <p className="batch-use">
          {fill(u.use, { use: vol(k.use_ml) })}{" "}
          {saved.mode === "jar"
            ? fill(u.jar_makes, { n: Math.floor(n) })
            : fill(u.recipes_make, { ml: vol(total) })}
        </p>
        <p className="batch-store">{u.store}</p>
      </div>
    </section>
  );
}
