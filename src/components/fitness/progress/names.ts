/** Plain helpers shared by the server view and the client panel (stream 06). No "use client": safe on both sides. */
import type { Lang } from "@/lib/fitness/types";

/** "machine-chest-press" → "Machine chest press" (until the catalog has the exercise). */
export const humanize = (id: string) => (id ? id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ") : id);

/** Section ids, jump-nav labels and titles (the placeholders before hydration use the same titles). */
export const SECTIONS = [
  { id: "weight", short: ["Weight", "Вес"], title: ["Body weight", "Вес тела"] },
  { id: "strength", short: ["Strength", "Сила"], title: ["Strength", "Сила"] },
  { id: "volume", short: ["Volume", "Объём"], title: ["Volume", "Объём"] },
  { id: "adherence", short: ["Adherence", "Регулярность"], title: ["Adherence", "Регулярность"] },
  { id: "model", short: ["Fitness–fatigue", "Форма"], title: ["Fitness and fatigue", "Форма и усталость"] },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export function sectionTitle(id: SectionId, lang: Lang): string {
  const s = SECTIONS.find((x) => x.id === id);
  return s ? (lang === "ru" ? s.title[1] : s.title[0]) : id;
}
