"use client";
/**
 * 5 · Fitness–fatigue (stream 06): the Banister impulse–response model on daily tonnage (textbook constants, shown
 * as an index) with training days as ticks, and the uncoupled EWMA acute:chronic ratio with its 0.8–1.3 band. Both
 * descriptive, both captioned with their caveats (research/07 §C, §D).
 */
import { useMemo } from "react";
import type { Lang } from "@/lib/fitness/types";
import { pick, pluralRu } from "@/lib/fitness/i18n";
import { ACWR_ZONES, DAY_MS, acwrEwma, banister, banisterTiming, dailyLoads } from "@/lib/fitness/analytics.mjs";
import { LineChart } from "./charts";
import { fmtDay, fmtNum } from "./scales";
import { Caveat, Empty, Section, Stat } from "./shared";
import { sectionTitle } from "./names";
import type { ProgressData } from "./useProgressData";

const WINDOW_DAYS = 84;
const MODEL_FULL_DAYS = 56;
const ACWR_WARMUP = 50;
const timing = banisterTiming();
const daysWord = (n: number, lang: Lang) => (lang === "ru" ? pluralRu(n, ["день", "дня", "дней"]) : n === 1 ? "day" : "days");

export function ModelSection({ lang, data, now }: { lang: Lang; data: ProgressData; now: number }) {
  const loads = useMemo(() => dailyLoads(data.sets, { loadOf: data.tonnageOf, unitOf: data.unitOf, timeOf: data.timeOf }), [data]);
  const model = useMemo(() => banister(loads, { until: now }), [loads, now]);
  const ratio = useMemo(() => acwrEwma(loads, { until: now, warmup: ACWR_WARMUP }), [loads, now]);
  const title = sectionTitle("model", lang);
  const lede = pick(lang, "A model of how training builds up and wears off\u00a0— a picture of your load, not a prediction.", "Модель того, как тренировки накапливаются и выветриваются: картина нагрузки, а не прогноз.");
  if (loads.length < 2) {
    return (
      <Section id="model" title={title} lede={lede}>
        <Empty>{pick(lang, "Appears after two sessions with logged loads.", "Появится после двух тренировок с записанными весами.")}</Empty>
      </Section>
    );
  }
  const from = now - WINDOW_DAYS * DAY_MS;
  const shown = model.filter((d) => d.at >= from);
  const scale = Math.max(...shown.map((d) => d.fitness), 1);
  const idx = (v: number) => (v / scale) * 100;
  const today = shown[shown.length - 1];
  const history = model.length;
  const ratioShown = ratio.filter((d) => d.at >= from && d.ratio != null);
  const lastRatio = ratioShown.length ? ratioShown[ratioShown.length - 1] : null;
  const zoneWord: Record<string, string> = {
    dip: pick(lang, "below 0.8: lighter than usual", "ниже 0,8: легче обычного"),
    steady: pick(lang, "0.8–\u20601.3: steady", "0,8–\u20601,3: ровно"),
    ramping: pick(lang, "1.3–\u20601.5: ramping up", "1,3–\u20601,5: нагрузка растёт"),
    spike: pick(lang, "1.5 or more: a spike", "1,5 и больше: скачок"),
  };

  return (
    <Section id="model" title={title} lede={lede}>
      <div className="fitp-stats">
        <Stat label={pick(lang, "Form today (model)", "Форма сегодня (модель)")} value={fmtNum(idx(today.performance), lang, 0)} sub={pick(lang, "index: 100 = peak modelled fitness", "индекс: 100 = пик модельной формы")} />
        <Stat
          label={pick(lang, "Load ratio (ACWR)", "Соотношение нагрузок (ACWR)")}
          value={lastRatio?.ratio != null ? fmtNum(lastRatio.ratio, lang, 2) : "—"}
          sub={lastRatio ? zoneWord[lastRatio.zone] : pick(lang, `after ${ACWR_WARMUP} days (${history} so far)`, `через ${ACWR_WARMUP} дней (пока ${history})`)}
        />
      </div>
      {history < MODEL_FULL_DAYS ? (
        <p className="fitp-hint">
          {pick(lang, `Warming up: ${history} of ${MODEL_FULL_DAYS} days. Until then the curves mostly show that you started from zero.`, `Разгон модели: ${history} из ${MODEL_FULL_DAYS} ${daysWord(MODEL_FULL_DAYS, lang)}. До этого кривые в основном показывают старт с нуля.`)}
        </p>
      ) : null}
      <LineChart
        kind="fitness-fatigue"
        lang={lang}
        title={pick(lang, "Banister model, index", "Модель Банистера, индекс")}
        summary={pick(
          lang,
          `Model performance today ${fmtNum(idx(today.performance), lang, 0)}, fitness ${fmtNum(idx(today.fitness), lang, 0)}, fatigue ${fmtNum(idx(today.fatigue), lang, 0)} (100 = peak fitness in the last 12 weeks).`,
          `Модельная форма сегодня ${fmtNum(idx(today.performance), lang, 0)}, тренированность ${fmtNum(idx(today.fitness), lang, 0)}, усталость ${fmtNum(idx(today.fatigue), lang, 0)} (100 = пик тренированности за 12 недель).`,
        )}
        lines={[
          { key: "fitness", label: pick(lang, "Fitness (42-day memory)", "Тренированность (память 42 дня)"), role: "history", thin: true, points: shown.map((d) => ({ x: d.at, y: idx(d.fitness) })) },
          { key: "fatigue", label: pick(lang, "Fatigue (7-day memory, × 2)", "Усталость (память 7 дней, × 2)"), role: "history", style: "dotted", points: shown.map((d) => ({ x: d.at, y: idx(d.fatigue) })) },
          { key: "performance", label: pick(lang, "Performance = fitness − fatigue", "Форма = тренированность − усталость"), role: "model", points: shown.map((d) => ({ x: d.at, y: idx(d.performance) })) },
        ]}
        events={[{ key: "days", label: pick(lang, "Training day", "День тренировки"), role: "you", xs: shown.filter((d) => d.load > 0).map((d) => d.at) }]}
        includeZero
        format={(v) => fmtNum(v, lang, 0)}
        table={{
          caption: pick(lang, "Model by day", "Модель по дням"),
          columns: [pick(lang, "Date", "Дата"), pick(lang, "Tonnage, kg", "Тоннаж, кг"), pick(lang, "Fitness", "Тренир."), pick(lang, "Fatigue", "Устал."), pick(lang, "Form", "Форма")],
          rows: [...shown]
            .reverse()
            .filter((d, i) => i < 14 || d.load > 0)
            .map((d) => [fmtDay(d.at, lang), fmtNum(d.load, lang, 0), fmtNum(idx(d.fitness), lang, 0), fmtNum(idx(d.fatigue), lang, 0), fmtNum(idx(d.performance), lang, 0)]),
        }}
      />
      <Caveat>
        {pick(
          lang,
          `Textbook constants (k₁ = 1, k₂ = 2, memories of 42 and 7 days), not fitted to you: with about two strength tests a week the model cannot be identified (Hellard et al. 2006). With these constants one session's net effect turns positive after ${fmtNum(timing.tn, lang, 1)} days and peaks after ${fmtNum(timing.tg, lang, 1)}\u00a0— why a lighter week before a test helps. Input is daily tonnage, which favours light high-rep work. Read the shape, not the number.`,
          `Учебные константы (k₁ = 1, k₂ = 2, память 42 и 7 дней), не подогнанные под вас: при двух силовых замерах в неделю модель не идентифицируется (Hellard et al. 2006). С этими константами чистый эффект одной тренировки становится положительным через ${fmtNum(timing.tn, lang, 1)} дн. и максимален через ${fmtNum(timing.tg, lang, 1)}\u00a0— поэтому лёгкая неделя перед проверкой силы помогает. Вход\u00a0— дневной тоннаж, который поощряет лёгкую многоповторную работу. Смотрите на форму кривой, а не на число.`,
        )}
      </Caveat>
      {ratioShown.length >= 2 ? (
        <LineChart
          kind="acwr"
          lang={lang}
          title={pick(lang, "Acute : chronic load ratio", "Соотношение острой и хронической нагрузки")}
          summary={pick(lang, `Uncoupled EWMA ratio of the last week's load to the last month's; today ${fmtNum(lastRatio?.ratio ?? 0, lang, 2)}.`, `Разнесённое EWMA-соотношение нагрузки последней недели к последнему месяцу; сегодня ${fmtNum(lastRatio?.ratio ?? 0, lang, 2)}.`)}
          lines={[{ key: "acwr", label: pick(lang, "ACWR (7 d / 28 d, EWMA)", "ACWR (7 дн / 28 дн, EWMA)"), role: "you", points: ratioShown.map((d) => ({ x: d.at, y: d.ratio ?? 0 })) }]}
          refBands={[{ key: "steady", label: pick(lang, "0.8–\u20601.3 steady (heuristic)", "0,8–\u20601,3 ровно (эвристика)"), lo: ACWR_ZONES.dip, hi: ACWR_ZONES.steady, role: "ok" }]}
          refs={[{ key: "spike", label: pick(lang, "1.5 spike", "1,5 скачок"), y: ACWR_ZONES.ramping }]}
          yDomain={[Math.min(0.5, ...ratioShown.map((d) => d.ratio ?? 1)), Math.max(1.7, ...ratioShown.map((d) => d.ratio ?? 1))]}
          height={180}
          format={(v) => fmtNum(v, lang, 2)}
          table={{
            caption: pick(lang, "Load ratio by day", "Соотношение нагрузок по дням"),
            columns: [pick(lang, "Date", "Дата"), "ACWR"],
            rows: [...ratioShown].reverse().slice(0, 28).map((d) => [fmtDay(d.at, lang), fmtNum(d.ratio ?? 0, lang, 2)]),
          }}
        />
      ) : (
        <Empty>
          {pick(lang, `The load ratio appears after ${ACWR_WARMUP} days of history\u00a0— the averages need that long to forget their start (you have ${history}).`, `Соотношение нагрузок появится после ${ACWR_WARMUP} дней истории\u00a0— столько нужно средним, чтобы забыть старт (сейчас ${history}).`)}
        </Empty>
      )}
      <Caveat>
        {pick(
          lang,
          "Descriptive only: no study shows that steering this ratio prevents injuries (Impellizzeri et al. 2020), and the 0.8–\u20601.3 band comes from team sports. Uncoupled EWMA: this week is not divided by itself. Use it to notice sudden jumps in load, not to plan.",
          "Только описание: ни одно исследование не показало, что управление этим соотношением предотвращает травмы (Impellizzeri et al. 2020), а диапазон 0,8–\u20601,3 взят из командных видов спорта. Разнесённое EWMA: эта неделя не делится сама на себя. Используйте, чтобы заметить резкий скачок нагрузки, а не для планирования.",
        )}
      </Caveat>
    </Section>
  );
}
