/** Constantinople Days — embeddable build (dist/app.js + dist/app.css). Copied to dist/app.d.ts by build/assemble.py. */

export type Lang = "en" | "ru";

/** One saved route of a day. `n` 0 is the original itinerary (never stored); saved versions start at 1. */
export interface TripStop {
  id: string;            // place id from the catalog
  note?: string;
  legNote?: string;
  dur?: number;          // minutes at the stop
  pause?: number;        // extra break minutes (smart re-plan)
  via?: "walk" | "ferry" | "taxi";
  purpose?: "scenic" | "heritage" | "link" | "food" | "transit";
}
export interface TripVersion {
  n: number;
  label: string;
  mode: "plan" | "keep" | "optimize" | "smart";
  created: number;       // epoch ms
  start: string;         // "HH:MM"
  stops: TripStop[];
  summary?: string;
}
export interface TripDayState {
  versions: TripVersion[];
  active: number;        // n of the chosen version (0 = original plan)
  draft: { stops: TripStop[]; start: string; from: number } | null; // owner's unsaved edit; ignored when read-only
}

/** Everything the owner's progress consists of. Each top-level key is saved separately. */
export interface TripData {
  visited: Record<string, { t: number }>;      // place id -> when it was ticked (epoch ms)
  ideas: string[];                             // place ids, in the order they were starred
  dayOrder: Record<string, string[]>;          // scenario id ("4d" | "2d") -> day ids in the chosen order
  days: Record<string, TripDayState>;          // day id ("4d-1" …) -> versions, chosen version, draft
  tripStart: string;                           // "YYYY-MM-DD" or ""
}
export type TripKey = keyof TripData;

export interface TripStorage {
  /** Resolve with whatever keys exist (missing keys fall back to defaults). Rejecting shows the plan without progress. */
  load(): Promise<Partial<TripData>>;
  /** Called only when editable, debounced (~300 ms), once per changed key. Reject to show "Sync failed". */
  save<K extends TripKey>(key: K, value: TripData[K]): Promise<void>;
  /** Optional live updates (e.g. Supabase realtime). Return an unsubscribe function. */
  subscribe?(onData: (data: Partial<TripData>) => void): (() => void) | void;
}

export interface MountOptions {
  /** Initial language. Default: ?lang= in the URL, then localStorage "site-lang" (set only by the EN/RU switch), then English. */
  lang?: Lang;
  /** Default: window.claude db (inside claude.ai) else localStorage keys "cdays:<key>". */
  storage?: TripStorage;
  /** false = visitor mode: shows the owner's ticks and chosen versions; nothing that changes saved data. Default true. */
  editable?: boolean;
  /** Fired when the user clicks EN/RU in the app (not for setLang()). The app also writes localStorage "site-lang". */
  onLangChange?(lang: Lang): void;
  /** If given, read-only mode shows a "Sign in" button that calls it. */
  onSignIn?(): void;
}

export interface TripHandle {
  /** Resolves once Leaflet is loaded, storage.load() has settled and the first render is done. */
  ready: Promise<void>;
  setLang(lang: Lang): void;
  setEditable(editable: boolean): void;
  /** Re-run storage.load() and re-render (e.g. after sign-in). */
  reload(): Promise<void>;
  /** Flush pending saves, remove the map, listeners and markup. */
  destroy(): void;
}

export function mount(el: HTMLElement, options?: MountOptions): TripHandle;
export default mount;
