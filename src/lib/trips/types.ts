/** A walking-trip template and the document a model fills in. */

export type Pace = "linger" | "rapid";

export type TripBrief = {
  city: string;
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

export type TripRoute = { theme: Theme; stops: TripPlace[] };

export type SavedTrip = {
  id: string;
  created: string;
  city: string;
  brief: TripBrief;
  spine: Spine | null;
  routes: TripRoute[];
};

export type LlmCall = {
  name: string;
  developer: string;
  user: string;
  schema: Record<string, unknown>;
};

export type Outline = { spine: Spine | null; routes: DraftStop[][] };
