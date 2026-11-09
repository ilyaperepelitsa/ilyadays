import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { GROUPS } from "@/lib/fitness/catalog.mjs";
import { GYM_EXERCISES, previewDays } from "@/lib/fitness/gyms.mjs";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { GymProfiles } from "@/components/fitness/gyms/GymProfiles";
import type { GroupInfo, PreviewDays } from "@/components/fitness/gyms/shared";

/** Built once per server process: the trimmed catalog and the template days the client previews. */
const GROUP_INFO: GroupInfo[] = GROUPS.map((g) => ({ id: g.id, name: { en: g.name.en, ru: g.name.ru } }));
const PREVIEWS: PreviewDays = { "2": previewDays(2), "3": previewDays(3), "4": previewDays(4) };

/** /fitness/gyms (stream 05): gym profiles — what each gym has, preferences, weight steps, the plan there. */
export function GymsView({ lang }: { lang: Lang }) {
  return (
    <FitnessShell lang={lang} path="/fitness/gyms">
      <section className="hello">
        <h1>{pick(lang, "Gyms", "Залы")}</h1>
        <p className="lede">
          {pick(
            lang,
            "Tell the plan which machines each gym has. A missing machine is swapped for the closest alternative, and targets round to that gym's weight steps.",
            "Отметьте, какие тренажёры есть в каждом зале. Отсутствующий тренажёр план заменит ближайшей альтернативой, а веса округлит под шаг этого зала.",
          )}
        </p>
      </section>
      <FitnessNav lang={lang} current="/fitness/gyms" />
      <GymProfiles lang={lang} exercises={GYM_EXERCISES} groups={GROUP_INFO} previews={PREVIEWS} />
    </FitnessShell>
  );
}
