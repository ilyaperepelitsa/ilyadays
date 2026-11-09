/**
 * Fitness section — the shared contract between the engine (.mjs), the store and the UI.
 * Owned by plans/fitness/00-master-plan.md. Add fields; never rename or remove.
 * All loads are kilograms. All timestamps are ISO-8601 strings. All ids are client-generated (uuid or slug).
 */

export type Lang = "en" | "ru";
export type Text2 = { en: string; ru: string };

/* ------------------------------------------------------------------ goals & catalog */

export type TrainingPreferences = {
  secondaryGoals: GoalMode[];
  bodyScope: "upper" | "full" | "custom";
  excludedGroups: string[];
  /** Ordered training priorities; excluded groups can never be focus groups. */
  focusGroups?: string[];
};

export type GoalMode = "strength" | "hypertrophy" | "recomp" | "endurance" | "maintenance";

export type Equipment =
  | "selectorized" // pin-loaded machine
  | "plate-loaded"
  | "cable"
  | "barbell"
  | "dumbbell"
  | "bodyweight"
  | "assisted" // assisted pull-up / dip machine (load = assistance, lower is harder)
  | "smith"
  | "kettlebell"
  | "band";

export type MovementPattern =
  | "horizontal-push" | "incline-push" | "decline-push" | "vertical-push" | "chest-fly"
  | "vertical-pull" | "horizontal-pull" | "pullover" | "rear-delt" | "lateral-raise" | "front-raise"
  | "external-rotation" | "shrug"
  | "elbow-flexion" | "elbow-extension" | "forearm-flexion" | "forearm-extension" | "grip"
  | "trunk-flexion" | "anti-extension" | "anti-rotation" | "rotation" | "lateral-flexion" | "hip-flexion"
  | "spinal-extension" | "hip-hinge" | "squat" | "lunge" | "knee-flexion" | "knee-extension" | "hip-abduction"
  | "hip-adduction" | "calf-raise" | "carry" | "neck" | "hip-extension";

export type MuscleRegion = "front" | "back";

export type MuscleGroup = {
  id: string; // e.g. "pec-major-sternal"
  name: Text2;
  /** Coarse group for volume accounting: chest, back, shoulders, biceps, triceps, forearms, abs, lower-back, legs, calves, glutes, neck */
  group: string;
  region: MuscleRegion;
  function: Text2;
};

export type Exercise = {
  id: string; // kebab-case, e.g. "chest-press-machine"
  name: Text2;
  /** Other names, machine model names (Technogym "Chest Press", Hammer Strength "Iso-Lateral Wide Chest") */
  aka?: string[];
  equipment: Equipment;
  pattern: MovementPattern;
  primary: string[]; // MuscleGroup ids
  secondary: string[];
  difficulty: 1 | 2 | 3;
  unilateral: boolean;
  /** Torso supported (seat/pad): lower-back friendly */
  supported: boolean;
  /** Smallest practical load step in kg on typical equipment of this kind (pin stack 5, microplates 1.25, dumbbell 2) */
  increment: number;
  /** Rep range this movement suits (machines/isolation: higher). In `repUnit` units. */
  repRange: [number, number];
  /** What a "rep" counts for this exercise: reps (default), seconds (holds) or metres (carries). LoggedSet.reps uses the same unit. */
  repUnit?: "reps" | "seconds" | "meters";
  /** Equivalence class id from content/fitness/registry.json (substitution unit) */
  class?: string;
  /** How much the lumbar spine limits/is loaded by this exercise (planner caps moderate/high per session) */
  lowerBackLoad?: "low" | "moderate" | "high";
  /** Loads the primary muscle hardest at long length (preferred within a class) */
  lengthenedBias?: boolean;
  /** Load is assistance (assisted machines): a LOWER number is harder */
  assistance?: boolean;
  /** Short source list for the facts in this entry (title — outlet, year. URL) */
  sources?: string[];
  /** Ordered by similarity: same pattern + primary muscle first, then other equipment */
  alternatives: string[];
  setup?: Text2;
  cues: { en: string[]; ru: string[] };
  mistakes: { en: string[]; ru: string[] };
  /** Rough novice starting working load (kg) for an ~80 kg untrained adult male, with source */
  startLoad?: { kg: number; source: string };
  /** Images under /media/fitness/..., each a 3:2 webp; `angle` like "front", "side", "sequence" */
  images?: { angle: string; src: string; alt: Text2 }[];
  tags?: string[]; // "owner-primary", "pec-priority", "longevity", "legs"
};

