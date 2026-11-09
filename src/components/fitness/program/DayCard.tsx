/** One training day: its slots (superset pairs stay together), the cardio finisher, and "add an exercise". */
import { useMemo, useState } from "react";
import type { ExerciseState, Gym, Lang, PlannedSession, Program, ProgramDay } from "@/lib/fitness/types";
import { pick, t2 } from "@/lib/fitness/i18n";
import { classOf, equipmentLabel, groupById, searchExercises } from "@/lib/fitness/catalog.mjs";
import { estimateMinutes } from "@/lib/fitness/templates.mjs";
import { renameDay, moveDay } from "@/lib/fitness/plan-builder.mjs";
import { exerciseAllowed } from "@/lib/fitness/plan-preferences.mjs";
import { addSlot, slotBlocks } from "@/lib/fitness/program-edit.mjs";
import { SlotRow, type Edit, type Hold } from "./SlotRow";
import { ExerciseThumbnail } from "../ExerciseThumbnail";
import { ActionIcon } from "../ActionIcon";

function AddExercise({ lang, day, program, onEdit }: { lang: Lang; day: ProgramDay; program: Program; onEdit: Edit }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => (open && query.trim() ? searchExercises(query, lang).filter((e) => !day.slots.some((s) => s.exerciseId === e.id) && exerciseAllowed(program, e)).slice(0, 8) : []),
    [open, query, lang, day, program],
  );
  if (!open) {
    return (
      <button type="button" className="fit-button ghost fpr-add" data-testid="day-add" data-day-key={day.key} onClick={() => setOpen(true)}>
        <ActionIcon name="plus" />{pick(lang, `Add an exercise to day ${day.key}`, `Добавить упражнение в день ${day.key}`)}
      </button>
    );
  }
  return (
    <div className="fpr-add-box">
      <label className="fpr-field">
        <span className="fpr-stepper-label">{pick(lang, "Find an exercise or machine", "Найти упражнение или тренажёр")}</span>
        <input
          className="fpr-input"
          type="search"
          data-testid="day-add-search"
          value={query}
          autoComplete="off"
          placeholder={pick(lang, "shrug, crunch, curl…", "шраги, скручивания, сгибания…")}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <ul className="fpr-swaps">
        {results.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="fpr-swap"
              data-testid="day-add-option"
              data-exercise-id={e.id}
              onClick={() => {
                onEdit((p, at) => addSlot(p, day.key, e.id, at));
                setQuery("");
                setOpen(false);
              }}
            >
              <ExerciseThumbnail id={e.id} />
              <span className="fpr-swap-name">{t2(lang, e.name)}</span>
              <span className="fit-muted fpr-small">
                {equipmentLabel(e.equipment, lang)}
                {classOf(e.id)?.slice === "legs" ? ` · ${pick(lang, "legs", "ноги")}` : ""}
              </span>
            </button>
          </li>
        ))}
        {query.trim() && results.length === 0 ? <li className="fit-muted fpr-small">{pick(lang, "Nothing found.", "Ничего не найдено.")}</li> : null}
      </ul>
      <button type="button" className="fit-button quiet" onClick={() => setOpen(false)}>
        {pick(lang, "Cancel", "Отмена")}
      </button>
    </div>
  );
}

export function DayCard({
  lang,
  program,
  day,
  plan,
  gym,
  editable,
  onEdit,
  states,
  now,
  onHold,
}: {
  lang: Lang;
  program: Program;
  day: ProgramDay;
  plan: PlannedSession | undefined;
  gym: Gym | null;
  editable: boolean;
  onEdit: Edit;
  states: Record<string, ExerciseState>;
  now: number | null;
  onHold?: Hold;
}) {
  const blocks = slotBlocks(day.slots);
  const blockOf = (slotId: string) => blocks.findIndex((b) => b.some((s) => s.slotId === slotId));
  const minutes = plan?.estimatedMinutes ?? estimateMinutes(day);
  const focus = day.focus.map((g) => t2(lang, groupById(g)?.name, g).toLowerCase()).join(", ");
  return (
    <section className="fit-card fpr-day" aria-labelledby={`fpr-day-${day.key}`} data-testid="program-day" data-day-key={day.key}>
      <header className="fpr-day-head">
        <span className="fpr-day-key" aria-hidden="true">{day.key}</span>
        <h3 id={`fpr-day-${day.key}`}>{t2(lang, day.name, day.key)}</h3>
        <span className="fit-muted fpr-small fit-num">
          ≈ {minutes} {pick(lang, "min", "мин")}
          {focus ? ` · ${focus}` : ""}
        </span>
      </header>
      {editable ? <details className="fpr-day-tools"><summary><ActionIcon name="edit" />{pick(lang, 'Edit day name and order', 'Изменить название и порядок дня')}</summary>
        <label className="fpr-field"><span className="fpr-small">{pick(lang, 'Day name', 'Название дня')}</span><input className="fpr-input" data-testid="day-name" key={day.name.en} defaultValue={t2(lang, day.name)} maxLength={80} onBlur={(e) => { const title = e.currentTarget.value; onEdit((p, at) => renameDay(p, day.key, title, at)); }} /></label>
        <div className="fpr-builder-actions"><button type="button" className="fit-button quiet" data-testid="day-move-up" disabled={program.days[0]?.key === day.key} onClick={() => onEdit((p, at) => moveDay(p, day.key, -1, at))}><ActionIcon name="up" />{pick(lang, 'Earlier', 'Раньше')}</button><button type="button" className="fit-button quiet" data-testid="day-move-down" disabled={program.days.at(-1)?.key === day.key} onClick={() => onEdit((p, at) => moveDay(p, day.key, 1, at))}><ActionIcon name="down" />{pick(lang, 'Later', 'Позже')}</button></div>
      </details> : null}
      {day.slots.length === 0 ? <p className="fit-muted">{pick(lang, 'No exercises yet. Add the first one below.', 'Пока нет упражнений. Добавьте первое ниже.')}</p> : null}
      {minutes > 90 ? <p className="fit-note warn">{pick(lang, 'This day may take over 90 minutes. Consider fewer sets or moving exercises to another day.', 'Этот день может занять больше 90 минут. Подумайте о меньшем числе подходов или переносе упражнений на другой день.')}</p> : null}
      <ol className="fpr-slots">
        {day.slots.map((slot) => {
          const bi = blockOf(slot.slotId);
          const planned = plan?.exercises.find((e) => e.slotId === slot.slotId);
          return (
            <SlotRow
              key={slot.slotId}
              lang={lang}
              program={program}
              day={day}
              slot={slot}
              planned={planned}
              gym={gym}
              editable={editable}
              canUp={bi > 0}
              canDown={bi < blocks.length - 1}
              canRemove={day.slots.length > 1}
              onEdit={onEdit}
              state={states[planned?.exerciseId ?? slot.exerciseId]}
              now={now}
              onHold={editable ? onHold : undefined}
            />
          );
        })}
      </ol>
      {day.finisher ? <p className="fpr-finisher">{t2(lang, day.finisher)}</p> : null}
      {editable ? <AddExercise lang={lang} day={day} program={program} onEdit={onEdit} /> : null}
    </section>
  );
}
