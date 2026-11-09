/**
 * "Equipment here" (stream 05): every catalog exercise grouped by coarse muscle group, then equipment, each a 44 px
 * row with one chip (here / not here / not sure). A group lists only what the plan uses until "All N" is tapped,
 * so every program exercise is one tap away; search lists matches from every group. The switch at the bottom says
 * what unmarked machines mean (counted as here, or skipped: a checklist).
 */
import { useMemo, useState } from "react";
import type { Gym, Lang } from "@/lib/fitness/types";
import { t2 } from "@/lib/fitness/i18n";
import { EQUIPMENT, equipmentShort, searchItems } from "@/lib/fitness/catalog-core.mjs";
import {
  effectiveAvailability, isChecklist, nextMark, setAvailability, setChecklist, type GymCatalog, type GymExercise,
} from "@/lib/fitness/gyms-core.mjs";
import { type GroupInfo, type PlanUse, type SectionProps, exerciseName, planUses, tr } from "./shared";

const EQUIPMENT_ORDER: string[] = EQUIPMENT.map((e) => e.id);
const rank = (eq: string) => {
  const i = EQUIPMENT_ORDER.indexOf(eq);
  return i < 0 ? EQUIPMENT_ORDER.length : i;
};

function byEquipment(list: readonly GymExercise[]): [string, GymExercise[]][] {
  const map = new Map<string, GymExercise[]>();
  for (const e of list) {
    const rows = map.get(e.equipment);
    if (rows) rows.push(e);
    else map.set(e.equipment, [e]);
  }
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}

type RowProps = {
  lang: Lang;
  ex: GymExercise;
  gym: Gym;
  catalog: GymCatalog;
  use: PlanUse | undefined;
  groupName?: string;
  canWrite: boolean;
  onMark: (id: string) => void;
};

function MachineRow({ lang, ex, gym, catalog, use, groupName, canWrite, onMark }: RowProps) {
  const T = tr(lang);
  const a = effectiveAvailability(gym, ex.id);
  const name = exerciseName(catalog, ex.id, lang);
  const state = a.mark === "missing" ? "missing" : a.available ? "here" : "unknown";
  const label = state === "missing" ? T("Not here", "Нет") : state === "here" ? T("Here", "Есть") : T("Not sure", "Не знаю");
  const meta: string[] = [];
  if (groupName) meta.push(groupName);
  meta.push(equipmentShort(ex.equipment, lang));
  if (use?.program.length) meta.push(T(`plan ${use.program.join(", ")}`, `в плане: ${use.program.join(", ")}`));
  const standsIn = use ? use.used.filter((s) => !use.program.includes(s)) : [];
  if (standsIn.length) meta.push(T(`replaces in ${standsIn.join(", ")}`, `замена в ${standsIn.join(", ")}`));
  if (use?.replacedBy) {
    const other = exerciseName(catalog, use.replacedBy, lang);
    meta.push(T(`here: ${other} instead`, `здесь вместо него: ${other}`));
  }
  return (
    <li className="fit-gym-row" data-state={state}>
      <span className="fit-gym-row-text">
        <span className="fit-gym-row-name">{name}</span>
        <span className="fit-gym-row-meta">{meta.join(" · ")}</span>
      </span>
      <button
        type="button"
        className="fit-gym-chip"
        data-state={state}
        data-testid="machine-toggle"
        data-exercise-id={ex.id}
        data-available={a.available ? "true" : "false"}
        data-mark={a.mark}
        aria-pressed={state === "here" ? true : state === "missing" ? false : "mixed"}
        aria-label={`${name}: ${label}`}
        disabled={!canWrite}
        onClick={() => onMark(ex.id)}
      >
        <span aria-hidden="true">{state === "here" ? "✓" : state === "missing" ? "✕" : "?"}</span>
        <span>{label}</span>
      </button>
    </li>
  );
}

