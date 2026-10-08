/** Typed door to the trip template. The steps themselves live in the .mjs modules. */

import { parseBrief as parseBriefJs, LIMITS as LIMITS_JS, DEFAULT_BRIEF as DEFAULT_JS, TripShapeError as ShapeError } from "./brief.mjs";
import { themeCall as themeCallJs, outlineCall as outlineCallJs, notesCall as notesCallJs } from "./prompts.mjs";
import { parseThemes as parseThemesJs, parseOutline as parseOutlineJs, parseNotes as parseNotesJs, mapsUrl as mapsUrlJs, completeTheme as completeThemeJs } from "./parse.mjs";
import { isFreeLicense as isFreeJs, shortAuthor as shortAuthorJs, enrichStop as enrichStopJs } from "./enrich.mjs";
import { suggestThemes as suggestJs, buildTrip as buildJs } from "./generate.mjs";
import { completeJson as completeJs } from "./openai.mjs";
import { tripErrorKey as tripErrorKeyJs } from "./errors.mjs";
import {
  readAiKey as readKeyJs,
  writeAiKey as writeKeyJs,
  readModel as readModelJs,
  writeModel as writeModelJs,
  readEffort as readEffortJs,
  writeEffort as writeEffortJs,
  listTrips as listJs,
  loadTrip as loadJs,
  saveTrip as saveJs,
  deleteTrip as deleteJs,
  subscribeTrips as subscribeTripsJs,
  subscribePrefs as subscribePrefsJs,
} from "./store.mjs";
import type { DraftStop, LlmCall, PlaceFacts, SavedTrip, Theme, TripBrief, TripPlace } from "./types";

export type { CreditImage, DraftStop, NoteKind, Pace, PlaceFacts, SavedTrip, Spine, StopKind, Theme, TripBrief, TripNote, TripPlace, TripRoute } from "./types";

export const LIMITS = LIMITS_JS as { routes: [number, number]; hours: [number, number]; places: [number, number]; food: [number, number] };
export const DEFAULT_BRIEF = DEFAULT_JS as TripBrief;
export const TripShapeError = ShapeError as new (code: string) => Error & { code: string };

export const parseBrief = parseBriefJs as (input: unknown) => TripBrief;
export const themeCall = themeCallJs as (brief: TripBrief) => LlmCall;
export const outlineCall = outlineCallJs as (brief: TripBrief, themes: Theme[]) => LlmCall;
export const notesCall = notesCallJs as (brief: TripBrief, stops: DraftStop[]) => LlmCall;
export const parseThemes = parseThemesJs as (raw: unknown, count: number) => Theme[];
export const completeTheme = completeThemeJs as (raw: Record<string, unknown>) => Theme;
export const parseOutline = parseOutlineJs as (raw: unknown, brief: TripBrief) => { spine: SavedTrip["spine"]; routes: DraftStop[][] };
export const parseNotes = parseNotesJs as (raw: unknown, stops: DraftStop[]) => Map<string, PlaceFacts>;
export const mapsUrl = mapsUrlJs as (stops: { lat: number; lon: number }[]) => string;
export const isFreeLicense = isFreeJs as (license: string) => boolean;
export const shortAuthor = shortAuthorJs as (raw: string) => string;
export const enrichStop = enrichStopJs as (stop: DraftStop, facts: PlaceFacts, city: string) => Promise<TripPlace>;
export const suggestThemes = suggestJs as (brief: TripBrief, client: (call: LlmCall) => Promise<unknown>) => Promise<Theme[]>;
export const buildTrip = buildJs as (input: {
  brief: TripBrief;
  themes: Theme[];
  client: (call: LlmCall) => Promise<unknown>;
  enrich: (stop: DraftStop, facts: PlaceFacts, city: string) => Promise<TripPlace>;
  id: string;
  created: string;
  onProgress?: (event: { stage: string; done: number; total: number }) => void;
  pauseMs?: number;
  wait?: (ms: number) => Promise<void>;
}) => Promise<SavedTrip>;
export const tripErrorKey = tripErrorKeyJs as (code: string) =>
  | "tripNeedCity" | "tripNeedKey" | "tripNeedThemes"
  | "tripErrCounts" | "tripErrCoords" | "tripErrNotes" | "tripErrSpine"
  | "tripErrWishes" | "tripErrPreferences" | "tripErrRoutes" | "tripErrHours"
  | "tripErrPlaces" | "tripErrFood" | "tripErrPace" | "tripErrLength" | "tripErrGeneric";
export const completeJson = completeJs as (key: string, model: string, effort: string, call: LlmCall) => Promise<unknown>;
export const readAiKey = readKeyJs as () => string;
export const writeAiKey = writeKeyJs as (key: string) => void;
export const readModel = readModelJs as () => string;
export const writeModel = writeModelJs as (model: string) => void;
export const readEffort = readEffortJs as () => string;
export const writeEffort = writeEffortJs as (effort: string) => void;
export const listTrips = listJs as () => SavedTrip[];
export const subscribeTrips = subscribeTripsJs as (onChange: () => void) => () => void;
export const subscribePrefs = subscribePrefsJs as (onChange: () => void) => () => void;
export const loadTrip = loadJs as (id: string) => SavedTrip | null;
export const saveTrip = saveJs as (trip: SavedTrip) => void;
export const deleteTrip = deleteJs as (id: string) => void;
