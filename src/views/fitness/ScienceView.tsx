// /fitness/science/[topic] (stream 08): one explainer. Static for the topics that have a file in this language.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Lang } from "@/lib/fitness/types";
import { getTopic, topicSlugs } from "@/lib/fitness/science";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { Article } from "@/components/fitness/science/Article";
import { clip, scienceMeta } from "./meta";

/** Topic slugs present for this language, for generateStaticParams. */
export const scienceParams = (lang: Lang) => topicSlugs(lang).map((topic) => ({ topic }));

/** Title and description from the topic's front matter. */
export function scienceMetadata(lang: Lang, slug: string): Metadata {
  const topic = getTopic(lang, slug);
  return topic ? scienceMeta(lang, slug, topic.title, clip(topic.description)) : {};
}

export function ScienceView({ lang, slug }: { lang: Lang; slug: string }) {
  const topic = getTopic(lang, slug);
  if (!topic) notFound();
  return (
    <FitnessShell lang={lang} path={`/fitness/science/${slug}`}>
      <Article lang={lang} topic={topic} nav={<FitnessNav lang={lang} current="/fitness/science" />} />
    </FitnessShell>
  );
}
