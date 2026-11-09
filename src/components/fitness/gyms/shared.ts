/**
 * Shared props and helpers of the gym screen (stream 05 — plans/fitness/05-gym-profiles.md). Exercise data is the
 * trimmed catalog from the server view; gym logic lives in src/lib/fitness/gyms-core.mjs (import-free).
 */
import type { Gym, Lang, Text2 } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import type { GymCatalog, GymPlan, PlanDay } from "@/lib/fitness/gyms-core.mjs";

/** A coarse muscle group in display order (registry `groups`). */
export type GroupInfo = { id: string; name: Text2 };

/** Template days per day count ("2", "3", "4"), shown while no program is saved. */
export type PreviewDays = Readonly<Record<string, readonly PlanDay[]>>;

/** Apply a pure change to the CURRENT stored row of this gym (no-op when it returns the same object or cannot write). */
export type GymWrite = (change: (gym: Gym, now: string) => Gym) => void;

/** What every section of the editor gets. */
export type SectionProps = {
  lang: Lang;
  gym: Gym;
  catalog: GymCatalog;
  plan: GymPlan;
  canWrite: boolean;
  write: GymWrite;
};

/** Exercise name in the page language (the id when the catalog does not know it). */
export function exerciseName(catalog: GymCatalog, id: string, lang: Lang): string {
  const e = catalog.exerciseById(id);
  if (!e) return id;
  return lang === "ru" ? e.name.ru || e.name.en : e.name.en;
}

/** `pick` bound to a language: `const T = tr(lang); T("Here", "Есть")`. */
export const tr = (lang: Lang) => (en: string, ru: string) => pick(lang, en, ru);

/** Plan context per exercise: slot ids that name it, slot ids that use it here, and what replaces it here. */
export type PlanUse = { program: string[]; used: string[]; replacedBy: string | null };

export function planUses(plan: GymPlan): Map<string, PlanUse> {
  const out = new Map<string, PlanUse>();
  const entry = (id: string) => {
    let e = out.get(id);
    if (!e) {
      e = { program: [], used: [], replacedBy: null };
      out.set(id, e);
    }
    return e;
  };
  for (const day of plan.days) {
    for (const s of day.slots) {
      const p = entry(s.programExerciseId);
      if (!p.program.includes(s.slotId)) p.program.push(s.slotId);
      const u = entry(s.exerciseId);
      if (!u.used.includes(s.slotId)) u.used.push(s.slotId);
      if (s.exerciseId !== s.programExerciseId) p.replacedBy ??= s.exerciseId;
    }
  }
  return out;
}
