// /fitness/exercises/[id] (stream 02): one exercise. Static for all catalog ids (generateStaticParams).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type Lang } from "@/lib/i18n";
import { t2 } from "@/lib/fitness/i18n";
import { EXERCISES, exerciseById } from "@/lib/fitness/catalog.mjs";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { ExerciseDetail } from "@/components/fitness/exercises/ExerciseDetail";
import { exerciseMeta } from "./meta";

/** Every catalog id, for generateStaticParams. */
export const exerciseParams = () => EXERCISES.map((e) => ({ id: e.id }));

/** Shorten to ≤ max characters at a word boundary. */
function clip(text: string, max = 158) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[\s,.;:—–-]+$/, "")}…`;
}

/** Title = exercise name, description = its setup text, link preview = its technique picture when there is one. */
export function exerciseMetadata(lang: Lang, id: string): Metadata {
  const ex = exerciseById(id);
  if (!ex) return {};
  const picture = ex.images?.find((i) => i.angle === "sequence") ?? ex.images?.[0];
  return exerciseMeta(lang, id, t2(lang, ex.name), clip(t2(lang, ex.setup)), picture?.src);
}

export function ExerciseView({ lang, id }: { lang: Lang; id: string }) {
  const ex = exerciseById(id);
  if (!ex) notFound();
  return (
    <FitnessShell lang={lang} path={`/fitness/exercises/${id}`}>
      <h1>{t2(lang, ex.name)}</h1>
      <FitnessNav lang={lang} current="/fitness/exercises" />
      <ExerciseDetail lang={lang} ex={ex} />
    </FitnessShell>
  );
}
