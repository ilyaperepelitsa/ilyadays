"use client";
/**
 * Heart-rate zones and VO2max field tests (stream 09 — plans/fitness/09-nutrition.md): Tanaka HRmax (or a measured
 * one), five Karvonen zones with zone 2 highlighted, "which zone is this heart rate", the Cooper 12-minute run and the
 * Uth heart-rate-ratio estimate, both also as METs. Zone 2 starts in its lower part until a talk test sets the
 * ceiling (research 05, Table 3). Shares the calculator's inputs (age is the same field).
 */
import type { Lang } from "@/lib/fitness/types";
import { keepUnits, pick, t2 } from "@/lib/fitness/i18n";
import { HEART, ZONES, hrMaxTanaka, hrZones, vo2maxCooper, vo2maxUth, zone2Range, zoneOf } from "@/lib/fitness/nutrition.mjs";
import { useFitness } from "@/components/fitness/Provider";
import { toNum, useNutritionInputs } from "./inputs";
import { NumberField, Refs, fmt, fmtUpTo } from "./ui";

export function HeartCard({ lang }: { lang: Lang }) {
  const T = (en: string, ru: string) => keepUnits(pick(lang, en, ru));
  const { snapshot } = useFitness();
  const { get, set } = useNutritionInputs(snapshot);
  const bpm = T("bpm", "уд/мин");

  const age = get("age", "35");
  const hrRest = get("hrRest", "60");
  const hrMax = get("hrMax", "");
  const cooper = get("cooperM", "");
  const hrNow = get("hrNow", "");
  const ceiling = get("z2Ceiling", "");
  const ageN = toNum(age.value);
  const restN = toNum(hrRest.value);
  const maxN = toNum(hrMax.value);
  const cooperN = toNum(cooper.value);
  const nowN = toNum(hrNow.value);
  const ceilingN = toNum(ceiling.value);

  const predicted = hrMaxTanaka(ageN);
  const zones = hrZones({ age: ageN, hrRest: restN, hrMax: maxN });
  const z = "error" in zones ? null : zones;
  const current = z && nowN != null ? zoneOf(nowN, z) : null;
  const currentZone = current && !("error" in current) ? current.zone : null;
  const cooperR = cooperN != null ? vo2maxCooper(cooperN) : null;
  // The ratio method needs the person's own resting heart rate, not the example value.
  const uth = z && hrRest.source !== "default" ? vo2maxUth(z.hrMax, z.hrRest) : null;
  const zone2 = z?.zones.find((x) => x.zone === 2);
  const z2Own = z && ceilingN != null ? zone2Range(z, ceilingN) : null;
  const ceilingBad = z2Own != null && "error" in z2Own;
  const z2Calibrated = z2Own && !("error" in z2Own) ? z2Own : null;
  const z2StartR = z ? zone2Range(z) : null;
  const z2Start = z2StartR && !("error" in z2StartR) ? z2StartR : null;
  const Z2 = HEART.zone2;
  // A calibrated zone 2 can overlap Karvonen zone 1 or 3: say so when the checked heart rate is inside it.
  const inOwnZone2 = z2Calibrated != null && nowN != null && nowN >= z2Calibrated.from && nowN <= z2Calibrated.to && currentZone !== 2;

  const zonesError =
    "error" in zones
      ? zones.error === "hrRest"
        ? T("Enter a resting heart rate between 30 and 110 bpm.", "Введите пульс покоя от 30 до 110 уд/мин.")
        : zones.error === "age"
          ? T("Enter an age between 15 and 90.", "Введите возраст от 15 до 90 лет.")
          : T("Max heart rate must be 100–230 bpm and at least 30 above resting.", "Максимальный пульс — 100–230 уд/мин и хотя бы на 30 выше пульса покоя.")
      : null;

  return (
    <section className="nut-heart" aria-labelledby="nut-heart-title">
      <h2 id="nut-heart-title">{T("Heart-rate zones and VO2max", "Пульсовые зоны и МПК")}</h2>
      <p className="nut-lede">
        {T(
          "For the cardio half of a longevity plan: most minutes in zone 2, a few hard intervals near the top.",
          "Для кардио-части плана долголетия: большинство минут — в зоне 2, немного тяжёлых интервалов у верхней границы.",
        )}
      </p>

      <div className="fit-card">
        <div className="nut-fields">
          <NumberField id="nut-hr-age" label={T("Age", "Возраст")} unit={T("years", "лет")} value={age.value} onChange={(v) => set({ age: v })} />
          <NumberField
            id="nut-hr-rest"
            label={T("Resting heart rate", "Пульс покоя")}
            unit={bpm}
            value={hrRest.value}
            hint={
              hrRest.source === "default"
                ? T("Example: measure yours after waking, lying down", "Пример: измерьте свой утром лёжа")
                : T("After waking, lying down; average a few mornings", "Утром лёжа; лучше среднее за несколько дней")
            }
            onChange={(v) => set({ hrRest: v })}
          />
          <NumberField
            id="nut-hr-max"
            label={T("Max heart rate", "Максимальный пульс")}
            unit={bpm}
            value={hrMax.value}
            placeholder={"error" in predicted ? T("optional", "необязательно") : `≈ ${fmt(predicted.hrMax, lang)}`}
            hint={T("Measured, if you know it", "Измеренный, если знаете")}
            onChange={(v) => set({ hrMax: v })}
          />
          <NumberField
            id="nut-hr-now"
            label={T("Check a heart rate", "Проверить пульс")}
            unit={bpm}
            value={hrNow.value}
            placeholder="140"
            hint={
              currentZone != null
                ? currentZone === 0
                  ? T("Below zone 1", "Ниже зоны 1")
                  : `${T("Zone", "Зона")} ${currentZone} · ${t2(lang, ZONES[currentZone - 1].name)}${inOwnZone2 ? T(" · your talk-test zone 2", " · ваша зона 2 по тесту") : ""}`
                : T("Which zone is it?", "В какой это зоне?")
            }
            onChange={(v) => set({ hrNow: v })}
          />
        </div>

        {z ? (
          <>
            <p className="nut-small fit-muted fit-num">
              {z.measured
                ? T(`Max ${fmt(z.hrMax, lang)} bpm (measured)`, `Максимум ${fmt(z.hrMax, lang)} уд/мин (измерен)`)
                : T(`Max ≈ ${fmtUpTo(z.hrMax, lang, 1)} bpm (Tanaka: 208 − 0.7 × age)`, `Максимум ≈ ${fmtUpTo(z.hrMax, lang, 1)} уд/мин (Танака: 208 − 0,7 × возраст)`)}{" "}
              <Refs ids={HEART.hrMax.source} lang={lang} /> · {T(`reserve ${fmtUpTo(z.reserve, lang, 1)} bpm`, `резерв ${fmtUpTo(z.reserve, lang, 1)} уд/мин`)}
            </p>
            <table className="nut-zones fit-num">
              <caption className="sr-only">{T("Karvonen heart-rate zones", "Пульсовые зоны по Карвонену")}</caption>
              <thead>
                <tr>
                  <th scope="col">{T("Zone", "Зона")}</th>
                  <th scope="col">{T("% reserve", "% резерва")}</th>
                  <th scope="col">{bpm}</th>
                </tr>
              </thead>
              <tbody>
                {z.zones.map((row) => {
                  const info = ZONES[row.zone - 1];
                  return (
                    <tr key={row.zone} className={`${row.zone === 2 ? "is-z2" : ""}${currentZone === row.zone ? " is-now" : ""}`}>
                      <th scope="row">
                        <span className="nut-zone-name">
                          {row.zone} · {t2(lang, info.name)}
                        </span>
                        <small>{keepUnits(t2(lang, info.feel))}</small>
                      </th>
                      <td>{keepUnits(`${row.pct[0]}–${row.pct[1]}`)}</td>
                      <td>
                        <b>{keepUnits(`${row.from}–${row.to}`)}</b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {zone2 ? (
              <p className="fit-note editing fit-num">
                {z2Calibrated
                  ? T(
                      `Zone 2 from your talk test: ${z2Calibrated.from}–${z2Calibrated.to} bpm (formula: ${zone2.from}–${zone2.to}).`,
                      `Зона 2 по вашему разговорному тесту: ${z2Calibrated.from}–${z2Calibrated.to} уд/мин (по формуле: ${zone2.from}–${zone2.to}).`,
                    )
                  : z2Start
                    ? T(
                        `Zone 2: ${zone2.from}–${zone2.to} bpm. Until a talk test sets your own ceiling, start at ${z2Start.from}–${z2Start.to} bpm, and slow down whenever full sentences stop being comfortable.`,
                        `Зона 2: ${zone2.from}–${zone2.to} уд/мин. Пока разговорный тест не задал ваш потолок, начинайте с ${z2Start.from}–${z2Start.to} уд/мин и сбавляйте темп, как только говорить полными фразами становится трудно.`,
                      )
                    : null}{" "}
                <Refs ids={Z2.source} lang={lang} />
              </p>
            ) : null}
            <p className="nut-small fit-muted">
              {keepUnits(t2(lang, HEART.zonesNote))} <Refs ids={HEART.zonesSource} lang={lang} />{" "}
              {T(
                `ACSM: moderate ${HEART.acsm.moderatePctHrr[0]}–${HEART.acsm.moderatePctHrr[1]} %, vigorous ${HEART.acsm.vigorousPctHrr[0]}–${HEART.acsm.vigorousPctHrr[1]} % of reserve, so zone 2 starts where “vigorous” begins.`,
                `ACSM: умеренная нагрузка ${HEART.acsm.moderatePctHrr[0]}–${HEART.acsm.moderatePctHrr[1]} %, высокая ${HEART.acsm.vigorousPctHrr[0]}–${HEART.acsm.vigorousPctHrr[1]} % резерва, то есть зона 2 начинается там, где начинается «высокая».`,
              )}{" "}
              <Refs ids={HEART.acsm.source} lang={lang} />
            </p>
            <details className="nut-how" open={ceiling.source === "edit" && ceiling.value !== ""}>
              <summary>{T("Find your own zone 2 with a talk test", "Найти свою зону 2 разговорным тестом")}</summary>
              <ol>
                <li>
                  {T(
                    `Warm up for 5 minutes, then make it a little harder every ${Z2.stageMinutes} minutes: +0.5 km/h or +2 % incline on a treadmill, +15–25 W on a bike or rower.`,
                    `Разомнитесь 5 минут, затем каждые ${Z2.stageMinutes} минуты чуть усложняйте: +0,5 км/ч или +2 % наклона на дорожке, +15–25 Вт на велотренажёре или гребном.`,
                  )}
                </li>
                <li>
                  {T(
                    "In the last 30 seconds of each stage, say a short passage aloud (about 30 words) and ask yourself: can I speak comfortably? Yes, not entirely, or no.",
                    "В последние 30 секунд каждой ступени произнесите вслух короткий текст (около 30 слов) и спросите себя: могу ли я говорить спокойно? Да, не совсем или нет.",
                  )}
                </li>
                <li>
                  {T(
                    `Your ceiling is the heart rate of the last “yes” stage; zone 2 is the ${Z2.bandBelowCeilingBpm} bpm below it. Stop when the answer is “no”.`,
                    `Потолок — пульс на последней ступени с ответом «да»; зона 2 — ${Z2.bandBelowCeilingBpm} уд/мин ниже него. Когда ответ «нет», остановитесь.`,
                  )}
                </li>
                <li>
                  {T(
                    `Repeat every ${Z2.repeatWeeks[0]}–${Z2.repeatWeeks[1]} weeks on the machine you use most: the threshold moves as you get fitter.`,
                    `Повторяйте раз в ${Z2.repeatWeeks[0]}–${Z2.repeatWeeks[1]} недель на тренажёре, которым пользуетесь чаще всего: порог сдвигается по мере роста формы.`,
                  )}
                </li>
              </ol>
              <div className="nut-fields nut-fields-one">
                <NumberField
                  id="nut-z2-ceiling"
                  label={T("Your talk-test ceiling", "Ваш потолок по тесту")}
                  unit={bpm}
                  value={ceiling.value}
                  invalid={ceilingBad}
                  hint={
                    ceilingBad
                      ? T(
                          `Between ${z.hrRest + Z2.bandBelowCeilingBpm + 1} and ${Math.ceil(z.hrMax) - 1} bpm`,
                          `От ${z.hrRest + Z2.bandBelowCeilingBpm + 1} до ${Math.ceil(z.hrMax) - 1} уд/мин`,
                        )
                      : T("Heart rate in the last “yes” stage", "Пульс на последней ступени «да»")
                  }
                  onChange={(v) => set({ z2Ceiling: v })}
                />
              </div>
            </details>
          </>
        ) : (
          <p className="fit-note warn" role="status">{zonesError}</p>
        )}
      </div>

      <div className="fit-card">
        <h3>{T("VO2max estimate", "Оценка МПК (VO2max)")}</h3>
        <div className="nut-fields nut-fields-one">
          <NumberField
            id="nut-cooper"
            label={T("Cooper test: metres in 12 minutes", "Тест Купера: метров за 12 минут")}
            unit={T("m", "м")}
            value={cooper.value}
            placeholder="2400"
            invalid={cooper.value !== "" && cooperR != null && "error" in cooperR}
            hint={T("Run as far as you can on a flat track", "Бегите как можно дальше по ровной дорожке")}
            onChange={(v) => set({ cooperM: v })}
          />
        </div>
        <dl className="fit-kv nut-kv fit-num">
          <dt>{T("Cooper", "Купер")}</dt>
          <dd>
            {cooperR && !("error" in cooperR)
              ? T(
                  `≈ ${fmtUpTo(cooperR.vo2max, lang, 1)} ml/kg/min · ${fmtUpTo(cooperR.mets, lang, 1)} METs`,
                  `≈ ${fmtUpTo(cooperR.vo2max, lang, 1)} мл/кг/мин · ${fmtUpTo(cooperR.mets, lang, 1)} МЕТ`,
                )
              : cooperR
                ? T(`Enter ${HEART.cooper.minMetres}–${HEART.cooper.maxMetres} m.`, `Введите ${HEART.cooper.minMetres}–${HEART.cooper.maxMetres} м.`)
                : T("(d − 504.9) / 44.73", "(d − 504,9) / 44,73")}{" "}
            <Refs ids={HEART.cooper.source} lang={lang} />
          </dd>
          <dt>{T("Heart-rate ratio", "По пульсу")}</dt>
          <dd>
            {uth && !("error" in uth)
              ? T(
                  `≈ ${fmtUpTo(uth.vo2max, lang, 1)} ml/kg/min · ${fmtUpTo(uth.mets, lang, 1)} METs (rough: derived in well-trained men)`,
                  `≈ ${fmtUpTo(uth.vo2max, lang, 1)} мл/кг/мин · ${fmtUpTo(uth.mets, lang, 1)} МЕТ (грубо: выведено на тренированных мужчинах)`,
                )
              : T("Enter your resting heart rate above.", "Введите свой пульс покоя выше.")}{" "}
            <Refs ids={HEART.uth.source} lang={lang} />
          </dd>
        </dl>
        <p className="nut-small fit-muted">
          {T(
            `1 MET = ${fmtUpTo(HEART.mlPerMet, lang, 1)} ml/kg/min. In a meta-analysis of healthy adults, every extra MET of fitness went with about ${HEART.perMetMortalityPct} % lower all-cause mortality, and in 122,007 treadmill tests the fittest group did best, with no upper limit.`,
            `1 МЕТ = ${fmtUpTo(HEART.mlPerMet, lang, 1)} мл/кг/мин. В метаанализе здоровых взрослых каждый дополнительный МЕТ выносливости соответствовал примерно на ${HEART.perMetMortalityPct} % меньшей смертности от всех причин, а в 122\u00a0007 нагрузочных тестах лучше всех были самые выносливые — без верхнего предела.`,
          )}{" "}
          <Refs ids={HEART.fitnessSource} lang={lang} />
        </p>
      </div>
    </section>
  );
}
