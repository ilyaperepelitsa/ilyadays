/**
 * "Your plan at this gym" (stream 05): every slot of the active program (or the default program before one is
 * saved) with the exercise the planner uses here, swaps and preferences marked, and "Preferred at this gym": a
 * picker of the alternatives this gym has that the planner accepts for the slot (gyms-core slotChoices).
 */
import { useState } from "react";
import type { Gym, Lang } from "@/lib/fitness/types";
import { t2 } from "@/lib/fitness/i18n";
import { equipmentShort } from "@/lib/fitness/catalog-core.mjs";
import { preferForSlot, resolveSlot, type GymCatalog, type SlotAtGym } from "@/lib/fitness/gyms-core.mjs";
import { type SectionProps, exerciseName, tr } from "./shared";

type SlotProps = {
  lang: Lang;
  slot: SlotAtGym;
  gym: Gym;
  catalog: GymCatalog;
  canWrite: boolean;
  open: boolean;
  onToggle: () => void;
  onChoose: (exerciseId: string | null) => void;
};

function SlotRow({ lang, slot, gym, catalog, canWrite, open, onToggle, onChoose }: SlotProps) {
  const T = tr(lang);
  const name = (id: string) => exerciseName(catalog, id, lang);
  const planned = name(slot.programExerciseId);
  const notes: string[] = [];
  if (slot.status === "swapped") notes.push(T(`${planned} is not here`, `«${planned}» нет в зале`));
  if (slot.status === "preferred") {
    notes.push(
      slot.programAvailable
        ? T(`your choice here instead of ${planned}`, `ваш выбор вместо «${planned}»`)
        : T(`your choice; ${planned} is not here`, `ваш выбор; «${planned}» нет в зале`),
    );
  }
  if (slot.status === "stuck") notes.push(T("not here, and no alternative is either: kept as planned", "нет в зале, замен тоже нет: остаётся как в плане"));
  if (slot.preferenceIgnored && slot.preference) {
    notes.push(T(`preferred ${name(slot.preference)} cannot be used here`, `предпочтение «${name(slot.preference)}» здесь недоступно`));
  }
  const options = slot.choices.filter((id) => id !== slot.programExerciseId);
  const chosen = slot.status === "preferred" ? slot.exerciseId : null;
  // what "automatic" means here: the program exercise when it is here, else its first alternative here
  const automatic = resolveSlot({ slotId: slot.slotId, exerciseId: slot.programExerciseId }, { ...gym, preferred: {} }, catalog);
  const panelId = `fit-gym-pref-${slot.slotId}`;
  return (
    <li
      className="fit-gym-slot"
      data-testid="plan-slot"
      data-slot-id={slot.slotId}
      data-exercise-id={slot.exerciseId}
      data-program-exercise-id={slot.programExerciseId}
      data-status={slot.status}
    >
      <div className="fit-gym-slot-line">
        <span className="fit-gym-slot-id fit-num">{slot.slotId}</span>
        <span className="fit-gym-slot-text">
          <span className="fit-gym-slot-name">{name(slot.exerciseId)}</span>
          {notes.length ? <span className="fit-gym-slot-note">{notes.join(" · ")}</span> : null}
        </span>
        {canWrite && options.length ? (
          <button type="button" className="fit-gym-change" aria-expanded={open} aria-controls={panelId} data-testid="pref-open" onClick={onToggle}>
            {open ? T("Close", "Закрыть") : T("Change", "Сменить")}
          </button>
        ) : null}
      </div>
      {open && canWrite ? (
        <div id={panelId} className="fit-gym-choices" role="group" aria-label={T(`Preferred at this gym for ${slot.slotId}`, `Предпочтение в этом зале для ${slot.slotId}`)}>
          <p className="fit-gym-hint">{T("Preferred at this gym", "Предпочтение в этом зале")}</p>
          <div className="fit-seg fit-gym-options">
            <button type="button" aria-pressed={chosen === null} data-testid="pref-option" data-exercise-id="" onClick={() => onChoose(null)}>
              {T("Automatic", "Автоматически")}: {name(automatic)}
            </button>
            {options.map((id) => (
              <button key={id} type="button" aria-pressed={chosen === id} data-testid="pref-option" data-exercise-id={id} onClick={() => onChoose(id)}>
                {name(id)}
                <small>{equipmentShort(catalog.exerciseById(id)?.equipment ?? "", lang)}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function PlanAtGym({ lang, gym, catalog, plan, canWrite, write, preview }: SectionProps & { preview: boolean }) {
  const T = tr(lang);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const total = plan.days.reduce((n, d) => n + d.slots.length, 0);
  const choose = (slot: SlotAtGym, id: string | null) => {
    write((g, now) => preferForSlot(g, { slotId: slot.slotId, exerciseId: slot.programExerciseId }, id, now));
    setOpenSlot(null);
  };
  const summary =
    plan.changed === 0 && plan.stuck === 0
      ? T("Every exercise of your plan is used as written here.", "Все упражнения плана выполняются здесь как написано.")
      : [
          plan.changed ? T(`${plan.changed} of ${total} exercises change here.`, `Замены в этом зале: ${plan.changed} из ${total}.`) : "",
          plan.stuck ? T(`${plan.stuck} have no alternative here and stay as planned.`, `Без замены: ${plan.stuck} — останутся как в плане.`) : "",
        ].filter(Boolean).join(" ");
  return (
    <section className="fit-gym-block" aria-labelledby="fit-gym-plan">
      <h3 id="fit-gym-plan">{T("Your plan at this gym", "Ваш план в этом зале")}</h3>
      {preview ? (
        <p className="fit-gym-hint">
          {T("No program is saved yet: this is the default program the planner starts with.", "Программа ещё не сохранена: это программа по умолчанию, с которой начнёт планировщик.")}
        </p>
      ) : null}
      <p className="fit-gym-summary" role="status">{summary}</p>
      {plan.days.map((day) => (
        <div key={day.key} className="fit-gym-day">
          <h4>{t2(lang, day.name)}</h4>
          <ol className="fit-gym-slots">
            {day.slots.map((slot) => {
              const key = `${day.key}:${slot.slotId}`;
              return (
                <SlotRow
                  key={key}
                  lang={lang}
                  slot={slot}
                  gym={gym}
                  catalog={catalog}
                  canWrite={canWrite}
                  open={openSlot === key}
                  onToggle={() => setOpenSlot(openSlot === key ? null : key)}
                  onChoose={(id) => choose(slot, id)}
                />
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
