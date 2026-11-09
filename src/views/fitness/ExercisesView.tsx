// /fitness/exercises (stream 02): the catalog with search and filters. Server view: trims the catalog to what the
// cards need, so the client bundle never carries exercises.json.
import { type Lang } from "@/lib/i18n";
import { pick } from "@/lib/fitness/i18n";
import { EXERCISES, GROUPS, OWNER_TEMPLATE, groupsOf, muscleNames, thumbUrl } from "@/lib/fitness/catalog.mjs";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { ExercisesBrowser, type BrowserGroup, type BrowserItem } from "@/components/fitness/exercises/ExercisesBrowser";
import type { TemplateDays } from "@/components/fitness/exercises/useActive";

/** Card rows for the catalog list, in registry order (the catalog's own preference order within each class). */
export function browserItems(lang: Lang): BrowserItem[] {
  const names = muscleNames(lang);
  return EXERCISES.map((e) => ({
    id: e.id,
    name: e.name,
    aka: e.aka ?? [],
    equipment: e.equipment,
    pattern: e.pattern,
    groups: groupsOf(e.id),
    primary: e.primary,
    secondary: e.secondary,
    muscles: e.primary.map((m) => names[m] ?? m).join(", "),
    image: ((src) => (src ? thumbUrl(src) : null))(e.images?.find((i) => i.angle === "sequence")?.src ?? e.images?.[0]?.src),
  }));
}

export function ExercisesView({ lang }: { lang: Lang }) {
  const groups: BrowserGroup[] = GROUPS.map((g) => ({ id: g.id, name: lang === "ru" ? g.name.ru : g.name.en }));
  return (
    <FitnessShell lang={lang} path="/fitness/exercises">
      <h1>{pick(lang, "Exercises & machines", "Упражнения и тренажёры")}</h1>
      <FitnessNav lang={lang} current="/fitness/exercises" />
      <p className="fx-lede fit-muted">
        {pick(
          lang,
          `${EXERCISES.length} exercises. Each page has technique pictures, cues, common mistakes and the closest swaps for a busy or missing machine.`,
          `${EXERCISES.length} упражнений. На каждой странице — схемы техники, подсказки, частые ошибки и ближайшие замены, если тренажёр занят или его нет.`,
        )}
      </p>
      <ExercisesBrowser lang={lang} items={browserItems(lang)} groups={groups} template={OWNER_TEMPLATE.days as unknown as TemplateDays} />
    </FitnessShell>
  );
}
