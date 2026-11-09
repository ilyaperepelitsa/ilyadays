/** A walking-trip template and the document a model fills in. */

export type Pace = "linger" | "rapid";

export type TripBrief = {
  city: string;
  /** Inclusive destination-local calendar dates; absent on undated/legacy trips. */
  stayStart?: string;
  stayEnd?: string;
  /** Explicit destination IANA timezone; required for source-confirmed event scheduling. */
  timeZone?: string;
  routes: number;
  hours: number;
  placesPerRoute: number;
  foodBreaks: number;
  pace: Pace;
  sharedSpine: boolean;
  /** Food, bars, shops, and mood. Empty when the walker named none. */
  preferences: string;
  /** Places to pass through on some day, not pinned to one route. */
  wishes: string[];
};

export type Theme = {
  title: string;
  description: string;
  titleRu: string;
  descriptionRu: string;
};

export type StopKind = "sight" | "food";

export type DraftStop = {
  id: string;
  name: string;
  local: string;
  /** What to type into a map's search box to land on this place. Trips saved before it existed lack it. */
  search?: string;
  lat: number;
  lon: number;
  minutes: number;
  kind: StopKind;
  why: string;
  whyRu: string;
  /** The walker's phrase, when this stop is one they asked to pass through. */
  wish: string;
};

export type NoteKind = "build" | "events" | "literature" | "film" | "keeps";

export type CreditImage = {
  thumb: string;
  page: string;
  author: string;
  license: string;
};

export type TripNote = {
  kind: NoteKind;
  en: string;
  ru: string;
  image?: CreditImage;
};

export type PlaceFacts = {
  access: { en: string; ru: string };
  days: { en: string; ru: string };
  hours: string;
  wikiTitle: string;
  spotSearch: string;
  notes: { kind: NoteKind; en: string; ru: string }[];
};

export type TripPlace = DraftStop & {
  hours: string;
  access: { en: string; ru: string };
  days: { en: string; ru: string };
  wiki: { en: string; ru?: string };
  photo?: CreditImage;
  notes: TripNote[];
};

export type Spine = { name: string; why: string; whyRu: string };

export type TripEvent = {
  id: string; name: string; venue: string; address: string; city: string;
  kind: "concert" | "exhibition" | "event";
  availableFrom: string; availableThrough: string;
  fixedTime: string; durationMinutes: number | null; timeZone: string; utcOffset?: string;
  sourceUrl: string; ticketUrl?: string; verifiedAt: string; startsAt?: string; endsAt?: string;
};
export type TripCommitment = {
  event: TripEvent; date: string; visitTime: string; durationMinutes: number; acceptedAt: string; startsAt?: string; endsAt?: string;
};
export type ScheduledStop = { stopId: string; start: string; end: string };
export type TripRoute = { theme: Theme; stops: TripPlace[]; date?: string; schedule?: ScheduledStop[] };

export type SavedTrip = {
  id: string;
  created: string;
  city: string;
  brief: TripBrief;
  spine: Spine | null;
  routes: TripRoute[];
  commitments?: TripCommitment[];
  revisionOf?: string;
};

export type LlmCall = {
  name: string;
  developer: string;
  user: string;
  schema: Record<string, unknown>;
  webSearch?: boolean;
};

export type Outline = { spine: Spine | null; routes: DraftStop[][] };