/* ------------------------------------------------------------------ program */

export type ProgressionRuleId = "double" | "linear" | "rpe" | "rep-target";

export type ProgressionParams = {
  rule: ProgressionRuleId;
  /** rep window; when the top is hit on every working set at or above target RIR, load goes up */
  repRange: [number, number];
  /** reps in reserve target for working sets */
  rir: number;
  /** % load increase when progressing (used when it beats the equipment increment); typical 2.5–5 */
  stepPct: number;
  /** consecutive failed sessions before a deload */
  failsBeforeDeload: number;
  /** % to drop on deload (e.g. 10) */
  deloadPct: number;
  /** when reps exceed top of range by this many on the first set, take a double step */
  overshootReps: number;
};

export type ExerciseSlot = {
  slotId: string; // stable within a program, e.g. "A1"
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  rir: number;
  restSec: number;
  progression: ProgressionRuleId;
  /** First-in-session, weak-point priority (pec emphasis) */
  priority?: boolean;
  /** Slots sharing a superset id are alternated */
  superset?: string;
  /** Why this slot exists (shown on tap) */
  why?: Text2;
  /** Optional: slot-level override of the exercise's own increment */
  increment?: number;
};

export type ProgramDay = {
  key: string; // "A" | "B" | "C" | "D"
  name: Text2;
  focus: string[]; // coarse muscle groups
  slots: ExerciseSlot[];
  /** Optional conditioning finisher text */
  finisher?: Text2;
};

export type Program = {
  id: string;
  templateId: string;
  name: Text2;
  goal: GoalMode;
  daysPerWeek: 2 | 3 | 4;
  days: ProgramDay[];
  /** sequential: A→B→C→A regardless of calendar */
  rotation: "sequential";
  progression: Record<ProgressionRuleId, ProgressionParams>;
  /** Weeks between planned deload checks (0 = only reactive deloads) */
  deloadEveryWeeks: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  preferences?: TrainingPreferences;
  pivotReason?: string;
  /** false = archived; the newest active program is the active one (fitness_programs.active) */
  active?: boolean;
};

/* ------------------------------------------------------------------ gyms */

export type Gym = {
  id: string;
  name: string;
  /** Exercise ids this gym has. Empty list = assume everything is available. */
  available: string[];
  /** Exercise ids known to be missing (hidden from suggestions) */
  missing: string[];
  /** slotId or exerciseId → the exercise to use instead at this gym */
  preferred: Record<string, string>;
  /** Equipment increments that differ here, e.g. {"lat-pulldown": 2.5} */
  increments?: Record<string, number>;
  notes?: string;
  updatedAt: string;
};

/* ------------------------------------------------------------------ progression memory */

export type Outcome = "init" | "progressed" | "held" | "failed" | "deloaded" | "reset" | "converted";

