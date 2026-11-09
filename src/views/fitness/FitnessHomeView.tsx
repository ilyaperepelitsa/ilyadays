import Link from "next/link";
import type { Lang } from "@/lib/fitness/types";
import { localPath, strings } from "@/lib/i18n";
import { pick } from "@/lib/fitness/i18n";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { HomePanel } from "@/components/fitness/home/HomePanel";
import { ErrorGuard } from "@/components/fitness/train/ErrorGuard";
import { ActionIcon, type ActionIconName } from "@/components/site/ActionIcon";

const TILES: [string, string, string, string, string][] = [
  ["/fitness/profile", "Your profile", "Ваш профиль", "Private by default. Your goals, preferences and starting plan.", "Приватный по умолчанию. Ваши цели, предпочтения и первая программа."],
  ["/fitness/program", "Program", "Программа", "Goal mode, days per week, the A/B/C days and how they progress.", "Цель, дни в неделю, дни A/B/C и их прогрессия."],
  ["/fitness/exercises", "Exercises", "Упражнения", "Every machine and exercise: muscles, technique pictures, cues, alternatives.", "Все тренажёры и упражнения: мышцы, схемы техники, подсказки, замены."],
  ["/fitness/gyms", "Gyms", "Залы", "Which machines your gym has, and the swaps the plan uses there.", "Какие тренажёры есть в зале и какие замены план там использует."],
  ["/fitness/progress", "Progress", "Прогресс", "Strength trends, weekly sets per muscle, body weight, records.", "Динамика силы, недельные подходы на мышцу, вес тела, рекорды."],
  ["/fitness/nutrition", "Nutrition", "Питание", "Energy and protein targets for fat loss, with a protein food table.", "Калории и белок для похудения, таблица белковых продуктов."],
  ["/fitness/science", "Science", "Наука", "Why the plan looks like this: the evidence, with sources.", "Почему план такой: исследования и источники."],
  ["/fitness/tools", "Calculators", "Калькуляторы", "One-rep max, the weight for any reps, warm-up sets, plates per side.", "Разовый максимум, вес на любые повторы, разминка, блины на сторону."],
];

const TILE_ICONS: Record<string, ActionIconName> = {
  "/fitness/profile": "profile", "/fitness/program": "program", "/fitness/exercises": "fitness", "/fitness/gyms": "gym",
  "/fitness/progress": "progress", "/fitness/nutrition": "food", "/fitness/science": "science", "/fitness/tools": "tools",
};

/** /fitness: the hub (stream 04). Static parts render on the server; the data cards are a client island. */
export function FitnessHomeView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <FitnessShell lang={lang} path="/fitness">
      <section className="hello fh-hero">
        <div>
        <p className="fh-eyebrow">{pick(lang, "Your pace. Your priorities.", "Ваш темп. Ваши приоритеты.")}</p>
        <h1>{t.fitnessTitle}</h1>
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
      <FitnessNav lang={lang} current="/fitness" />
      <ErrorGuard lang={lang}>
        <HomePanel lang={lang} />
      </ErrorGuard>
      <nav className="fit-tiles fh-hub-tiles" aria-label={pick(lang, "Fitness pages", "Страницы фитнеса")}>
        {TILES.map(([path, en, ru, textEn, textRu]) => (
          <Link key={path} prefetch={false} className="fit-tile" href={localPath(lang, path)}>
            <span className="fh-tile-heading"><span className="fh-tile-icon"><ActionIcon name={TILE_ICONS[path]} /></span><h2>{pick(lang, en, ru)}</h2><ActionIcon name="arrow" /></span>
            <p>{pick(lang, textEn, textRu)}</p>
          </Link>
        ))}
      </nav>
      <section className="fit-card fh-how">
        <h2>{pick(lang, "How this works", "Как это работает")}</h2>
        <p>
          {pick(
            lang,
            "Choose your main goal, supporting priorities and training days. Keep an upper-body plan, include legs or choose your own muscle exclusions. Start each new exercise light, aiming for two or three clean reps in reserve. Log the weight and reps you actually complete; a missed target stays recorded and cannot earn an automatic weight increase. You can review and save a new version of your program without losing past workouts or changing a session already in progress.",
            "Выберите главную цель, дополнительные приоритеты и дни тренировок. Оставьте только верх тела, добавьте ноги или исключите отдельные группы мышц. Новое упражнение начинайте легко, с запасом два-три чистых повторения. Записывайте фактический вес и повторы: недобор сохраняется и не даёт автоматической прибавки веса. Новую версию программы можно проверить и сохранить без потери истории и изменения уже начатой тренировки.",
          )}
        </p>
        <p className="fit-muted">
          {pick(
            lang,
            "Create a private profile to sync your own plan and log across devices. Sharing is optional. Browser-only records stay on their original device; sign-in and saved preferences use browser storage, not cookies.",
            "Создайте приватный профиль для синхронизации своей программы и журнала между устройствами. Публичный доступ необязателен. Локальные записи остаются на исходном устройстве; вход и настройки используют хранилище браузера, а не cookies.",
          )}
        </p>
      </section>
    </FitnessShell>
  );
}
