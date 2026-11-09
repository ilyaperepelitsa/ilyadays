// Science explainers (stream 08): content/fitness/science/<slug>.<lang>.md rendered at build time by our own
// markdown renderer. Server-only (fs): import it from server components, views and route files, never from a client
// component. Works with whatever topic files exist.
import type { Lang } from "./types";
import { listTopicsIn, readTopicIn, scienceDir } from "./science-core.mjs";

export type ScienceSource = { n: number; text: string; title: string; outlet: string; year: string; url: string | null };
export type TocItem = { id: string; text: string; level: 2 | 3 };
export type TopicSummary = {
  slug: string;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  updated: string;
  order: number;
  /** Reading time, minutes */
  minutes: number;
  /** Number of sources */
  sources: number;
};
export type Topic = Omit<TopicSummary, "sources"> & { html: string; toc: TocItem[]; sources: ScienceSource[] };

const DIR = scienceDir();

/** Topics that have a page in this language, by `order`, then slug. */
export function listTopics(lang: Lang): TopicSummary[] {
  return listTopicsIn(DIR, lang);
}

/** One topic rendered, or null (unknown slug, or no file in this language). */
export function getTopic(lang: Lang, slug: string): Topic | null {
  return readTopicIn(DIR, lang, slug);
}

/** Slugs with a page in this language (generateStaticParams). */
export function topicSlugs(lang: Lang): string[] {
  return listTopics(lang).map((t) => t.slug);
}
