/**
 * /fitness/progress view (stream 06). Server component: builds the trimmed catalog the client panel needs — names,
 * coarse-group weights (stream 03's groupWeights: catalog muscles, else the movement-pattern map, so volume works even
 * before content/fitness/exercises.json is merged), rep unit, equipment, assistance — so no exercise JSON ships to the
 * browser.
 */
import type { Lang } from "@/lib/i18n";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { ProgressPanel } from "@/components/fitness/progress/ProgressPanel";
import { humanize } from "@/components/fitness/progress/names";
import type { ProgressCatalog, ProgressGroup, RepUnit } from "@/components/fitness/progress/types";
import { EXERCISES, GROUPS, exerciseById } from "@/lib/fitness/catalog.mjs";
import { pick } from "@/lib/fitness/i18n";
import { TEMPLATES, groupWeights } from "@/lib/fitness/templates.mjs";
import registry from "../../../content/fitness/registry.json";

const registryExercises: Record<string, { pattern?: string }> = registry.exercises;

function progressCatalog(): ProgressCatalog {
  const unitHints = new Map<string, RepUnit>();
  for (const t of TEMPLATES) for (const d of t.days) for (const s of d.slots) if (s.unit) unitHints.set(s.exerciseId, s.unit);
  const ids = new Set([...Object.keys(registryExercises), ...EXERCISES.map((e) => e.id)]);
  const out: ProgressCatalog = {};
  for (const id of ids) {
    const ex = exerciseById(id);
    const assistance = ex ? ex.assistance === true || ex.equipment === "assisted" : id.startsWith("assisted-");
    const pattern = ex?.pattern ?? registryExercises[id]?.pattern;
    out[id] = {
      name: ex?.name ?? { en: humanize(id), ru: humanize(id) },
      groups: groupWeights(id),
      unit: ex?.repUnit ?? unitHints.get(id) ?? "reps",
      ...(ex?.equipment ? { equipment: ex.equipment } : {}),
      ...(assistance ? { assistance: true } : {}),
      ...(pattern ? { pattern } : {}),
    };
  }
  return out;
}

const groups: ProgressGroup[] = GROUPS.map((g) => ({ id: g.id, name: g.name }));

export function ProgressView({ lang }: { lang: Lang }) {
  return (
    <FitnessShell lang={lang} path="/fitness/progress">
      <section className="hello">
        <h1>{pick(lang, "Progress", "Прогресс")}</h1>
        <p className="lede">
          {pick(
            lang,
            "Estimated strength, weekly volume, body weight and consistency — each with its uncertainty, and an empty state until the data can say something.",
            "Расчётная сила, недельный объём, вес и регулярность — у каждой цифры есть неопределённость, а пока данных мало, страница честно молчит.",
          )}
        </p>
      </section>
      <FitnessNav lang={lang} current="/fitness/progress" />
      <ProgressPanel lang={lang} catalog={progressCatalog()} groups={groups} />
    </FitnessShell>
  );
}
