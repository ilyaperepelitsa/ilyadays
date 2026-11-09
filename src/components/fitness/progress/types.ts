/** What the server view passes to the progress panel (stream 06): a trimmed catalog, so no exercise JSON ships. */
import type { Text2 } from "@/lib/fitness/types";

export type RepUnit = "reps" | "seconds" | "meters";

export type ProgressExercise = {
  name: Text2;
  /** Coarse muscle groups: 1 direct, 0.5 indirect (stream 03 groupWeights: catalog muscles, else the pattern map) */
  groups: Record<string, number>;
  unit: RepUnit;
  equipment?: string;
  /** Load is assistance: lower is harder */
  assistance?: boolean;
  pattern?: string;
};

export type ProgressCatalog = Record<string, ProgressExercise>;

/** Coarse group in display order (catalog GROUPS) */
export type ProgressGroup = { id: string; name: Text2 };
