"use client";
/**
 * 1 · Body weight (stream 06): weigh-in entry, raw weigh-ins + EWMA trend + a forecast cone toward a target, the
 * weekly rate with its band in words, and the caveats. Maths: analytics.mjs (dailyMean, ewma, weeklyRate, forecast,
 * timeToTarget); research/07 §E, §H.
 */
import { useMemo, useState } from "react";
import type { FitnessStore, GoalMode, Lang } from "@/lib/fitness/types";
import { kgLabel, pick } from "@/lib/fitness/i18n";
import { DAY_MS, dailyMean, ewma, forecast, timeToTarget, weeklyRate } from "@/lib/fitness/analytics.mjs";
import { LineChart, type LineSeries } from "./charts";
import { fmtDay, fmtNum, fmtSigned } from "./scales";
import { Caveat, Empty, Section, Stat, useTargets } from "./shared";
import { sectionTitle } from "./names";
import type { ProgressData } from "./useProgressData";
import { WeighIn } from "./WeighIn";

type Rate = NonNullable<ReturnType<typeof weeklyRate>>;
type Ttt = NonNullable<ReturnType<typeof timeToTarget>>;

/**
 * The weekly rate and its band, in words, with a pace verdict for a fat-loss phase (research/07 §E [49][50]): the
 * verdict is firm only when the whole 95 % band agrees; when only the point estimate does it says "most likely" and
 * names the side the band still reaches.
 */
function rateWords(lang: Lang, rate: Rate | null, losing: boolean): string {
  if (!rate) return pick(lang, "Weigh in on at least 3 different days to see a weekly rate.", "Взвесьтесь хотя бы в 3 разных дня, чтобы увидеть скорость за неделю.");
  const kg = fmtSigned(rate.kgPerWeek, lang, 2);
  const band = `${fmtSigned(rate.band[0], lang, 2)} … ${fmtSigned(rate.band[1], lang, 2)}`;
  const pct = fmtSigned(rate.pctPerWeek, lang, 2);
  const head = pick(lang, `Rate ${kg} kg/week (95\u00a0% band ${band}), ${pct}\u00a0% of body weight a week.`, `Скорость ${kg} кг/нед (95\u00a0% диапазон ${band}), ${pct}\u00a0% веса тела в неделю.`);
  const days = Math.round(rate.spanDays) + 1;
  if (!rate.reliable) {
    return `${head} ${pick(
      lang,
      `Only ${days} days and ${rate.n} weigh-ins: too early to read. Two weeks are the minimum, four before changing how you eat.`,
      `Пока ${days} дн. и ${rate.n} взвешиваний: читать рано. Нужно минимум две недели, а менять питание\u00a0— после четырёх.`,
    )}`;
  }
  if (!losing) return head;
  const [lo, hi] = rate.pctBand;
  const pBand = `${fmtSigned(lo, lang, 2)} … ${fmtSigned(hi, lang, 2)}\u00a0%`;
  const say = (en: string, ru: string) => `${head} ${pick(lang, en, ru)}`;
  // firm: the whole band is on one side
  if (lo > 0) return say(`Gaining across the whole band (${pBand} a week): if fat loss is the goal, eat less.`, `Вес растёт по всему диапазону (${pBand} в неделю): если цель\u00a0— похудение, ешьте меньше.`);
  if (hi < -1) return say(`Faster than 1\u00a0% a week across the whole band (${pBand}): at this pace strength and muscle suffer\u00a0— eat a little more.`, `Быстрее 1\u00a0% в неделю по всему диапазону (${pBand}): при таком темпе страдают сила и мышцы\u00a0— ешьте немного больше.`);
  if (lo > -0.25) return say(`Slower than 0.25\u00a0% a week across the whole band (${pBand}): if fat loss is the goal, eat a little less.`, `Медленнее 0,25\u00a0% в неделю по всему диапазону (${pBand}): если цель\u00a0— похудение, ешьте немного меньше.`);
  if (lo > -0.5) return say(`Slower than 0.5\u00a0% a week across the whole band (${pBand}): fine for a slow cut; eat a little less to reach 0.5–\u20601\u00a0%.`, `Медленнее 0,5\u00a0% в неделю по всему диапазону (${pBand}): для медленного похудения нормально; чтобы выйти на 0,5–\u20601\u00a0%, ешьте немного меньше.`);
  if (lo >= -1 && hi <= -0.5) return say(`Inside the 0.5–\u20601\u00a0% a week pace that keeps muscle, across the whole band (${pBand}).`, `В пределах 0,5–\u20601\u00a0% в неделю\u00a0— темпа, при котором сохраняются мышцы,\u00a0— по всему диапазону (${pBand}).`);
  // likely: only the point estimate is on one side
  const p = rate.pctPerWeek;
  if (p < -1) return say(`Most likely faster than 1\u00a0% a week (band ${pBand}): if it holds for another week, eat a little more.`, `Скорее всего, быстрее 1\u00a0% в неделю (диапазон ${pBand}): если так останется и через неделю, ешьте немного больше.`);
  if (p > -0.5) return say(`Most likely slower than 0.5\u00a0% a week (band ${pBand}): if it holds for another week, eat a little less.`, `Скорее всего, медленнее 0,5\u00a0% в неделю (диапазон ${pBand}): если так останется и через неделю, ешьте немного меньше.`);
  const fast = lo < -1;
  const slow = hi > -0.5;
  const side = fast && slow ? pick(lang, "both faster than 1\u00a0% and slower than 0.5\u00a0%", "как быстрее 1\u00a0%, так и медленнее 0,5\u00a0%") : fast ? pick(lang, "faster than 1\u00a0%", "быстрее 1\u00a0%") : pick(lang, "slower than 0.5\u00a0%", "медленнее 0,5\u00a0%");
  return say(`Most likely inside the 0.5–\u20601\u00a0% a week pace that keeps muscle, but the band (${pBand}) still allows ${side}: keep weighing in before changing anything.`, `Скорее всего, в пределах 0,5–\u20601\u00a0% в неделю\u00a0— темпа, при котором сохраняются мышцы,\u00a0— но диапазон (${pBand}) допускает темп ${side}: продолжайте взвешиваться, прежде чем что-то менять.`);
}

