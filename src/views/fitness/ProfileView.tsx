import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { ProfilePanel } from "@/components/fitness/profile/ProfilePanel";
export function ProfileView({ lang }: { lang: Lang }) {
  return <FitnessShell lang={lang} path="/fitness/profile">
    <section className="hello"><h1>{pick(lang, "My fitness profile", "Мой фитнес-профиль")}</h1>
      <p className="lede">{pick(lang, "Your goals, your plan and your training history. Choose what you want to train and change direction when you need to.", "Ваши цели, программа и история тренировок. Выбирайте, что тренировать, и меняйте направление, когда это нужно.")}</p></section>
    <FitnessNav lang={lang} current="/fitness/profile" /><ProfilePanel lang={lang} />
  </FitnessShell>;
}