export function EquipmentList({ lang, gym, catalog, plan, canWrite, write, groups }: SectionProps & { groups: readonly GroupInfo[] }) {
  const T = tr(lang);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const uses = useMemo(() => planUses(plan), [plan]);
  const checklist = isChecklist(gym);

  const grouped = useMemo(() => {
    const map = new Map<string, GymExercise[]>();
    for (const e of catalog.exercises) {
      const id = e.group ?? "other";
      const rows = map.get(id);
      if (rows) rows.push(e);
      else map.set(id, [e]);
    }
    const known = groups.map((g) => g.id).filter((id) => map.has(id));
    const rest = [...map.keys()].filter((id) => !known.includes(id));
    return [...known, ...rest].map((id) => ({
      id,
      name: groups.find((g) => g.id === id)?.name ?? { en: "Other", ru: "Другое" },
      list: map.get(id) ?? [],
    }));
  }, [catalog, groups]);
  const groupNames = useMemo(() => new Map(grouped.map((g) => [g.id, t2(lang, g.name)])), [grouped, lang]);
  const results = useMemo(() => (query.trim() ? searchItems(catalog.exercises, query, lang) : null), [catalog, query, lang]);

  const mark = (id: string) => write((g, now) => setAvailability(g, id, nextMark(g, id), now));
  const row = (e: GymExercise, withGroup = false) => (
    <MachineRow
      key={e.id}
      lang={lang}
      ex={e}
      gym={gym}
      catalog={catalog}
      use={uses.get(e.id)}
      groupName={withGroup ? groupNames.get(e.group ?? "other") : undefined}
      canWrite={canWrite}
      onMark={mark}
    />
  );

  return (
    <section className="fit-gym-block" aria-labelledby="fit-gym-equipment">
      <h3 id="fit-gym-equipment">{T("Equipment here", "Оборудование в этом зале")}</h3>
      <p className="fit-gym-hint">
        {checklist
          ? T(
              "Checklist: the plan uses only what is marked “Here”. A tap goes Here → Not here → Not sure.",
              "Список: план использует только отмеченное «есть». Нажатие: есть → нет → не знаю.",
            )
          : T(
              "Everything counts as here until you mark it “Not here”. The plan then swaps in the closest alternative.",
              "Всё считается доступным, пока вы не отметите «нет». Тогда план подставит ближайшую замену.",
            )}
      </p>
      <input
        className="fit-gym-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={T("Search: pec deck, Technogym…", "Поиск: бабочка, Technogym…")}
        aria-label={T("Search equipment", "Поиск оборудования")}
        data-testid="gym-search"
        enterKeyHint="search"
        autoComplete="off"
      />

      {results ? (
        results.length ? (
          <ul className="fit-gym-rows" aria-label={T("Search results", "Результаты поиска")}>{results.map((e) => row(e, true))}</ul>
        ) : (
          <p className="fit-gym-hint">{T("Nothing found.", "Ничего не найдено.")}</p>
        )
      ) : (
        grouped.map((group) => {
          const expanded = Boolean(open[group.id]);
          const relevant = group.list.filter((e) => uses.has(e.id));
          const missing = group.list.filter((e) => effectiveAvailability(gym, e.id).mark === "missing").length;
          const unsure = checklist ? group.list.filter((e) => effectiveAvailability(gym, e.id).mark === "unknown").length : 0;
          const name = t2(lang, group.name);
          const listId = `fit-gym-group-${group.id}`;
          return (
            <div key={group.id} className="fit-gym-group">
              <div className="fit-gym-group-head">
                <h4>
                  {name}
                  {missing ? <span className="fit-gym-count fit-num"> · {T(`${missing} not here`, `нет: ${missing}`)}</span> : null}
                  {unsure ? <span className="fit-gym-count fit-num"> · {T(`${unsure} not sure`, `не знаю: ${unsure}`)}</span> : null}
                </h4>
                <button
                  type="button"
                  className="fit-gym-more"
                  aria-expanded={expanded}
                  aria-controls={listId}
                  data-testid="group-toggle"
                  data-group={group.id}
                  onClick={() => setOpen((o) => ({ ...o, [group.id]: !expanded }))}
                >
                  {expanded ? T("Plan only", "Только план") : T(`All ${group.list.length}`, `Все ${group.list.length}`)}
                </button>
              </div>
              <div id={listId}>
                {expanded ? (
                  byEquipment(group.list).map(([eq, rows]) => (
                    <div key={eq} className="fit-gym-eq">
                      <h5>{equipmentShort(eq, lang)}</h5>
                      <ul className="fit-gym-rows">{rows.map((e) => row(e))}</ul>
                    </div>
                  ))
                ) : relevant.length ? (
                  <ul className="fit-gym-rows">{relevant.map((e) => row(e))}</ul>
                ) : null}
              </div>
            </div>
          );
        })
      )}

      {canWrite ? <div className="fit-gym-mode">
        <p className="fit-gym-hint" id="fit-gym-mode-label">{T("Machines you have not marked:", "Неотмеченные тренажёры:")}</p>
        <div className="fit-seg" role="group" aria-labelledby="fit-gym-mode-label">
          <button
            type="button"
            aria-pressed={!checklist}
            data-testid="gym-checklist"
            data-value="assume"
            disabled={!canWrite}
            onClick={() => write((g, now) => setChecklist(g, false, now, catalog))}
          >
            {T("Count as here", "Считать, что есть")}
          </button>
          <button
            type="button"
            aria-pressed={checklist}
            data-testid="gym-checklist"
            data-value="checklist"
            disabled={!canWrite}
            onClick={() => write((g, now) => setChecklist(g, true, now, catalog))}
          >
            {T("Skip them (checklist)", "Не использовать (список)")}
          </button>
        </div>
      </div> : null}
    </section>
  );
}
