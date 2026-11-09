"use client";
/**
 * /fitness/gyms (stream 05 — plans/fitness/05-gym-profiles.md): the gym list with the active marker, create, and the
 * editor of the selected gym. Every write goes through the fitness store (local-first; synced for the owner) and is
 * built from the latest stored row; visitors (viewer mode) and the loading phase are read-only.
 * Exercise data arrives trimmed from the server view (GYM_EXERCISES), so this bundle never carries the full catalog.
 */
import { useCallback, useMemo, useState } from "react";
import type { Gym, Lang, Settings } from "@/lib/fitness/types";
import { defaultSettings } from "@/lib/fitness/store-core.mjs";
import { gymCatalog, gymSummary, newGym, type GymCatalog, type GymExercise, type PlanLike } from "@/lib/fitness/gyms-core.mjs";
import { useFitness } from "../Provider";
import { GymEditor } from "./GymEditor";
import { type GroupInfo, type GymWrite, type PreviewDays, tr } from "./shared";

type Props = {
  lang: Lang;
  exercises: readonly GymExercise[];
  groups: readonly GroupInfo[];
  /** template days per day count ("2", "3", "4") for the preview before a program is saved */
  previews: PreviewDays;
};

function summaryText(lang: Lang, gym: Gym, program: PlanLike, catalog: GymCatalog): string {
  const T = tr(lang);
  const s = gymSummary(gym, program, catalog);
  const parts = [
    s.checklist
      ? T(`${s.here} ticked · ${s.missing} missing`, `есть: ${s.here} · нет: ${s.missing}`)
      : s.missing
        ? T(`${s.missing} missing`, `нет в зале: ${s.missing}`)
        : T("nothing missing", "всё на месте"),
  ];
  if (s.changed) parts.push(T(`${s.changed} ${s.changed === 1 ? "swap" : "swaps"} in your plan`, `замен в плане: ${s.changed}`));
  if (s.stuck) parts.push(T(`${s.stuck} without an alternative`, `без замены: ${s.stuck}`));
  return parts.join(" · ");
}

function CreateGym({ lang, first, onCreate, onCancel }: { lang: Lang; first: boolean; onCreate: (name: string) => void; onCancel?: () => void }) {
  const T = tr(lang);
  const [name, setName] = useState("");
  return (
    <form
      className="fit-gym-form fit-gym-create"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(name);
        setName("");
      }}
    >
      <label className="fit-gym-field">
        <span>{first ? T("Name your gym", "Как называется зал") : T("New gym", "Новый зал")}</span>
        <input
          type="text"
          value={name}
          maxLength={60}
          placeholder={T("e.g. Gym near home", "например, зал у дома")}
          autoComplete="off"
          enterKeyHint="done"
          data-testid="gym-create-name"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="fit-gym-actions">
        <button type="submit" className="fit-button" data-testid="gym-create">{T("Add gym", "Добавить зал")}</button>
        {onCancel ? (
          <button type="button" className="fit-button quiet" onClick={onCancel}>{T("Cancel", "Отмена")}</button>
        ) : null}
      </div>
    </form>
  );
}

