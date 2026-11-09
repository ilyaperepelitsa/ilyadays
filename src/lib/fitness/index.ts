/** Public fitness engine API. UI code may import leaf modules to keep each route's bundle small. */
export type * from "./types";

export { EXERCISES, MUSCLES, GROUPS, exerciseById, alternativesFor, exercisesForMuscle, equipmentLabel, patternLabel } from "./catalog.mjs";
export { GOAL_MODES, TEMPLATES, buildProgram, convertProgram, withLegs, slotParams, slotRole } from "./templates.mjs";
export { roundLoad, warmupRamp, initialState, nextState, gapAdjust, convertState, substituteState } from "./progression.mjs";
export { nextDayKey, planSession, sessionStatus, summarize, applySession } from "./session.mjs";
export { e1rm, weeklyVolumeByGroup, ewma, theilSen, banister, acwrEwma, forecast, prs } from "./analytics.mjs";
export { bmrMifflin, bmrKatch, tdee, proteinTarget, energyTarget, weeksToGoal, nutritionPlan, vo2maxCooper, vo2maxUth } from "./nutrition.mjs";
export { adjustCall, validateProposal, applyProposal, applyAdjustment } from "./advisor.mjs";
