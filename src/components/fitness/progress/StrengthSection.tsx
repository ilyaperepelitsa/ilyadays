"use client";
/**
 * 2 · Strength (stream 06): per exercise, the session-best estimated 1RM (hollow when > 12 total reps), a Theil–Sen
 * trend in % per week with Sen's CI and the ±1.96σ session-noise band, PR markers, recent records and a plateau
 * flag with its false-alarm odds. Maths: analytics.mjs; research/07 §A, §F, §G, §K.
 */
import { useMemo, useState } from "react";
import type { Lang } from "@/lib/fitness/types";
import { kgLabel, pick, pluralRu } from "@/lib/fitness/i18n";
import { DAY_MS, bestRecords, e1rmTrend, plateau, prs, sessionBestE1rm } from "@/lib/fitness/analytics.mjs";
import { LineChart, type BandSeries, type LineSeries } from "./charts";
import { fmtDay, fmtNum, fmtSigned } from "./scales";
import { Caveat, Empty, Section, Stat, exerciseName } from "./shared";
import { sectionTitle } from "./names";
import type { ProgressCatalog } from "./types";
import type { ProgressData } from "./useProgressData";

type Series = ReturnType<typeof sessionBestE1rm>;
type Pr = ReturnType<typeof prs>[number];

const NO_SERIES: Series = [];

const sessionsWord = (n: number, lang: Lang) => (lang === "ru" ? pluralRu(n, ["тренировка", "тренировки", "тренировок"]) : n === 1 ? "session" : "sessions");

function prText(p: Pr, name: string, lang: Lang): string {
  const kg = kgLabel(lang);
  switch (p.kind) {
    case "e1rm":
      return pick(lang, `${name}: e1RM ${fmtNum(p.value, lang, 1)} ${kg} (${fmtSigned(p.value - p.previous, lang, 1)})`, `${name}: 1ПМ ${fmtNum(p.value, lang, 1)} ${kg} (${fmtSigned(p.value - p.previous, lang, 1)})`);
    case "load":
      return pick(lang, `${name}: heaviest ${fmtNum(p.value, lang, 1)} ${kg} × ${p.reps} (was ${fmtNum(p.previous, lang, 1)})`, `${name}: максимум ${fmtNum(p.value, lang, 1)} ${kg} × ${p.reps} (было ${fmtNum(p.previous, lang, 1)})`);
    case "reps":
      return pick(lang, `${name}: ${p.value} reps at ${fmtNum(p.kg, lang, 1)} ${kg} (was ${p.previous})`, `${name}: ${p.value} повт. с ${fmtNum(p.kg, lang, 1)} ${kg} (было ${p.previous})`);
  }
}