export function GymProfiles({ lang, exercises, groups, previews }: Props) {
  const T = tr(lang);
  const { snapshot, store, mode, canWrite } = useFitness();
  const catalog = useMemo(() => gymCatalog(exercises), [exercises]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const gyms = useMemo(
    () => Object.values(snapshot.gyms).sort((a, b) => a.name.localeCompare(b.name, lang) || a.id.localeCompare(b.id)),
    [snapshot.gyms, lang],
  );
  const wantedActive = snapshot.settings?.activeGymId ?? null;
  const activeId = wantedActive && snapshot.gyms[wantedActive] ? wantedActive : null;
  const selected = (selectedId ? snapshot.gyms[selectedId] : undefined) ?? (activeId ? snapshot.gyms[activeId] : undefined) ?? gyms[0] ?? null;

  const saved = snapshot.activeProgramId ? (snapshot.programs[snapshot.activeProgramId] ?? null) : null;
  const days = String(snapshot.settings?.daysPerWeek ?? 3);
  const fallback = useMemo<PlanLike>(() => ({ days: previews[days] ?? previews["3"] ?? [] }), [previews, days]);
  const program: PlanLike = saved ?? fallback;

  /** Change one gym from its latest stored row; nothing is written when the change is a no-op. */
  const writeGym = useCallback(
    (id: string, change: (gym: Gym, now: string) => Gym) => {
      if (!canWrite) return;
      const current = store.getSnapshot().gyms[id];
      if (!current) return;
      const next = change(current, new Date().toISOString());
      if (next !== current) store.upsert("gyms", next);
    },
    [canWrite, store],
  );

  const setActive = useCallback(
    (id: string | null) => {
      if (!canWrite) return;
      const now = new Date().toISOString();
      const base = store.getSnapshot().settings ?? (defaultSettings(now) as Settings);
      if ((base.activeGymId ?? null) === id) return;
      store.upsert("settings", { ...base, activeGymId: id, updatedAt: now });
    },
    [canWrite, store],
  );

  const create = (name: string) => {
    if (!canWrite) return;
    const gym = newGym(name.trim() || T("My gym", "Мой зал"), new Date());
    store.upsert("gyms", gym);
    if (!activeId) setActive(gym.id);
    setSelectedId(gym.id);
    setAdding(false);
  };

  const remove = (id: string) => {
    if (!canWrite) return;
    store.remove("gyms", id);
    if (store.getSnapshot().settings?.activeGymId === id) setActive(null);
    setSelectedId(null);
  };

  const selectedKey = selected?.id ?? null;
  const selectedWrite = useMemo<GymWrite | null>(
    () => (selectedKey ? (change) => writeGym(selectedKey, change) : null),
    [selectedKey, writeGym],
  );

  if (gyms.length === 0 && (mode === "loading" || !canWrite)) {
    return (
      <section className="fit-gyms" aria-busy={mode === "loading"}>
        <p className="fit-note">{mode === "loading" ? T("Loading gyms…", "Загружаем залы…") : T("No gyms yet.", "Залов пока нет.")}</p>
      </section>
    );
  }

  return (
    <div className="fit-gyms">
      <section className="fit-gym-list" aria-labelledby="fit-gyms-title">
        <h2 id="fit-gyms-title">{gyms.length ? T("Your gyms", "Ваши залы") : T("Add your gym", "Добавьте свой зал")}</h2>
        {gyms.length === 0 ? (
          <p className="fit-gym-hint">
            {T(
              "Name the gym you train in. Every machine counts as here until you mark it missing; the plan then uses the closest alternative.",
              "Назовите зал, где тренируетесь. Все тренажёры считаются доступными, пока вы не отметите отсутствующие; тогда план возьмёт ближайшую замену.",
            )}
          </p>
        ) : (
          <ul className="fit-gym-cards">
            {gyms.map((g) => {
              const isActive = g.id === activeId;
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    className="fit-gym-card"
                    data-testid="gym-card"
                    data-gym-id={g.id}
                    data-active={isActive ? "true" : "false"}
                    aria-current={selected?.id === g.id ? "true" : undefined}
                    onClick={() => setSelectedId(g.id)}
                  >
                    <span className="fit-gym-card-name">
                      {g.name}
                      {isActive ? <span className="fit-gym-badge">{T("Active", "Текущий")}</span> : null}
                    </span>
                    <span className="fit-gym-card-meta fit-num">{summaryText(lang, g, program, catalog)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {canWrite ? (
          gyms.length === 0 || adding ? (
            <CreateGym lang={lang} first={gyms.length === 0} onCreate={create} onCancel={gyms.length ? () => setAdding(false) : undefined} />
          ) : (
            <button type="button" className="fit-button quiet fit-gym-add" data-testid="gym-add" onClick={() => setAdding(true)}>
              {T("+ Add a gym", "+ Добавить зал")}
            </button>
          )
        ) : null}
      </section>

      {selected && selectedWrite ? (
        <GymEditor
          key={selected.id}
          lang={lang}
          gym={selected}
          catalog={catalog}
          groups={groups}
          program={program}
          preview={!saved}
          isActive={selected.id === activeId}
          canWrite={canWrite}
          write={selectedWrite}
          onUse={() => setActive(selected.id)}
          onDelete={() => remove(selected.id)}
        />
      ) : null}
    </div>
  );
}