function targetWords(lang: Lang, ttt: Ttt | null, target: number, now: number, currentKg: number | null, hasForecast: boolean): string {
  const t = `${fmtNum(target, lang, 1)} ${kgLabel(lang)}`;
  if (!hasForecast || !ttt) return pick(lang, `Target ${t}: the forecast appears after 4 weigh-ins over several days.`, `Цель ${t}: прогноз появится после 4 взвешиваний в разные дни.`);
  const date = (days: number) => {
    const at = now + days * DAY_MS;
    return fmtDay(at, lang, new Date(at).getFullYear() === new Date(now).getFullYear() ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  };
  switch (ttt.status) {
    case "reached":
      return pick(lang, `Target ${t} reached: the trend is at ${fmtNum(currentKg ?? target, lang, 1)}.`, `Цель ${t} достигнута: тренд\u00a0— ${fmtNum(currentKg ?? target, lang, 1)}.`);
    case "away":
      return pick(lang, `Target ${t}: the trend is moving away from it.`, `Цель ${t}: тренд удаляется от неё.`);
    case "beyond":
      return pick(lang, `Target ${t}: more than ${Math.round(ttt.capDays)} days away at this pace\u00a0— beyond what this much data can forecast.`, `Цель ${t}: дальше ${Math.round(ttt.capDays)} дней при этом темпе\u00a0— за пределами того, что можно прогнозировать по этим данным.`);
    case "on-track": {
      const late = ttt.latestDays != null && Number.isFinite(ttt.latestDays) ? date(ttt.latestDays) : null;
      const range = late
        ? pick(lang, `90\u00a0%: ${date(ttt.earliestDays ?? 0)} – ${late}`, `90\u00a0%: ${date(ttt.earliestDays ?? 0)} – ${late}`)
        : pick(lang, `earliest ${date(ttt.earliestDays ?? 0)}; the latest date is not estimable\u00a0— the band includes no change`, `не раньше ${date(ttt.earliestDays ?? 0)}; позднюю дату оценить нельзя\u00a0— диапазон допускает отсутствие изменений`);
      return pick(lang, `Target ${t}: around ${date(ttt.days ?? 0)} at this pace (${range}).`, `Цель ${t}: примерно ${date(ttt.days ?? 0)} при этом темпе (${range}).`);
    }
  }
}

function TargetInput({ lang, target, onSave }: { lang: Lang; target: number | null; onSave: (kg: number | null) => void }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (target != null ? fmtNum(target, lang, 1) : "");
  const commit = () => {
    if (text == null) return;
    const v = Number(text.trim().replace(",", "."));
    if (!text.trim()) onSave(null);
    else if (Number.isFinite(v) && v > 20 && v < 400) onSave(Math.round(v * 10) / 10);
    setText(null);
  };
  return (
    <form
      className="fitp-target"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <label>
        <span>{pick(lang, "Target weight", "Целевой вес")}</span>
        <input inputMode="decimal" autoComplete="off" placeholder={pick(lang, "e.g. 82", "напр. 82")} value={shown} onChange={(e) => setText(e.target.value)} onBlur={commit} />
        <span aria-hidden="true">{kgLabel(lang)}</span>
      </label>
      {target != null ? (
        <button type="button" className="fit-button quiet" onClick={() => onSave(null)}>
          {pick(lang, "Clear", "Сбросить")}
        </button>
      ) : null}
    </form>
  );
}

export function BodyweightSection({ lang, data, now, canWrite, store, defaultKg, goal }: { lang: Lang; data: ProgressData; now: number; canWrite: boolean; store: FitnessStore; defaultKg: number | null; goal: GoalMode | null }) {
  const [targets, saveTargets] = useTargets();
  const target = targets.targetWeightKg ?? null;
  const daily = useMemo(() => dailyMean(data.entries.map((e) => ({ at: e.at, value: e.kg }))), [data.entries]);
  const trend = useMemo(() => ewma(daily), [daily]);
  const rate = useMemo(() => weeklyRate(trend), [trend]);
  const fc = useMemo(() => forecast(daily, target != null ? 182 : 28, { windowDays: 28, confidence: 0.9 }), [daily, target]);
  const last = trend.length ? trend[trend.length - 1] : null;
  const ttt = target != null ? timeToTarget(fc, target) : null;
  const losing = target != null && last ? target < last.trend : goal === "recomp";
  const kg = kgLabel(lang);
  const from = Math.max(daily.length ? daily[0].at : now, now - 120 * DAY_MS);
  const shown = trend.filter((p) => p.at >= from);

  const lines: LineSeries[] = [];
  if (shown.length) lines.push({ key: "trend", label: pick(lang, "Trend (EWMA, α 0.1)", "Тренд (EWMA, α 0,1)"), role: "you", points: shown.map((p) => ({ x: p.at, y: p.trend })), endLabel: fc ? undefined : fmtNum(shown[shown.length - 1].trend, lang, 1) });
  if (fc) {
    const days = Math.max(1, Math.round(fc.spanDays));
    lines.push({ key: "fit", label: pick(lang, `Fit, last ${days} days (Theil–Sen)`, `Подгонка за ${days} дн. (Тейл–Сен)`), role: "model", thin: true, points: fc.fitted.map((p) => ({ x: p.at, y: p.value })) });
    lines.push({ key: "forecast", label: pick(lang, "Forecast (straight line)", "Прогноз (прямая)"), role: "model", style: "dashed", points: fc.line.map((p) => ({ x: p.at, y: p.value })) });
  }

  const summary = last
    ? pick(
        lang,
        `Body weight trend ${fmtNum(last.trend, lang, 1)} kg on ${fmtDay(last.at, lang)}${rate ? `, rate ${fmtSigned(rate.kgPerWeek, lang, 2)} kg per week (95\u00a0% band ${fmtSigned(rate.band[0], lang, 2)} to ${fmtSigned(rate.band[1], lang, 2)})` : ""}${target != null ? `, target ${fmtNum(target, lang, 1)} kg` : ""}; ${daily.length} weigh-in days.`,
        `Тренд веса ${fmtNum(last.trend, lang, 1)} кг на ${fmtDay(last.at, lang)}${rate ? `, скорость ${fmtSigned(rate.kgPerWeek, lang, 2)} кг в неделю (95\u00a0% диапазон от ${fmtSigned(rate.band[0], lang, 2)} до ${fmtSigned(rate.band[1], lang, 2)})` : ""}${target != null ? `, цель ${fmtNum(target, lang, 1)} кг` : ""}; дней со взвешиванием: ${daily.length}.`,
      )
    : "";

  return (
    <Section
      id="weight"
      title={sectionTitle("weight", lang)}
      lede={pick(lang, "Daily weigh-ins are noisy; the trend and its weekly rate are what to read.", "Ежедневный вес шумный; смотреть стоит на тренд и его скорость за неделю.")}
    >
      {canWrite ? <WeighIn lang={lang} entries={data.entries} store={store} now={now} defaultKg={defaultKg} /> : null}
      {last ? (
        <div className="fitp-stats">
          <Stat label={pick(lang, "Trend", "Тренд")} value={`${fmtNum(last.trend, lang, 1)} ${kg}`} sub={pick(lang, `last weigh-in ${fmtNum(last.value, lang, 1)}`, `последнее ${fmtNum(last.value, lang, 1)}`)} />
          <Stat
            label={pick(lang, "Per week", "За неделю")}
            value={rate ? `${fmtSigned(rate.kgPerWeek, lang, 2)} ${kg}` : "—"}
            sub={rate ? `${fmtSigned(rate.band[0], lang, 2)} … ${fmtSigned(rate.band[1], lang, 2)}` : pick(lang, "needs 3 days", "нужно 3 дня")}
          />
        </div>
      ) : null}
      {daily.length >= 2 ? (
        <LineChart
          kind="bodyweight"
          lang={lang}
          title={pick(lang, `Body weight, ${kg}`, `Вес тела, ${kg}`)}
          summary={summary}
          dots={[{ key: "raw", label: pick(lang, "Weigh-ins (daily mean)", "Взвешивания (среднее за день)"), role: "history", small: true, points: shown.map((p) => ({ x: p.at, y: p.value })) }]}
          lines={lines}
          bands={fc ? [{ key: "band", label: pick(lang, "90\u00a0% band of the trend", "90\u00a0% диапазон тренда"), role: "model", points: fc.band.map((b) => ({ x: b.at, lo: b.lo, hi: b.hi })) }] : []}
          refs={target != null ? [{ key: "target", label: pick(lang, `Target ${fmtNum(target, lang, 1)}`, `Цель ${fmtNum(target, lang, 1)}`), y: target }] : []}
          format={(v) => fmtNum(v, lang, 1)}
          unit={kg}
          table={{
            caption: pick(lang, "Weigh-ins and trend", "Взвешивания и тренд"),
            columns: [pick(lang, "Date", "Дата"), pick(lang, "Weigh-in", "Вес"), pick(lang, "Trend", "Тренд")],
            rows: [...trend].reverse().slice(0, 60).map((p) => [fmtDay(p.at, lang, { day: "numeric", month: "short", year: "2-digit" }), fmtNum(p.value, lang, 1), fmtNum(p.trend, lang, 2)]),
          }}
        />
      ) : (
        <Empty>
          {daily.length === 1
            ? pick(lang, "One weigh-in so far. The chart starts with the second day; the trend settles after about two weeks.", "Пока одно взвешивание. График появится со второго дня; тренд устоится примерно за две недели.")
            : pick(lang, "No weigh-ins yet. Weigh yourself in the morning, after the toilet and before breakfast, and log it here.", "Взвешиваний пока нет. Взвешивайтесь утром, после туалета и до завтрака, и записывайте здесь.")}
        </Empty>
      )}
      {daily.length ? <p className="fitp-words">{rateWords(lang, rate, losing)}</p> : null}
      <TargetInput lang={lang} target={target} onSave={(v) => saveTargets(v == null ? {} : { targetWeightKg: v })} />
      {target != null ? <p className="fitp-words">{targetWords(lang, ttt, target, now, fc?.current ?? last?.trend ?? null, Boolean(fc))}</p> : null}
      <Caveat>
        {pick(
          lang,
          "Day-to-day weight swings by about 0.5\u00a0% of body mass (water, salt, glycogen)\u00a0— more than a week of fat loss. The trend (EWMA, α 0.1, about 9 days of lag) is the signal; the rate is a robust (Theil–Sen) slope of the raw weigh-ins over the last 28 days, its band widened for runs of water retention. Because of that lag the EWMA runs above the fitted line while weight is falling; the forecast starts from the fit. The forecast is a straight line whose band covers the trend, not single weigh-ins, and stops at twice the data span: real loss slows as the body adapts. Target pace for keeping muscle: 0.5–\u20601\u00a0% of body weight a week (Helms et al. 2014; Garthe et al. 2011).",
          "Вес от дня ко дню колеблется примерно на 0,5\u00a0% массы тела (вода, соль, гликоген)\u00a0— больше, чем неделя жиросжигания. Сигнал\u00a0— тренд (EWMA, α 0,1, запаздывание около 9 дней); скорость\u00a0— устойчивый (Тейл–Сен) наклон сырых взвешиваний за последние 28 дней, диапазон расширен с учётом задержек воды. Из-за запаздывания EWMA при снижении веса идёт выше линии подгонки; прогноз начинается от подгонки. Прогноз\u00a0— прямая; его диапазон описывает тренд, а не отдельные взвешивания, и обрывается на удвоенном сроке данных: на практике похудение замедляется. Темп, сохраняющий мышцы: 0,5–\u20601\u00a0% веса в неделю (Helms et al. 2014; Garthe et al. 2011).",
        )}
      </Caveat>
    </Section>
  );
}
