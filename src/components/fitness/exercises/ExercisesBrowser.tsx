"use client";
/**
 * Exercise catalog list (stream 02, plans/fitness/02-exercise-catalog-and-alternatives.md): search, faceted filter
 * chips (muscle group, equipment, movement), "machines first", "my program only", and cards with the technique
 * picture (or a compact muscle map), program slots and gym availability. The server view passes trimmed rows, so the
 * 576 KB catalog never reaches the browser. Filters live in the URL (?q=&group=&eq=&pattern=&mf=0&mine=1): a shared
 * link opens filtered, and Back from an exercise returns to the same list.
 */
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { localPath } from "@/lib/i18n";
import type { Equipment, Lang, MovementPattern, Text2 } from "@/lib/fitness/types";
import { pick, pluralRu, t2 } from "@/lib/fitness/i18n";
import {
  EQUIPMENT, PATTERNS, equipmentShort, facetCounts, filterItems, isAvailable, machinesFirst, patternShort, searchItems,
} from "@/lib/fitness/catalog-core.mjs";
import { MuscleMap, MuscleSprite } from "./MuscleMap";
import { useActive, type TemplateDays } from "./useActive";

export type BrowserItem = {
  id: string;
  name: Text2;
  /** Other names and machine model names (searched) */
  aka: string[];
  equipment: Equipment;
  pattern: MovementPattern;
  /** Coarse groups of the primary muscles */
  groups: string[];
  primary: string[];
  secondary: string[];
  /** Primary muscle names in the page language */
  muscles: string;
  /** Technique picture URL (sequence), when there is one */
  image: string | null;
};

export type BrowserGroup = { id: string; name: string };

type Filters = { q: string; group: string | null; eq: string | null; pattern: string | null; machinesFirst: boolean; mine: boolean };

const DEFAULTS: Filters = { q: "", group: null, eq: null, pattern: null, machinesFirst: true, mine: false };
const subscribeNothing = () => () => {};

function filtersFromUrl(): Filters {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get("q") ?? "",
    group: p.get("group") || null,
    eq: p.get("eq") || null,
    pattern: p.get("pattern") || null,
    machinesFirst: p.get("mf") !== "0",
    mine: p.get("mine") === "1",
  };
}

function writeUrl(f: Filters) {
  const url = new URL(location.href);
  const put = (key: string, value: string | null) => (value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
  put("q", f.q.trim() || null);
  put("group", f.group);
  put("eq", f.eq);
  put("pattern", f.pattern);
  put("mf", f.machinesFirst ? null : "0");
  put("mine", f.mine ? "1" : null);
  history.replaceState(null, "", `${url.pathname}${url.search}`);
}

type Option = { id: string; label: string; count: number };

function ChipRow({ lang, label, value, options, onPick }: { lang: Lang; label: string; value: string | null; options: Option[]; onPick: (id: string | null) => void }) {
  return (
    <div className="fx-row" role="group" aria-label={label}>
      <span className="fx-row-label" aria-hidden="true">
        {label}
      </span>
      <div className="fit-seg fx-chips">
        <button type="button" aria-pressed={value === null} onClick={() => onPick(null)}>
          {pick(lang, "All", "Все")}
        </button>
        {options
          .filter((o) => o.count > 0 || o.id === value)
          .map((o) => (
            <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onPick(value === o.id ? null : o.id)}>
              {o.label} <small className="fit-num">{o.count}</small>
            </button>
          ))}
      </div>
    </div>
  );
}