export function StrengthSection({ lang, data, catalog, now }: { lang: Lang; data: ProgressData; catalog: ProgressCatalog; now: number }) {
  const opts = useMemo(() => ({ loadOf: data.loadOf, timeOf: data.timeOf, unitOf: data.unitOf }), [data]);
  const all = useMemo(() => sessionBestE1rm(data.sets, opts), [data.sets, opts]);
  const byExercise = useMemo(() => {
    const m = new Map<string, Series>();
    for (const p of all) m.set(p.exerciseId, [...(m.get(p.exerciseId) ?? []), p]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || b[1][b[1].length - 1].at - a[1][a[1].length - 1].at);
  }, [all]);
  const events = useMemo(() => prs(data.sets, opts), [data.sets, opts]);
  const records = useMemo(() => bestRecords(data.sets, opts), [data.sets, opts]);
  const [picked, setPicked] = useState<string | null>(null);
  const kg = kgLabel(lang);

  const flagged = useMemo(() => {
    const ids = new Set<string>();
    for (const s of data.sets) if (s.kind !== "warmup" && data.unitOf(s.exerciseId) === "reps" && data.flagOf(s) === "no-bodyweight") ids.add(s.exerciseId);
    return ids;
  }, [data]);

  const selected = picked && byExercise.some(([id]) => id === picked) ? picked : (byExercise[0]?.[0] ?? null);
  const series = useMemo(() => (selected ? (byExercise.find(([id]) => id === selected)?.[1] ?? NO_SERIES) : NO_SERIES), [selected, byExercise]);
  const trend = useMemo(() => e1rmTrend(series), [series]);
  const flat = useMemo(() => plateau(series, { sessions: 4 }), [series]);
  const prSessions = new Set(events.filter((e) => e.exerciseId === selected && e.kind === "e1rm").map((e) => e.sessionId));
  const name = selected ? exerciseName(catalog, selected, lang) : "";
  const reliable = series.filter((p) => p.reliable);
  const best = reliable.length ? reliable.reduce((a, b) => (b.kg > a.kg ? b : a)) : null;

  const lines: LineSeries[] = [];
  const bands: BandSeries[] = [];
  if (trend.status === "ok") {
    lines.push({ key: "trend", label: pick(lang, "Trend (Theil–Sen)", "Тренд (Тейл–Сен)"), role: "model", points: trend.line.map((p) => ({ x: p.at, y: p.kg })), endLabel: `${fmtSigned(trend.pctPerWeek, lang, 1)}\u00a0%/${pick(lang, "wk", "нед")}` });
    bands.push({ key: "noise", label: pick(lang, `Session noise ±${fmtNum(196 * trend.sigma, lang, 0)}\u00a0%`, `Шум тренировки ±${fmtNum(196 * trend.sigma, lang, 0)}\u00a0%`), role: "model", points: trend.band.map((b) => ({ x: b.at, lo: b.lo, hi: b.hi })) });
  }

  const trendWords =
    trend.status === "ok"
      ? trend.ci
        ? pick(lang, `Trend ${fmtSigned(trend.pctPerWeek, lang, 1)}\u00a0% a week (95\u00a0% CI ${fmtSigned(trend.ci[0], lang, 1)} … ${fmtSigned(trend.ci[1], lang, 1)}), ${trend.n} sessions over ${Math.round(trend.spanDays / 7)} weeks.`, `Тренд ${fmtSigned(trend.pctPerWeek, lang, 1)}\u00a0% в неделю (95\u00a0% ДИ ${fmtSigned(trend.ci[0], lang, 1)} … ${fmtSigned(trend.ci[1], lang, 1)}), ${trend.n} ${sessionsWord(trend.n, lang)} за ${Math.round(trend.spanDays / 7)} нед.`)
        : pick(lang, `Trend ${fmtSigned(trend.pctPerWeek, lang, 1)}\u00a0% a week from ${trend.n} sessions; the confidence interval needs 8.`, `Тренд ${fmtSigned(trend.pctPerWeek, lang, 1)}\u00a0% в неделю по ${trend.n} ${sessionsWord(trend.n, lang)}; доверительному интервалу нужно 8.`)
      : series.length
        ? pick(
            lang,
            `The trend line appears after 5 sessions of this exercise spanning 3 weeks (now ${trend.n}, ${Math.round(trend.spanDays)} days). On a 3-day split each exercise comes once a week, so give it about five weeks.`,
            `Линия тренда появится после 5 тренировок этого упражнения за 3 недели (сейчас ${trend.n}, ${Math.round(trend.spanDays)} дн.). В сплите на 3 дня каждое упражнение бывает раз в неделю\u00a0— это около пяти недель.`,
          )
        : "";

  const recent = [...events].reverse().slice(0, 6);

  if (!byExercise.length) {
    return (
      <Section id="strength" title={sectionTitle("strength", lang)} lede={pick(lang, "Estimated 1RM per exercise, with its trend and uncertainty.", "Расчётный 1ПМ по упражнениям\u00a0— с трендом и неопределённостью.")}>
        <Empty>
          {flagged.size
            ? pick(lang, "Assisted and bodyweight sets need your body weight: log a weigh-in above to estimate them.", "Для подходов в гравитроне и с собственным весом нужен вес тела: запишите взвешивание выше.")
            : pick(lang, "No working sets yet. After your first session each exercise gets its estimated 1RM here; records start from the second session.", "Рабочих подходов пока нет. После первой тренировки здесь появится расчётный 1ПМ каждого упражнения; рекорды\u00a0— со второй.")}
        </Empty>
      </Section>
    );
  }

  return (
    <Section id="strength" title={sectionTitle("strength", lang)} lede={pick(lang, "Estimated 1RM per exercise, with its trend and uncertainty.", "Расчётный 1ПМ по упражнениям\u00a0— с трендом и неопределённостью.")}>
      <label className="fitp-select">
        <span>{pick(lang, "Exercise", "Упражнение")}</span>
        <select value={selected ?? ""} onChange={(e) => setPicked(e.target.value)}>
          {byExercise.map(([id, s]) => (
            <option key={id} value={id}>
              {exerciseName(catalog, id, lang)} · {s.length}
            </option>
          ))}
        </select>
      </label>
      <div className="fitp-stats">
        <Stat
          label={pick(lang, "Best e1RM", "Лучший 1ПМ")}
          value={best ? `${fmtNum(best.kg, lang, 1)} ${kg}` : "—"}
          sub={best ? `${fmtDay(best.at, lang)} · ${best.reps} × ${fmtNum(best.weightKg, lang, 1)}` : pick(lang, "only > 12-rep sets", "только подходы > 12 повт.")}
        />
        <Stat
          label={pick(lang, "Trend", "Тренд")}
          value={trend.status === "ok" ? `${fmtSigned(trend.pctPerWeek, lang, 1)}\u00a0%/${pick(lang, "wk", "нед")}` : "—"}
          sub={trend.status === "ok" ? (trend.ci ? `${fmtSigned(trend.ci[0], lang, 1)} … ${fmtSigned(trend.ci[1], lang, 1)}` : pick(lang, "CI needs 8 sessions", "ДИ\u00a0— от 8 тренировок")) : pick(lang, `${trend.n} of 5 sessions`, `${trend.n} из 5 тренировок`)}
        />
      </div>
      <LineChart
        kind="e1rm"
        lang={lang}
        title={pick(lang, `${name}: estimated 1RM, ${kg}`, `${name}: расчётный 1ПМ, ${kg}`)}
        summary={pick(
          lang,
          `${series.length} ${sessionsWord(series.length, lang)} from ${fmtDay(series[0].at, lang)} to ${fmtDay(series[series.length - 1].at, lang)}; best ${best ? fmtNum(best.kg, lang, 1) : "—"} kg. ${trendWords}`,
          `${series.length} ${sessionsWord(series.length, lang)} с ${fmtDay(series[0].at, lang)} по ${fmtDay(series[series.length - 1].at, lang)}; лучший ${best ? fmtNum(best.kg, lang, 1) : "—"} кг. ${trendWords}`,
        )}
        dots={[
          {
            key: "e1rm",
            label: pick(lang, "Session best e1RM", "Лучший 1ПМ тренировки"),
            hollowLabel: pick(lang, "> 12 total reps (not used)", "> 12 повторов (не учитывается)"),
            ringLabel: pick(lang, "New record", "Новый рекорд"),
            role: "you",
            points: series.map((p) => ({ x: p.at, y: p.kg, hollow: !p.reliable, ring: prSessions.has(p.sessionId) })),
          },
        ]}
        lines={lines}
        bands={bands}
        log="auto"
        format={(v) => fmtNum(v, lang, 1)}
        unit={kg}
        xDomain={series.length === 1 ? [series[0].at - 14 * DAY_MS, Math.max(now, series[0].at + 7 * DAY_MS)] : undefined}
        table={{
          caption: pick(lang, `${name}: sessions`, `${name}: тренировки`),
          columns: [pick(lang, "Date", "Дата"), pick(lang, "e1RM", "1ПМ"), pick(lang, "Best set", "Лучший подход"), pick(lang, "Reliable", "Надёжно")],
          rows: [...series].reverse().map((p) => [fmtDay(p.at, lang, { day: "numeric", month: "short", year: "2-digit" }), fmtNum(p.kg, lang, 1), `${p.reps} × ${fmtNum(p.weightKg, lang, 1)}`, p.reliable ? pick(lang, "yes", "да") : pick(lang, "no", "нет")]),
        }}
      />
      {trendWords ? <p className="fitp-words">{trendWords}</p> : null}
      {flat?.flag ? (
        <p className="fit-note warn fitp-flag" role="status">
          {pick(
            lang,
            `No confirmed new best (≥\u00a02.5\u00a0% above the last one) for ${flat.since} sessions. If you were still progressing, a dry spell this long happens about ${fmtNum(flat.falseAlarm * 100, lang, 0)}\u00a0% of the time. If it continues: change the stimulus (rep range, variation, one more set); if you also feel run down, take a deload week.`,
            `Нет подтверждённого нового рекорда (≥\u00a02,5\u00a0% выше прошлого) уже ${flat.since} ${sessionsWord(flat.since, lang)}. Если бы прогресс шёл, такая пауза случалась бы примерно в ${fmtNum(flat.falseAlarm * 100, lang, 0)}\u00a0% случаев. Если так продолжится: смените стимул (диапазон повторов, вариант упражнения, ещё один подход); если ещё и чувствуете усталость\u00a0— сделайте разгрузочную неделю.`,
          )}
        </p>
      ) : null}
      {selected && catalog[selected]?.assistance ? (
        <p className="fitp-hint">
          {pick(lang, "Assisted machine: the effective load is body weight − assistance, using your nearest weigh-in.", "Гравитрон: рабочий вес = вес тела − помощь, по ближайшему взвешиванию.")}
        </p>
      ) : null}
      {flagged.size ? (
        <p className="fitp-hint">
          {pick(lang, "Some assisted or bodyweight sets have no estimate yet: log a weigh-in to include them.", "Часть подходов в гравитроне или с собственным весом ещё без оценки: запишите взвешивание.")}
        </p>
      ) : null}
      <h3 className="fitp-h3">{pick(lang, "Recent records", "Последние рекорды")}</h3>
      {recent.length ? (
        <ul className="fitp-prs">
          {recent.map((p) => (
            <li key={`${p.kind}-${p.setId}`}>
              <span className="fit-num fitp-prs-date">{fmtDay(p.at, lang)}</span>
              <span>{prText(p, exerciseName(catalog, p.exerciseId, lang), lang)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{pick(lang, "Records need a previous best: the first session of each exercise sets the baseline.", "Рекорду нужен прошлый результат: первая тренировка упражнения задаёт точку отсчёта.")}</Empty>
      )}
      {records.length ? (
        <details className="fitc-table">
          <summary>{pick(lang, "All exercises: current bests", "Все упражнения: лучшие результаты")}</summary>
          <div className="fitc-table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{pick(lang, "Exercise", "Упражнение")}</th>
                  <th scope="col">{pick(lang, "Best e1RM", "Лучший 1ПМ")}</th>
                  <th scope="col">{pick(lang, "Heaviest", "Максимум")}</th>
                  <th scope="col">{pick(lang, "Sessions", "Тренировок")}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.exerciseId}>
                    <th scope="row">{exerciseName(catalog, r.exerciseId, lang)}</th>
                    <td>{r.e1rm ? fmtNum(r.e1rm.kg, lang, 1) : "—"}</td>
                    <td>{r.heaviest ? `${fmtNum(r.heaviest.kg, lang, 1)} × ${r.heaviest.reps}` : "—"}</td>
                    <td>{r.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
      <Caveat>
        {pick(
          lang,
          "e1RM = mean of the Epley and Brzycki formulas on reps + reps in reserve. Only sets with ≤\u00a012 total reps and RIR ≤\u00a04 count; hollow points are above that and do not move the trend. One estimate carries about 4\u00a0% noise, so a single session up or down means little. Machines are their own instruments: compare an exercise only with itself, at the same gym.",
          "1ПМ\u00a0— среднее формул Эпли и Бжицки по повторам + повторам в запасе. Учитываются подходы с ≤\u00a012 повторами всего и запасом ≤\u00a04; полые точки\u00a0— выше этого и на тренд не влияют. У одной оценки шум около 4\u00a0%, поэтому одна тренировка вверх или вниз мало что значит. Тренажёр\u00a0— свой измерительный прибор: сравнивайте упражнение только с ним самим и в том же зале.",
        )}
      </Caveat>
    </Section>
  );
}
