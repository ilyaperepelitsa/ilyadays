"use client";
/** 4 · Adherence (stream 06): a 12-week calendar, sessions per week against the plan, streak and rate. */
import { useMemo } from "react";
import type { Lang } from "@/lib/fitness/types";
import { pick, pluralRu } from "@/lib/fitness/i18n";
import { adherence } from "@/lib/fitness/analytics.mjs";
import { Calendar } from "./charts";
import { fmtDay, fmtNum } from "./scales";
import { Caveat, Empty, Section, Stat } from "./shared";
import { sectionTitle } from "./names";
import type { ProgressData } from "./useProgressData";

const weeksWord = (n: number, lang: Lang) => (lang === "ru" ? pluralRu(n, ["неделя", "недели", "недель"]) : n === 1 ? "week" : "weeks");
const daysAgo = (n: number, lang: Lang) =>
  n <= 0 ? pick(lang, "today", "сегодня") : n === 1 ? pick(lang, "yesterday", "вчера") : lang === "ru" ? `${n} ${pluralRu(n, ["день", "дня", "дней"])} назад` : `${n} days ago`;

export function AdherenceSection({ lang, data, now }: { lang: Lang; data: ProgressData; now: number }) {
  const a = useMemo(() => adherence(data.sessions, { weeks: 12, daysPerWeek: data.daysPerWeek, now }), [data.sessions, data.daysPerWeek, now]);
  const title = sectionTitle("adherence", lang);
  const lede = pick(lang, `Sessions per week against your plan of ${a.daysPerWeek}.`, `Тренировки в неделю против плана: ${a.daysPerWeek}.`);
  if (a.lastAt == null) {
    return (
      <Section id="adherence" title={title} lede={lede}>
        <Empty>{pick(lang, "Your first session starts the calendar. Weeks before it never count as missed.", "Первая тренировка запустит календарь. Недели до неё не считаются пропущенными.")}</Empty>
      </Section>
    );
  }
  const counted = a.weeks.filter((w) => !w.beforeStart);
  return (
    <Section id="adherence" title={title} lede={lede}>
      <div className="fitp-stats">
        <Stat label={pick(lang, "This week", "Эта неделя")} value={`${a.thisWeek.done} / ${a.thisWeek.planned}`} sub={a.daysSinceLast != null ? pick(lang, `last session ${daysAgo(a.daysSinceLast, lang)}`, `последняя\u00a0— ${daysAgo(a.daysSinceLast, lang)}`) : undefined} />
        <Stat label={pick(lang, "Streak", "Серия")} value={`${a.streak} ${weeksWord(a.streak, lang)}`} sub={pick(lang, "weeks meeting the plan", "недель по плану")} />
        <Stat
          label={pick(lang, "Completed weeks", "Прошедшие недели")}
          value={a.rate != null ? `${fmtNum(a.rate * 100, lang, 0)}\u00a0%` : "—"}
          sub={a.rate != null ? pick(lang, `${a.totalDone} of ${a.totalPlanned} planned sessions`, `${a.totalDone} из ${a.totalPlanned} запланированных`) : pick(lang, "after the first full week", "после первой полной недели")}
        />
      </div>
      <Calendar
        kind="adherence"
        lang={lang}
        title={pick(lang, "Last 12 weeks", "Последние 12 недель")}
        summary={pick(
          lang,
          `${counted.reduce((s, w) => s + w.done, 0)} sessions in ${counted.length} weeks since the first session; streak ${a.streak} ${weeksWord(a.streak, lang)}; this week ${a.thisWeek.done} of ${a.thisWeek.planned}.`,
          `${counted.reduce((s, w) => s + w.done, 0)} тренировок за ${counted.length} нед. с первой тренировки; серия ${a.streak} ${weeksWord(a.streak, lang)}; на этой неделе ${a.thisWeek.done} из ${a.thisWeek.planned}.`,
        )}
        weeks={a.weeks}
        table={{
          caption: pick(lang, "Sessions per week", "Тренировки по неделям"),
          columns: [pick(lang, "Week of", "Неделя с"), pick(lang, "Done", "Сделано"), pick(lang, "Planned", "План"), pick(lang, "Met", "Выполнено")],
          rows: [...counted].reverse().map((w) => [fmtDay(w.start, lang), w.done, w.planned, w.current && !w.met ? pick(lang, "in progress", "идёт") : w.met ? "✓" : "—"]),
        }}
      />
      <Caveat>
        {pick(
          lang,
          `Counts started sessions (finished, still open or auto-closed after 6 h; abandoned ones do not count). The plan is your current ${a.daysPerWeek} days a week for every week shown. The streak counts back from the last complete week; this week extends it once it is met and never breaks it.`,
          `Считаются начатые тренировки (завершённые, открытые и закрытые автоматически через 6 ч; брошенные не считаются). План\u00a0— нынешние ${a.daysPerWeek} дня в неделю для всех показанных недель. Серия считается от последней полной недели; текущая неделя продлевает её, когда план выполнен, и никогда не обрывает.`,
        )}
      </Caveat>
    </Section>
  );
}