export function ExercisesBrowser({ lang, items, groups, template }: { lang: Lang; items: BrowserItem[]; groups: BrowserGroup[]; template: TemplateDays }) {
  // The static page renders unfiltered; once hydrated, filters come from the URL; the reader's changes win after that.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const fromUrl = useMemo(() => (hydrated ? filtersFromUrl() : DEFAULTS), [hydrated]);
  const [edits, setEdits] = useState<Partial<Filters>>({});
  const f: Filters = { ...fromUrl, ...edits };
  const { gym, slots } = useActive(template);

  const update = (patch: Partial<Filters>) => {
    setEdits((prev) => ({ ...prev, ...patch }));
    writeUrl({ ...f, ...patch });
  };

  const query = f.q.trim();
  const pool = f.mine ? items.filter((i) => slots[i.id]?.length) : items;
  const ordered = query ? searchItems(pool, query, lang) : f.machinesFirst ? machinesFirst(pool) : pool;
  const active = { group: f.group, equipment: f.eq, pattern: f.pattern };
  const visible = filterItems(ordered, active);
  const counts = facetCounts(ordered, active);
  const filtered = Boolean(query || f.group || f.eq || f.pattern || f.mine);
  const n = visible.length;

  return (
    <div className="fx-browser">
      <MuscleSprite />
      <div className="fx-controls">
        <label className="fx-search">
          <span className="sr-only">{pick(lang, "Search exercises", "Поиск упражнений")}</span>
          <input
            type="search"
            value={f.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={pick(lang, "Search by name or machine brand", "Название или марка тренажёра")}
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <ChipRow
          lang={lang}
          label={pick(lang, "Muscles", "Мышцы")}
          value={f.group}
          options={groups.map((g) => ({ id: g.id, label: g.name, count: counts.group.get(g.id) ?? 0 }))}
          onPick={(group) => update({ group })}
        />
        <ChipRow
          lang={lang}
          label={pick(lang, "Equipment", "Снаряд")}
          value={f.eq}
          options={EQUIPMENT.map((e) => ({ id: e.id, label: equipmentShort(e.id, lang), count: counts.equipment.get(e.id) ?? 0 }))}
          onPick={(eq) => update({ eq })}
        />
        {f.group || f.eq || f.pattern ? (
          <ChipRow
            lang={lang}
            label={pick(lang, "Movement", "Движение")}
            value={f.pattern}
            options={PATTERNS.map((p) => ({ id: p.id, label: patternShort(p.id, lang), count: counts.pattern.get(p.id) ?? 0 }))}
            onPick={(pattern) => update({ pattern })}
          />
        ) : null}
        <div className="fx-toggles">
          <button type="button" className="fx-toggle" aria-pressed={f.machinesFirst} disabled={Boolean(query)} onClick={() => update({ machinesFirst: !f.machinesFirst })}>
            {pick(lang, "Machines first", "Сначала тренажёры")}
          </button>
          <button type="button" className="fx-toggle" aria-pressed={f.mine} onClick={() => update({ mine: !f.mine })}>
            {pick(lang, "My program only", "Только моя программа")}
          </button>
        </div>
      </div>

      <p className="fx-count" aria-live="polite">
        <span className="fit-num">{n}</span>{" "}
        {pick(lang, n === 1 ? "exercise" : "exercises", pluralRu(n, ["упражнение", "упражнения", "упражнений"]))}
        {query ? pick(lang, " · best match first", " · сначала лучшие совпадения") : null}
        {filtered ? (
          <>
            {" · "}
            <button type="button" className="fx-linkish" onClick={() => update({ q: "", group: null, eq: null, pattern: null, mine: false })}>
              {pick(lang, "clear filters", "сбросить фильтры")}
            </button>
          </>
        ) : null}
      </p>

      {n === 0 ? <p className="fit-note">{pick(lang, "Nothing matches. Try another word or clear a filter.", "Ничего не найдено. Попробуйте другое слово или снимите фильтр.")}</p> : null}

      <ul className="fx-list">
        {visible.map((item) => {
          const mine = slots[item.id] ?? [];
          const missing = gym ? !isAvailable(item.id, gym) : false;
          return (
            <li key={item.id}>
              <Link prefetch={false} href={localPath(lang, `/fitness/exercises/${item.id}`)} className="fx-card" data-testid="exercise-tile" data-exercise-id={item.id}>
                <span className="fx-thumb">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- pre-sized static webp with a ?v= hash
                    <img src={item.image} alt="" width={360} height={240} loading="lazy" decoding="async" />
                  ) : (
                    <MuscleMap compact primary={item.primary} secondary={item.secondary} lang={lang} />
                  )}
                </span>
                <span className="fx-card-body">
                  <span className="fx-card-name">{t2(lang, item.name)}</span>
                  <span className="fx-card-meta">
                    {equipmentShort(item.equipment, lang)} · {patternShort(item.pattern, lang)}
                  </span>
                  <span className="fx-card-muscles">{item.muscles}</span>
                  {mine.length || missing ? (
                    <span className="fx-badges">
                      {mine.length ? (
                        <span className="fx-badge mine">
                          {pick(lang, "My program", "В программе")} · <span className="fit-num">{mine.join(", ")}</span>
                        </span>
                      ) : null}
                      {missing && gym ? <span className="fx-badge missing">{pick(lang, `Not at ${gym.name}`, `Нет в «${gym.name}»`)}</span> : null}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