export type ExerciseState = {
  exerciseId: string;
  workingKg: number;
  targetReps: number; // next session's rep target within repRange
  repRange: [number, number];
  rir: number;
  /** Best estimated 1RM seen, kg */
  e1rm: number;
  lastOutcome: Outcome;
  fails: number; // consecutive failed sessions
  sessions: number; // sessions logged for this exercise
  lastAt: string | null;
  /** Short note for the UI, e.g. "+2.5 kg: all sets hit 12 reps" */
  note?: Text2;
  /** No load increase before this ISO date (the AI adviser's or the owner's "hold"); reps may still rise within
   *  the range, deloads and the failure ladder still apply. Added 2026-11-09, master plan section 16. */
  holdUntil?: string | null;
  /** Set by the engine when progression is stuck at the top: "smaller-steps" (the next load step is too big even at
   *  the rep ceiling; a variant with finer steps or micro-plates) or "harder" (no load to add: bodyweight, band, no
   *  assistance left). Null after a load step. Added 2026-11-09, master plan section 16 rule 2. */
  variant?: "smaller-steps" | "harder" | null;
  /** Plateau memory, set by the engine's reactive deload when it lowers the load: `kg` = the load it came down from,
   *  `times` = deloads from that load, `streak` = sessions in a row since at the planned load with every set at the top
   *  of the range whose sets carry `kg` by the capacity guard (from the second deload with 2 more reps in hand, below
   *  the rep ceiling); test sessions count like any other, a load change (a break's cut too) starts it over. A step
   *  from below `kg` to `kg` or harder waits until the streak reaches min(3, 1 + times). Null after a complete session
   *  at a load harder than `kg` with no set below the range, or after a goal or range conversion; a swap starts
   *  without it. Lives in the row's spec jsonb. Added 2026-11-09, master plan section 16 rule 5. */
  plateau?: { kg: number; times: number; streak: number } | null;
  /** Per-exercise observed baseline; never inferred from another muscle or exercise. In spec JSONB. */
  baseline?: { status: "learning" | "established"; kg?: number; reps?: number; rir?: number; at?: string; sessionId?: string; sets?: number };
  updatedAt: string;
};

/* ------------------------------------------------------------------ sessions & sets */

export type SetKind = "warmup" | "working" | "backoff" | "amrap";

export type SetPrescription = {
  kind: SetKind;
  weightKg: number;
  reps: number;
  rir?: number;
};

export type PlannedExercise = {
  slotId: string;
  /** The exercise actually planned at this gym (after substitution) */
  exerciseId: string;
  /** The exercise the program slot names (for history continuity) */
  programExerciseId: string;
  sets: SetPrescription[];
  restSec: number;
  calibration?: boolean;
  repRange?: [number, number];
  loadStep?: number;
  superset?: string;
  /** Alternatives available at this gym, ordered */
  alternatives: string[];
  note?: Text2;
};

export type PlannedSession = {
  dayKey: string;
  dayName: Text2;
  exercises: PlannedExercise[];
  /** Rough minutes */
  estimatedMinutes: number;
  warmup: Text2;
  finisher?: Text2;
};

export type SessionStatus = "active" | "finished" | "auto_closed" | "abandoned";

export type Readiness = { sleep?: 1 | 2 | 3 | 4 | 5; energy?: 1 | 2 | 3 | 4 | 5; soreness?: 1 | 2 | 3 | 4 | 5 };

export type Session = {
  id: string;
  programId: string;
  dayKey: string;
  gymId: string | null;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  bodyweightKg?: number | null;
  readiness?: Readiness;
  /** Frozen start context, also used after reload and when evaluating this workout. */
  plan?: { version: 1; program: Program; gym: Gym | null; states: Record<string, ExerciseState>; prescription: PlannedSession };
  notes?: string;
  updatedAt: string;
};

export type LoggedSet = {
  id: string;
  sessionId: string;
  slotId: string;
  exerciseId: string; // performed exercise
  setIndex: number; // 0-based within the exercise, warm-ups included
  kind: SetKind;
  plannedKg: number;
  plannedReps: number;
  /** Effective suggestion and its source; original prescription remains in Session.plan. */
  prescription?: { version: 1; targetRir: number | null; rirReported: boolean; suggestedKg: number; suggestedReps: number; reason?: "repeat" | "reduce" | "easy"; basedOnSetId?: string };
  kg: number;
  reps: number;
  rir: number | null;
  doneAt: string;
  updatedAt: string;
};

