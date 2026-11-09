/**
 * One gym (stream 05): name with rename, "Use this gym" (settings.activeGymId), quick setup, the equipment list,
 * the plan at this gym with preferences, weight steps, notes and delete (two taps). Read-only without canWrite.
 */
import { useMemo, useState } from "react";
import type { Gym, Lang } from "@/lib/fitness/types";
import { planAtGym, renameGym, type GymCatalog, type PlanLike } from "@/lib/fitness/gyms-core.mjs";
import { EquipmentList } from "./EquipmentList";
import { GymNotes } from "./GymNotes";
import { PlanAtGym } from "./PlanAtGym";
import { QuickSetup } from "./QuickSetup";
import { WeightSteps } from "./WeightSteps";
import { type GroupInfo, type GymWrite, tr } from "./shared";

type Props = {
  lang: Lang;
  gym: Gym;
  catalog: GymCatalog;
  groups: readonly GroupInfo[];
  program: PlanLike;
  /** true when `program` is the default template (no program saved yet) */
  preview: boolean;
  isActive: boolean;
  canWrite: boolean;
  write: GymWrite;
  onUse: () => void;
  onDelete: () => void;
};

function GymHeader({ lang, gym, isActive, canWrite, write, onUse }: Pick<Props, "lang" | "gym" | "isActive" | "canWrite" | "write" | "onUse">) {
  const T = tr(lang);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="fit-gym-head">
      <div className="fit-gym-title">
        <h2 id="fit-gym-name">{gym.name}</h2>
        {canWrite && draft == null ? (
          <button type="button" className="fit-gym-link" data-testid="gym-rename" onClick={() => setDraft(gym.name)}>
            {T("Rename", "Переименовать")}
          </button>
        ) : null}
      </div>
      {draft != null && canWrite ? (
        <form
          className="fit-gym-form"
          onSubmit={(e) => {
            e.preventDefault();
            write((g, now) => renameGym(g, draft, now));
            setDraft(null);
          }}
        >
          <label className="fit-gym-field">
            <span>{T("New name", "Новое название")}</span>
            <input
              type="text"
              value={draft}
              maxLength={60}
              autoComplete="off"
              enterKeyHint="done"
              data-testid="gym-rename-input"
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <div className="fit-gym-actions">
            <button type="submit" className="fit-button" disabled={!draft.trim()}>{T("Save", "Сохранить")}</button>
            <button type="button" className="fit-button quiet" onClick={() => setDraft(null)}>{T("Cancel", "Отмена")}</button>
          </div>
        </form>
      ) : null}
      {isActive ? (
        <p className="fit-gym-active">
          <span aria-hidden="true">✓ </span>
          {T("Active gym: today's plan and the tracker use it.", "Текущий зал: план и тренировка учитывают его.")}
        </p>
      ) : canWrite ? (
        <button type="button" className="fit-button fit-gym-use" data-testid="gym-use" onClick={onUse}>
          {T("Use this gym", "Выбрать этот зал")}
        </button>
      ) : null}
    </div>
  );
}

function DeleteGym({ lang, name, onDelete }: { lang: Lang; name: string; onDelete: () => void }) {
  const T = tr(lang);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <div className="fit-gym-danger">
        <button type="button" className="fit-button ghost" data-testid="gym-delete" onClick={() => setConfirming(true)}>
          {T("Delete gym", "Удалить зал")}
        </button>
      </div>
    );
  }
  return (
    <div className="fit-gym-danger">
      <div className="fit-note warn fit-gym-confirm" role="group" aria-labelledby="fit-gym-delete-q">
        <p id="fit-gym-delete-q">
          {T(
            `Delete “${name}”? Its equipment marks, preferences and notes go; past workouts stay.`,
            `Удалить «${name}»? Отметки оборудования, предпочтения и заметки удалятся; прошлые тренировки останутся.`,
          )}
        </p>
        <div className="fit-gym-actions">
          <button type="button" className="fit-button" data-testid="gym-delete-confirm" onClick={onDelete}>
            {T("Delete", "Удалить")}
          </button>
          <button type="button" className="fit-button quiet" onClick={() => setConfirming(false)}>
            {T("Keep", "Оставить")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GymEditor({ lang, gym, catalog, groups, program, preview, isActive, canWrite, write, onUse, onDelete }: Props) {
  const T = tr(lang);
  const plan = useMemo(() => planAtGym(program, gym, catalog), [program, gym, catalog]);
  const section = { lang, gym, catalog, plan, canWrite, write };
  return (
    <section className="fit-card fit-gym-editor" aria-labelledby="fit-gym-name" data-gym-id={gym.id}>
      <GymHeader lang={lang} gym={gym} isActive={isActive} canWrite={canWrite} write={write} onUse={onUse} />
      <a className="fit-gym-jump" href="#fit-gym-plan">
        {plan.changed
          ? T(`Your plan here: ${plan.changed} ${plan.changed === 1 ? "swap" : "swaps"} ↓`, `Ваш план здесь: замен ${plan.changed} ↓`)
          : T("Your plan here ↓", "Ваш план здесь ↓")}
      </a>
      {canWrite ? <QuickSetup lang={lang} gym={gym} catalog={catalog} canWrite={canWrite} write={write} /> : null}
      <EquipmentList {...section} groups={groups} />
      <PlanAtGym {...section} preview={preview} />
      <WeightSteps {...section} />
      <GymNotes lang={lang} gym={gym} canWrite={canWrite} write={write} />
      {canWrite ? <DeleteGym lang={lang} name={gym.name} onDelete={onDelete} /> : null}
    </section>
  );
}
