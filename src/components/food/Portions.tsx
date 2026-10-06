"use client";
// Portions + units at the top of the ingredients: "Cooking for [N] people" (or batches), whole recipe / per person,
// metric / US. The markup is rendered on the server with the recipe's own amounts (no layout jump); units.js — the
// same file the local recipe site uses — then scales and converts every quantity span in the article. The choices
// live in localStorage (portions:<slug>, units). Never a cookie.
import { useEffect, useRef } from "react";
import type { Scale } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { mountPortions } from "@/lib/units.js";

function Stepper(props: { value: string; min: number; max: number; step: number; label: string; fewer: string; more: string }) {
  const { value, min, max, step, label, fewer, more } = props;
  return (
    <span className="stepper">
      <button type="button" data-step="-1" aria-label={fewer}>
        −
      </button>
      <input
        type="number"
        data-n=""
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        inputMode="decimal"
        aria-label={label}
      />
      <button type="button" data-step="1" aria-label={more}>
        +
      </button>
    </span>
  );
}

export function Portions({ scale, slug, lang }: { scale: Scale; slug: string; lang: Lang }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const root = el?.closest("article");
    if (!el || !root) return;
    return mountPortions(el, root);
  }, []);

  const u = scale.text;
  const n = String(scale.serves);
  const one = lang === "ru" ? scale.serves % 10 === 1 && scale.serves % 100 !== 11 : scale.serves === 1;
  const word = one ? u["person"] : u["people"];
  const size = scale.mode === "people" ? `${n} ${word}` : u["one batch"];

  return (
    <div className="portions" data-portions="" data-slug={slug} data-mode={scale.mode} data-serves={n} data-lang={lang} ref={ref}>
      {scale.mode === "people" && (
        <>
          <div className="portions-row">
            <span className="portions-label">{u["Cooking for"]}</span>
            <Stepper value={n} min={1} max={50} step={1} label={u["people"]} fewer={u["Fewer"]} more={u["More"]} />
            <span data-people-word="" data-one={u["person"]} data-many={u["people"]}>
              {word}
            </span>
          </div>
          <div className="seg" role="group" aria-label={u["Servings"]}>
            <button type="button" data-view="all" aria-pressed="true">
              {u["Whole recipe"]}
            </button>
            <button type="button" data-view="one" aria-pressed="false">
              {u["Per person"]}
            </button>
          </div>
        </>
      )}
      {scale.mode === "batch" && (
        <>
          <div className="portions-row">
            <span className="portions-label">{u["Batches"]}</span>
            <Stepper value="1" min={0.25} max={20} step={0.25} label={u["Batches"]} fewer={u["Fewer"]} more={u["More"]} />
          </div>
          <div className="seg" role="group" aria-label={u["Batches"]}>
            {[
              [0.5, "½"],
              [1, "1"],
              [2, "2"],
              [3, "3"],
            ].map(([x, t]) => (
              <button type="button" key={x} data-x={x} aria-pressed={x === 1 ? "true" : "false"}>
                ×{t}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="seg" role="group" aria-label={u["Units"]}>
        <button type="button" data-units="metric" aria-pressed="true">
          {u["Metric (g, ml, °C)"]}
        </button>
        <button type="button" data-units="us" aria-pressed="false">
          {u["US (oz, cups, °F)"]}
        </button>
      </div>
      {scale.mode !== "none" && (
        <>
          <p className="portions-note" data-note="one" hidden>
            {u["Amounts for one person — multiply by the number of people."]}
          </p>
          <p className="portions-note" data-note="steps" hidden>
            {u["Amounts written inside the step text are for the original recipe; the lists are scaled."]}
          </p>
          <p className="portions-note" data-note="big" hidden>
            {u["Cook in batches — the pots and pans in the steps are sized for {n}."].replace("{n}", size)}
          </p>
        </>
      )}
    </div>
  );
}
