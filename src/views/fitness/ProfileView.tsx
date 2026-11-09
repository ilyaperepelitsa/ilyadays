import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { ProfilePanel } from "@/components/fitness/profile/ProfilePanel";
export function ProfileView({ lang }: { lang: Lang }) {
  return <FitnessShell lang={lang} path="/fitness/profile">
    <section className="hello"><h1>{pick(lang, "My fitness profile", "Мой фитнес-профиль")}</h1>
      <p className="lede">{pick(lang, "Your goals, training days and starting plan.", "Ваши цели, тренировочные дни и стартовая программа.")}</p></section>
    <FitnessNav lang={lang} current="/fitness/profile" /><ProfilePanel lang={lang} />
  </FitnessShell>;
}