export type MeasurementSite = "waist" | "chest" | "hips" | "neck" | "left-biceps" | "right-biceps" | "left-forearm" | "right-forearm" | "left-thigh" | "right-thigh" | "left-calf" | "right-calf";
export type BodyMeasurementEntry = { id: string; at: string; values: Partial<Record<MeasurementSite, number>>; note?: string; updatedAt: string };

export type BodyweightEntry = {
  id: string;
  at: string; // ISO date-time of the weigh-in
  kg: number;
  bodyFatPct?: number | null;
  note?: string;
  updatedAt: string;
};

export type AdjustmentSource = "ai" | "engine" | "manual";

export type Adjustment = {
  id: string;
  at: string;
  source: AdjustmentSource;
  /** What was asked / observed */
  input: Record<string, unknown>;
  /** What was proposed (advisor schema) */
  output: Record<string, unknown>;
  applied: boolean;
  updatedAt: string;
};

/* ------------------------------------------------------------------ settings & snapshot */

export type Settings = {
  goal: GoalMode;
  daysPerWeek: 2 | 3 | 4;
  bodyweightKg?: number;
  heightCm?: number;
  birthYear?: number;
  sex?: "male" | "female";
  activeGymId: string | null;
  unit: "kg";
  trainingPreferences?: TrainingPreferences;
  profileName?: string;
  /** Rest timer defaults */
  restTimer: boolean;
  /** Minutes after which an active session auto-closes */
  autoCloseHours: 6;
  updatedAt: string;
};

export type Table =
  | "programs"
  | "gyms"
  | "sessions"
  | "sets"
  | "exercise_state"
  | "bodyweight"
  | "measurements"
  | "adjustments"
  | "settings";

export type RowOf<T extends Table> =
  T extends "programs" ? Program
  : T extends "gyms" ? Gym
  : T extends "sessions" ? Session
  : T extends "sets" ? LoggedSet
  : T extends "exercise_state" ? ExerciseState
  : T extends "measurements" ? BodyMeasurementEntry
  : T extends "bodyweight" ? BodyweightEntry
  : T extends "adjustments" ? Adjustment
  : T extends "settings" ? Settings
  : never;

export type Snapshot = {
  programs: Record<string, Program>;
  /** id of the active program (latest version) */
  activeProgramId: string | null;
  gyms: Record<string, Gym>;
  sessions: Record<string, Session>;
  sets: Record<string, LoggedSet>;
  exerciseState: Record<string, ExerciseState>; // keyed by exerciseId
  bodyweight: Record<string, BodyweightEntry>;
  measurements: Record<string, BodyMeasurementEntry>;
  adjustments: Record<string, Adjustment>;
  settings: Settings | null;
  /** Last successful remote sync */
  syncedAt: string | null;
  /** Pending outbox entries */
  pending: number;
};

export type StoreMode = "loading" | "local" | "synced" | "viewer";

export interface FitnessStore {
  getSnapshot(): Snapshot;
  subscribe(onChange: () => void): () => void;
  /** Writes locally at once (and to the outbox in synced mode). No-op with a console warning in viewer mode. */
  upsert<T extends Table>(table: T, row: RowOf<T>): void;
  remove(table: Exclude<Table, "settings">, id: string): void;
  /** Pull the viewed user's rows from Supabase and merge (last writer wins by updatedAt). */
  refresh(): Promise<void>;
  /** Push the outbox now. Resolves when done or when offline. */
  flush(): Promise<void>;
  mode(): StoreMode;
  canWrite(): boolean;
}

/* ------------------------------------------------------------------ LLM (advisor) */

export type LlmCall = {
  name: string;
  developer: string;
  user: string;
  schema: Record<string, unknown>;
};
