/**
 * Bilingual texts for the program page (stream 10): prescriptions ("4 × 6–10 · RIR 2 · rest 2:30"), loads
 * ("assistance 30 kg", "12 kg per hand"), next-session targets and goal-mode parameters.
 */
import type { Exercise, ExerciseSlot, Lang, PlannedExercise } from "@/lib/fitness/types";
import { fmtClock, fmtKg, kgLabel, pick } from "@/lib/fitness/i18n";

export type RepUnit = "reps" | "seconds" | "meters";

export const unitOfExercise = (exercise: Exercise | undefined | null): RepUnit => exercise?.repUnit ?? "reps";

/** 2.5 → "2.5" (EN) / "2,5" (RU): percentages and steps in the reader's notation. */
export const fmtNum = (n: number, lang: Lang) => fmtKg(n, lang);

/** "6–10 reps", "20–40 s", "30 m" */
export function rangeText(range: readonly [number, number] | readonly number[], unit: RepUnit, lang: Lang): string {
  const span = range[0] === range[1] ? `${range[0]}` : `${range[0]}–${range[1]}`;
  if (unit === "seconds") return `${span}\u00a0${pick(lang, "s", "с")}`;
  if (unit === "meters") return `${span}\u00a0${pick(lang, "m", "м")}`;
  return `${span}\u00a0${pick(lang, "reps", "повт.")}`;
}

/** "4 × 6–10 reps · RIR 2 · rest 2:30" */
export function prescriptionText(slot: ExerciseSlot, unit: RepUnit, lang: Lang): string {
  return `${slot.sets}\u00a0× ${rangeText(slot.repRange, unit, lang)} · ${pick(lang, "RIR", "запас")}\u00a0${slot.rir} · ${pick(lang, "rest", "отдых")}\u00a0${fmtClock(slot.restSec)}`;
}

/**
 * How a load reads for this exercise: "60 kg", "assistance 30 kg", "bodyweight + 5 kg", "12 kg per hand", and for
 * plate-loaded machines "60 kg (plates, both sides)": the plates on both sides together, without the sled (master plan
 * §16, the tracker's wording).
 */
export function loadText(kg: number, exercise: Exercise | undefined | null, lang: Lang): string {
  const k = `${fmtKg(kg, lang)} ${kgLabel(lang)}`;
  if (!exercise) return k;
  if (exercise.equipment === "plate-loaded") return pick(lang, `${k} (plates, both sides)`, `${k} (блины с обеих сторон)`);
  if (exercise.assistance === true || exercise.equipment === "assisted") {
    return kg > 0 ? pick(lang, `assistance ${k}`, `помощь ${k}`) : pick(lang, "no assistance", "без помощи");
  }
  if (exercise.equipment === "bodyweight") return kg > 0 ? pick(lang, `bodyweight + ${k}`, `свой вес + ${k}`) : pick(lang, "bodyweight", "свой вес");
  if (exercise.equipment === "band") return pick(lang, "band", "резина");
  if (exercise.equipment === "dumbbell" || exercise.equipment === "kettlebell" || exercise.pattern === "carry") return pick(lang, `${k} per hand`, `${k} на руку`);
  return k;
}

/** Working sets of a planned exercise in gym notation: "4 × 8 · 60 kg", "2 × 30 m · 16 kg per hand", "3 × 9 · assistance 30 kg". */
export function targetText(planned: PlannedExercise | undefined, exercise: Exercise | undefined | null, lang: Lang): string | null {
  const work = planned?.sets.filter((s) => s.kind !== "warmup") ?? [];
  const first = work[0];
  if (!first) return null;
  const unit = unitOfExercise(exercise);
  const amount = unit === "reps" ? `${first.reps}` : rangeText([first.reps, first.reps], unit, lang);
  const loaded = first.weightKg > 0 || exercise?.equipment === "bodyweight" || exercise?.equipment === "assisted" || exercise?.assistance === true;
  const sets = `${work.length} × ${amount}`;
  return loaded ? `${sets} · ${loadText(first.weightKg, exercise, lang)}` : sets;
}

/** Stepper labels for the two ends of a range in the slot's unit. */
export function rangeLabels(unit: RepUnit, lang: Lang): [string, string] {
  if (unit === "seconds") return [pick(lang, "Seconds from", "Секунды от"), pick(lang, "Seconds to", "Секунды до")];
  if (unit === "meters") return [pick(lang, "Metres from", "Метры от"), pick(lang, "Metres to", "Метры до")];
  return [pick(lang, "Reps from", "Повторы от"), pick(lang, "Reps to", "Повторы до")];
}

/** 150 → "2:30" */
export const restText = (sec: number) => fmtClock(sec);
