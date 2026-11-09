// Fitness page metadata (title, canonical, EN/RU alternates, link-preview card). Shared by every fitness route.
import type { Metadata } from "next";
import { type Lang, strings } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { pick } from "@/lib/fitness/i18n";

const IMAGE = "/share/fitness.jpg";

const page = (lang: Lang, path: string, en: [string, string], ru: [string, string], image = IMAGE): Metadata =>
  pageMetadata({ lang, path, title: pick(lang, en[0], ru[0]), description: pick(lang, en[1], ru[1]), image });

export const fitnessMeta = (lang: Lang): Metadata => {
  const t = strings(lang);
  return pageMetadata({ lang, path: "/fitness", title: t.fitnessTitle, description: t.fitnessDescription, image: IMAGE });
};

export const trainMeta = (lang: Lang) => page(lang, "/fitness/train",
  ["Train", "Today's session: planned sets, one tap to log each, automatic progression for next time."],
  ["Тренировка", "Сегодняшняя тренировка: запланированные подходы, одно касание на подход, автоматическая прогрессия."]);

export const programMeta = (lang: Lang) => page(lang, "/fitness/program",
  ["Program", "Goal modes, a 3-day upper-body program with alternatives, progression rules and the AI advisor."],
  ["Программа", "Режимы целей, программа на 3 дня для верха тела с заменами, правила прогрессии и ИИ-советник."]);

export const exercisesMeta = (lang: Lang) => page(lang, "/fitness/exercises",
  ["Exercises & machines", "Every exercise with its muscles, technique diagrams, cues, mistakes and alternatives."],
  ["Упражнения и тренажёры", "Каждое упражнение с мышцами, схемами техники, подсказками, ошибками и заменами."]);

export const exerciseMeta = (lang: Lang, id: string, name: string, description: string, image?: string) =>
  pageMetadata({
    lang, path: `/fitness/exercises/${id}`, title: name, description, image: image ?? IMAGE, type: "article",
    // exercise diagrams are 1200×800; the fallback card is 1200×630
    imageSize: image ? { width: 1200, height: 800 } : undefined,
  });

export const gymsMeta = (lang: Lang) => page(lang, "/fitness/gyms",
  ["Gyms", "Gym profiles: which machines each gym has, favourites, and the alternatives the plan uses there."],
  ["Залы", "Профили залов: какие тренажёры есть, избранное и замены, которые план использует в этом зале."]);

export const progressMeta = (lang: Lang) => page(lang, "/fitness/progress",
  ["Progress", "Estimated 1RM trends, weekly volume per muscle, body weight trend, adherence and the fitness–fatigue model."],
  ["Прогресс", "Тренды расчётного 1ПМ, недельный объём по мышцам, тренд веса, посещаемость и модель fitness–fatigue."]);

export const scienceIndexMeta = (lang: Lang) => page(lang, "/fitness/science",
  ["Science", "What the evidence says about goals, progression, injury prevention, longevity and nutrition."],
  ["Наука", "Что говорят исследования о целях, прогрессии, профилактике травм, долголетии и питании."]);

export const scienceMeta = (lang: Lang, topic: string, title: string, description: string) =>
  pageMetadata({ lang, path: `/fitness/science/${topic}`, title, description, image: IMAGE, type: "article" });

export const nutritionMeta = (lang: Lang) => page(lang, "/fitness/nutrition",
  ["Nutrition", "Energy and protein targets for fat loss, strength or mass, with a protein food table."],
  ["Питание", "Цели по энергии и белку для похудения, силы или массы, с таблицей белковых продуктов."]);

export const toolsMeta = (lang: Lang) => page(lang, "/fitness/tools",
  ["Calculators", "One-rep max from any set, the weight for any reps and effort rounded to the machine, a warm-up ramp and plates per side."],
  ["Калькуляторы", "Разовый максимум по любому подходу, вес на любые повторения и усилие с округлением до тренажёра, разминка и блины."]);

export const profileMeta = (lang: Lang) => page(lang, "/fitness/profile",
  ["My fitness profile", "Your account, privacy, training preferences and personal program."],
  ["Мой фитнес-профиль", "Ваш аккаунт, приватность, предпочтения и личная программа."]);
