"use client";
/**
 * The top of /fitness. A phone that has never logged a session gets the introduction; one that has opens straight on
 * the next-session card (the page title stays for screen readers). Nothing is drawn, and no room is kept, until the
 * store has settled, so the introduction never flashes in front of a returning user.
 */
import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { useFitness } from "../Provider";

export function HomeHero({ lang, title }: { lang: Lang; title: string }) {
  const { snapshot, mode } = useFitness();
  if (mode === "loading" || Object.keys(snapshot.sessions).length > 0) return <h1 className="sr-only">{title}</h1>;
  return (
    <section className="hello fh-hero" data-testid="fitness-hero">
      <div>
        <p className="fh-eyebrow">{pick(lang, "Your pace. Your priorities.", "Ваш темп. Ваши приоритеты.")}</p>
        <h1>{title}</h1>
        <p className="lede">
          {pick(
            lang,
            "Build a plan around what you want to train. Find your starting weights, log what you actually do, and make the next session fit your progress.",
            "Соберите программу под свои задачи. Подберите стартовые веса, записывайте фактический результат и корректируйте следующую тренировку по прогрессу.",
          )}
        </p>
        <div className="fh-hero-tags"><span>{pick(lang, "Flexible plans", "Гибкая программа")}</span><span>{pick(lang, "Personal baselines", "Личные стартовые веса")}</span><span>{pick(lang, "Private profiles", "Приватный профиль")}</span></div>
      </div>
      <div className="fh-hero-art" aria-hidden="true" />
    </section>
  );
}
