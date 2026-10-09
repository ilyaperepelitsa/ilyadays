// Recipe content, read at build time from content/<lang>/*.json (written by ../recipes/export_json.py via
// scripts/sync-content.sh). Server-only: every page that uses it is statically generated.
import fs from "node:fs";
import path from "node:path";
import { type Lang } from "./i18n";
import { foodHref, media } from "./paths";

export { foodHref, media };

const ROOT = path.join(process.cwd(), "content");

export type Chip = { text: string; html?: string; kind: "" | "time" };
export type Hero = { image: string | null; svg_fallback: string | null; alt: string };
export type Note = { title_html: string; html: string };

export type RecipeSummary = {
  slug: string;
  kind: "recipe" | "reference";
  title: string;
  group: string;
  group_id: string;
  blurb_html: string;
  description: string;
  yields: string;
  total: string;
  chips: Chip[];
  hero: Hero;
  share_image: string;
  /** When it went up ("2026-10-07 12:00"), from ../recipes content.ADDED. */
  added: string | null;
};

export type FoodIndex = {
  title: string;
  lede_html: string;
  description: string;
  share_image: string;
  footer: string;
  groups: { id: string; name: string; items: string[]; notes: Note[] }[];
  /** Newest slugs first (the home page's "Recently added"). */
  recent: string[];
  recipes: RecipeSummary[];
};

export type Mise = {
  name: string;
  items_html: string;
  items: string[];
  as_list: boolean;
  goes_in: string;
  vessel: string;
  image: string | null;
  svg_fallback: string | null;
};

export type Timeline = {
  tasks: { label: string; label_html: string; start: number; dur: number; dur_label: string; kind: string }[];
  end: number;
  tick_step: number;
  hours: boolean;
  unit: string;
  ticks: { at: number; label: string }[];
  legend: { kind: string; label: string }[];
  note_html: string;
};

export type Step = {
  n: number;
  id: string;
  title: string;
  part: string | null;
  part_id: string | null;
  heat: { label: string; label_html: string; off: boolean } | null;
  time: string;
  time_html: string | null;
  body_html: string;
  uses_rows: { name_html: string; amount_html: string }[];
  images: {
    photo: string | null;
    how: { src: string; caption: string }[];
    result: string | null;
    illustration: string | null;
    svg_fallback: string | null;
    /** Kept under the generated pictures on recipes with Recipe.diagrams (hand positions etc.). */
    diagram?: string | null;
    alt: string;
  };
};

export type VinegarOption = { amount: string; label: string; name: string; name_lc: string; sugar: string; water: string };

/** Batch calculator for a vinegar mix: one recipe's worth per vinegar (see recipes/src/vinegar.py batch()). */
export type Batch = {
  mirin_ml: number;
  jars_ml: number[];
  kinds: Record<string, { vinegar_ml: number; water_ml: number; sugar_g: number; use_ml: number }>;
  text: Record<string, string>;
};

/** The portions control (recipes/src/quantities.py scale_info): people, batches, or none (nothing scales). */
export type Scale = {
  mode: "people" | "batch" | "none";
  serves: number;
  scalable: boolean;
  size: string;
  text: Record<string, string>;
};

export type Recipe = {
  slug: string;
  title: string;
  description: string;
  blurb_html: string;
  group: { id: string; name: string };
  intro_html: string;
  yields: string;
  total: string;
  chips: Chip[];
  hero: Hero;
  share_image: string;
  before_ingredients_html: string | null;
  ingredients: { name: string; items: { name_html: string; amount_html: string }[] }[];
  equipment_html: string[];
  vinegar_options: Record<string, VinegarOption> | null;
  batch: Batch | null;
  scale: Scale;
  mise: Mise[];
  timeline: Timeline | null;
  parts: { id: string; title: string }[];
  steps: Step[];
  notes: Note[];
  sources: { label: string; url: string }[];
  original: { label: string; text: string } | null;
  siblings: { slug: string; title: string }[];
  more_label: string;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

export type SousVide = {
  slug: string;
  title: string;
  description: string;
  group: { id: string; name: string };
  intro_html: string;
  tables: {
    id: string;
    title: string;
    cols: { label_html: string; numeric: boolean }[];
    rows: string[][];
    after_html: string[];
    /** Generated picture of the table's food, finished (imagegen/recipes/sous_vide.py). */
    image?: string | null;
  }[];
  pdf: { src: string; title: string; subtitle: string; open: string; download: string; fallback: string };
  hero: Hero;
  share_image: string;
};

/** A picture path from the export (relative to the images root) → its public URL. */
// Links inside the exported HTML still point at the old static files ("oyakodon.html#step-3", "sous-vide.html",
// "index.html#korean"); point them at this app's routes in the page's language.
const LOCAL_LINK = /href="([a-z0-9-]+)\.html(#[^"]*)?"/g;

function rewrite<T>(value: T, lang: Lang): T {
  if (typeof value === "string") {
    return value.replace(LOCAL_LINK, (_, slug: string, hash = "") => `href="${foodHref(lang, slug)}${hash}"`) as T;
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, lang)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, lang)])) as T;
  }
  return value;
}

const cache = new Map<string, unknown>();

function load<T>(lang: Lang, file: string): T {
  const key = `${lang}/${file}`;
  if (!cache.has(key)) {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, lang, file), "utf8"));
    cache.set(key, rewrite(raw, lang));
  }
  return cache.get(key) as T;
}

export const getFoodIndex = (lang: Lang) => load<FoodIndex>(lang, "index.json");
export const getSousVide = (lang: Lang) => load<SousVide>(lang, "sous-vide.json");

export function getRecipe(lang: Lang, slug: string): Recipe | null {
  if (!/^[a-z0-9-]+$/.test(slug) || !fs.existsSync(path.join(ROOT, lang, "recipes", `${slug}.json`))) return null;
  return load<Recipe>(lang, `recipes/${slug}.json`);
}

/** Every recipe slug that has its own page (the sous-vide tables have a dedicated route). */
export const recipeSlugs = () =>
  fs
    .readdirSync(path.join(ROOT, "en", "recipes"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();

/** The recipe site's UI strings: English text → shown text. Missing keys fall back to English. */
export function getUi(lang: Lang) {
  const dict = load<Record<string, string>>(lang, "ui.json");
  return (key: string) => dict[key] ?? key;
}

/** Shared SVG gradients/filters the drawn fallbacks refer to; render once per page that shows any. */
export const getSvgDefs = () => {
  if (!cache.has("svg-defs")) cache.set("svg-defs", fs.readFileSync(path.join(ROOT, "svg-defs.svg"), "utf8"));
  return cache.get("svg-defs") as string;
};
