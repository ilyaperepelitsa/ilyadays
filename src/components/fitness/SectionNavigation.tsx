"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { type Lang, localPath } from "@/lib/i18n";
import { pick } from "@/lib/fitness/i18n";
import { ActionIcon, type ActionIconName } from "../site/ActionIcon";

const SECTIONS = [
  ["/fitness", "Overview", "Обзор"],
  ["/fitness/train", "Train", "Тренировка"],
  ["/fitness/program", "Program", "Программа"],
  ["/fitness/profile", "My profile", "Мой профиль"],
  ["/fitness/progress", "Progress", "Прогресс"],
  ["/fitness/exercises", "Exercises", "Упражнения"],
  ["/fitness/gyms", "Gyms", "Залы"],
  ["/fitness/nutrition", "Nutrition", "Питание"],
  ["/fitness/tools", "Calculators", "Калькуляторы"],
  ["/fitness/science", "Science", "Наука"],
] as const;

const ICONS: Record<string, ActionIconName> = {
  "/fitness": "progress", "/fitness/train": "fitness", "/fitness/program": "program",
  "/fitness/profile": "profile", "/fitness/progress": "progress", "/fitness/exercises": "fitness",
  "/fitness/gyms": "gym", "/fitness/nutrition": "food", "/fitness/tools": "tools", "/fitness/science": "science",
};

const WIDE_QUERY = "(min-width: 1100px)";
const subscribeWidth = (update: () => void) => {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
};
const isWide = () => window.matchMedia(WIDE_QUERY).matches;

export function SectionNavigation({ lang, current }: { lang: Lang; current: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const wide = useSyncExternalStore(subscribeWidth, isWide, () => false);
  const secondary = SECTIONS.slice(3);
  const selected = secondary.find(([path]) => current === path || current.startsWith(path + "/"));
  const compactLabel = selected?.[0] === "/fitness/profile" ? pick(lang, "Profile", "Профиль")
    : selected?.[0] === "/fitness/exercises" ? pick(lang, "Exercises", "Каталог")
    : selected?.[0] === "/fitness/tools" ? pick(lang, "Tools", "Расчёты")
    : selected ? pick(lang, selected[1], selected[2]) : pick(lang, "More", "Ещё");

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const link = ([path, en, ru]: typeof SECTIONS[number]) => (
    <Link key={path} prefetch={false} href={localPath(lang, path)} aria-current={current === path ? "page" : undefined}>
      <ActionIcon name={ICONS[path]} /><span>{pick(lang, en, ru)}</span>
    </Link>
  );

  return (
    <nav className="fit-nav" data-wide={wide || undefined} aria-label={pick(lang, "Fitness sections", "Разделы фитнеса")}>
      {SECTIONS.slice(0, 3).map((section) => link(section))}
      {wide ? secondary.map((section) => link(section)) : <details ref={menu} className="fit-nav-more">
        <summary className={selected ? "is-current" : undefined}>
          <span>{compactLabel}</span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>
        <div className="fit-nav-menu">{secondary.map((section) => link(section))}</div>
      </details>}
    </nav>
  );
}
