"use client";
/**
 * 3 · Volume (stream 06): weekly hard sets for the last 8 weeks — all groups (bars, per-group breakdown on hover) or
 * one group (direct + indirect stacked, with the 10–20 band) — a weeks × groups heatmap with the band overlay, and
 * tonnage per week. Fractional counting (direct 1, indirect ½): research/07 §B, Pelland et al. 2025.
 */
import { useMemo, useState } from "react";
import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { TARGET_SETS_PER_WEEK, weeklyTonnage, weeklyVolumeByGroup } from "@/lib/fitness/analytics.mjs";
import { Bars, Heatmap, Sparkline } from "./charts";
import { fmtDay, fmtNum } from "./scales";
import { Caveat, Empty, Section, Stat, groupName } from "./shared";
import { sectionTitle } from "./names";
import type { ProgressCatalog, ProgressGroup } from "./types";
import type { ProgressData } from "./useProgressData";

const WEEKS = 8;
const [LO, HI] = TARGET_SETS_PER_WEEK;

export function VolumeSection({ lang, data, catalog, groups, now }: { lang: Lang; data: ProgressData; catalog: ProgressCatalog; groups: ProgressGroup[]; now: number }) {
  const order = useMemo(() => groups.map((g) => g.id), [groups]);
  const vol = useMemo(
    () => weeklyVolumeByGroup(data.sets, (id) => (catalog[id] ? { groups: catalog[id].groups } : undefined), () => undefined, { weeks: WEEKS, now, timeOf: data.timeOf, order }),
    [data.sets, data.timeOf, catalog, now, order],
  );
  const tons = useMemo(() => weeklyTonnage(data.sets, { weeks: WEEKS, now, loadOf: data.tonnageOf, unitOf: data.unitOf, timeOf: data.timeOf }), [data, now]);
  const [picked, setPicked] = useState<string>("all");
  const group = picked !== "all" && vol.groups.includes(picked) ? picked : "all";
  const fmt = (v: number) => fmtNum(v, lang, 1);
  const cats = vol.weeks.map((w, i) => ({ key: w.key, label: fmtDay(w.start, lang), current: i === vol.weeks.length - 1 }));
  const anySets = vol.hard.some((v) => v > 0);
  const name = (g: string) => groupName(groups, g, lang);
  const thisWeek = vol.hard[vol.hard.length - 1];
  const done = vol.hard.slice(0, -1);
  const avg = done.length ? done.reduce((a, b) => a + b, 0) / done.length : 0;
  const tonsThis = tons.values[tons.values.length - 1];
  const tonsDone = tons.values.slice(0, -1);

  if (!anySets) {
    return (
      <Section id="volume" title={sectionTitle("volume", lang)} lede={pick(lang, "Hard sets per muscle group per week, against the 10–\u206020 range.", "Тяжёлые подходы на группу мышц в неделю\u00a0— против диапазона 10–\u206020.")}>
        <Empty>{pick(lang, "No hard sets in the last 8 weeks yet. Each working set you log counts toward the muscles it trains.", "За последние 8 недель тяжёлых подходов пока нет. Каждый записанный рабочий подход засчитывается мышцам, которые он нагружает.")}</Empty>
      </Section>
    );
  }

  const indirect = group === "all" ? [] : vol.sets[group].map((v, i) => Math.max(0, v - vol.direct[group][i]));
  const weekTitle = (i: number) => pick(lang, `week of ${cats[i].label}`, `неделя с ${cats[i].label}`);

  return (
    <Section id="volume" title={sectionTitle("volume", lang)} lede={pick(lang, "Hard sets per muscle group per week, against the 10–\u206020 range.", "Тяжёлые подходы на группу мышц в неделю\u00a0— против диапазона 10–\u206020.")}>
      <div className="fitp-stats">
        <Stat label={pick(lang, "Hard sets this week so far", "Тяжёлых подходов за неделю (пока)")} value={fmtNum(thisWeek, lang, 0)} sub={pick(lang, `previous ${done.length} weeks: avg ${fmtNum(avg, lang, 1)}`, `прошлые ${done.length} нед.: в среднем ${fmtNum(avg, lang, 1)}`)}>
          {done.length >= 2 ? <Sparkline values={done} summary={pick(lang, `Hard sets per full week, last ${done.length} weeks: ${done.join(", ")}`, `Тяжёлые подходы по полным неделям за ${done.length} недель: ${done.join(", ")}`)} /> : null}
        </Stat>
        <Stat label={pick(lang, "Tonnage this week so far", "Тоннаж за неделю (пока)")} value={`${fmtNum(tonsThis / 1000, lang, 1)} ${pick(lang, "t", "т")}`} sub={pick(lang, "kg × reps, rep sets only", "кг × повторы, без удержаний")}>
          {tonsDone.length >= 2 ? (
            <Sparkline values={tonsDone} summary={pick(lang, `Tonnage per full week in tonnes: ${tonsDone.map((v) => fmtNum(v / 1000, lang, 1)).join(", ")}`, `Тоннаж по полным неделям, т: ${tonsDone.map((v) => fmtNum(v / 1000, lang, 1)).join(", ")}`)} />
          ) : null}
        </Stat>
      </div>
      <div className="fit-seg fitp-groups" role="group" aria-label={pick(lang, "Muscle group", "Группа мышц")}>
        <button type="button" aria-pressed={group === "all"} onClick={() => setPicked("all")}>
          {pick(lang, "All", "Все")}
        </button>
        {vol.groups.map((g) => (
          <button key={g} type="button" aria-pressed={group === g} onClick={() => setPicked(g)}>
            {name(g)}
          </button>
        ))}
      </div>
      {group === "all" ? (
        <Bars
          kind="volume"
          lang={lang}
          title={pick(lang, "Hard sets per week, all groups", "Тяжёлые подходы в неделю, все группы")}
          summary={pick(lang, `Hard sets per week for the last ${WEEKS} weeks: ${vol.hard.join(", ")}. This week ${thisWeek}.`, `Тяжёлые подходы по неделям за ${WEEKS} недель: ${vol.hard.join(", ")}. На этой неделе ${thisWeek}.`)}
          categories={cats}
          series={[{ key: "hard", label: pick(lang, "Hard sets", "Тяжёлые подходы"), role: "you", values: vol.hard }]}
          format={(v) => fmtNum(v, lang, 0)}
          details={(i) =>
            vol.groups
              .map((g) => [g, vol.primary[g][i]] as const)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([g, v]) => `${name(g)} ${fmt(v)}`)
          }
          table={{
            caption: pick(lang, "Hard sets per week by primary group", "Тяжёлые подходы по неделям и основным группам"),
            columns: [pick(lang, "Week", "Неделя"), pick(lang, "Hard sets", "Подходы"), ...vol.groups.map(name)],
            rows: cats.map((c, i) => [c.label, vol.hard[i], ...vol.groups.map((g) => fmt(vol.primary[g][i]))]),
          }}
        />
      ) : (
        <Bars
          kind="volume-group"
          lang={lang}
          title={pick(lang, `${name(group)}: sets per week (direct + ½ indirect)`, `${name(group)}: подходы в неделю (прямые + ½ косвенных)`)}
          summary={pick(lang, `${name(group)} fractional sets per week: ${vol.sets[group].map(fmt).join(", ")}; target ${LO}–\u2060${HI}.`, `${name(group)}, подходы в неделю: ${vol.sets[group].map(fmt).join(", ")}; цель ${LO}–\u2060${HI}.`)}
          categories={cats}
          series={[
            { key: "direct", label: pick(lang, "Direct sets (× 1)", "Прямые подходы (× 1)"), role: "you", values: vol.direct[group] },
            { key: "indirect", label: pick(lang, "Indirect sets (× ½)", "Косвенные подходы (× ½)"), role: "you", soft: true, values: indirect },
          ]}
          band={{ lo: LO, hi: HI, label: pick(lang, `${LO}–\u2060${HI} sets/week (priority muscles)`, `${LO}–\u2060${HI} подходов/нед (приоритетные мышцы)`) }}
          format={fmt}
          table={{
            caption: pick(lang, `${name(group)}: sets per week`, `${name(group)}: подходы в неделю`),
            columns: [pick(lang, "Week", "Неделя"), pick(lang, "Fractional", "Итого"), pick(lang, "Direct", "Прямые"), pick(lang, "Indirect × ½", "Косвенные × ½")],
            rows: cats.map((c, i) => [c.label, fmt(vol.sets[group][i]), fmt(vol.direct[group][i]), fmt(indirect[i])]),
          }}
        />
      )}
      <Heatmap
        kind="volume-heatmap"
        lang={lang}
        title={pick(lang, `Sets per week by group (direct + ½ indirect)`, `Подходы в неделю по группам (прямые + ½ косвенных)`)}
        summary={pick(
          lang,
          `This week: ${vol.groups.map((g) => `${name(g)} ${fmt(vol.sets[g][WEEKS - 1])}`).join(", ")}. Target ${LO}–\u2060${HI} per group.`,
          `На этой неделе: ${vol.groups.map((g) => `${name(g)} ${fmt(vol.sets[g][WEEKS - 1])}`).join(", ")}. Цель ${LO}–\u2060${HI} на группу.`,
        )}
        columns={cats}
        rows={vol.groups.map((g) => ({ key: g, label: name(g), values: vol.sets[g] }))}
        band={[LO, HI]}
        format={(v) => fmtNum(v, lang, 1)}
        cellText={(r, c) => {
          const g = vol.groups[r];
          const v = vol.sets[g][c];
          const where = v >= LO && v <= HI ? pick(lang, "in range", "в диапазоне") : v > HI ? pick(lang, "above the range", "выше диапазона") : pick(lang, "below the range", "ниже диапазона");
          return pick(lang, `${name(g)}, ${weekTitle(c)}: ${fmt(v)} sets (${fmt(vol.direct[g][c])} direct)\u00a0— ${where}`, `${name(g)}, ${weekTitle(c)}: ${fmt(v)} подх. (${fmt(vol.direct[g][c])} прямых)\u00a0— ${where}`);
        }}
        table={{
          caption: pick(lang, "Fractional sets per group and week", "Подходы по группам и неделям"),
          columns: [pick(lang, "Group", "Группа"), ...cats.map((c) => c.label)],
          rows: vol.groups.map((g) => [name(g), ...vol.sets[g].map(fmt)]),
        }}
      />
      <Caveat>
        {pick(
          lang,
          `A hard set is a working set that ends ≤\u00a04 reps short of failure. It counts 1 for each muscle group it trains directly and ½ for each it trains indirectly (a row: back 1, biceps ½)\u00a0— the counting that predicted gains best in the 2025 dose–response meta-regression (Pelland et al.). ${LO}–\u2060${HI} sets a week is the growth range for priority muscles such as the chest; strength needs less (about 4 sets per exercise a week captures most of it). Tonnage rewards light high-rep work and compares only within one exercise. “Other” = exercises the catalog does not know yet.`,
          `Тяжёлый подход\u00a0— рабочий подход, законченный не дальше 4 повторов от отказа. Он засчитывается 1 каждой группе, которую нагружает напрямую, и ½\u00a0— косвенно (тяга: спина 1, бицепс ½); такой счёт лучше всего предсказывал результат в мета-регрессии 2025 года (Pelland et al.). ${LO}–\u2060${HI} подходов в неделю\u00a0— диапазон роста для приоритетных мышц, например груди; силе нужно меньше (около 4 подходов на упражнение в неделю дают основную часть эффекта). Тоннаж поощряет лёгкую многоповторную работу и сравним только внутри одного упражнения. «Другое»\u00a0— упражнения, которых ещё нет в каталоге.`,
        )}
      </Caveat>
    </Section>
  );
}
