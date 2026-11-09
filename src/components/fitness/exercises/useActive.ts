"use client";
/**
 * The active gym and the program slots for the exercise pages (stream 02). Reads the fitness snapshot: the active
 * program's days, or the owner's template (passed from the server) before a program exists; the gym is
 * `settings.activeGymId`. Server render and first paint use the template and no gym.
 */
import { useMemo } from "react";
import { useFitness } from "@/components/fitness/Provider";
import { programSlots } from "@/lib/fitness/catalog-core.mjs";
import type { Gym, Program } from "@/lib/fitness/types";

/** The owner template's days as `[slotId, exerciseId]` pairs (registry `ownerTemplate.days[].slots`). */
export type TemplateDays = readonly { key: string; slots: readonly (readonly [string, string])[] }[];

export type ActiveContext = {
  gym: Gym | null;
  program: Program | null;
  /** exercise id → slot ids ("A1") where it is used, gym swaps included */
  slots: Record<string, string[]>;
};

export function useActive(template: TemplateDays): ActiveContext {
  const { snapshot } = useFitness();
  const program = snapshot.activeProgramId ? (snapshot.programs[snapshot.activeProgramId] ?? null) : null;
  const gymId = snapshot.settings?.activeGymId ?? null;
  const gym = gymId ? (snapshot.gyms[gymId] ?? null) : null;
  const slots = useMemo(() => programSlots(program ? program.days : template, gym), [program, template, gym]);
  return { gym, program, slots };
}

/** Just the active gym (null before the store loads, or when none is chosen). */
export function useActiveGym(): Gym | null {
  const { snapshot } = useFitness();
  const gymId = snapshot.settings?.activeGymId ?? null;
  return gymId ? (snapshot.gyms[gymId] ?? null) : null;
}
