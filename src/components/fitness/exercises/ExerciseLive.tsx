"use client";
/**
 * Client islands of the exercise page (stream 02): program/gym status, alternatives with gym marks, and the
 * personal history. They read the fitness snapshot; everything else on the page is static.
 */
import Link from "next/link";
import { useMemo } from "react";
import { localPath } from "@/lib/i18n";
import { useFitness } from "@/components/fitness/Provider";
import { LineChart } from "@/components/fitness/progress/charts";
import { isAvailable } from "@/lib/fitness/catalog-core.mjs";
import { fmtDate, fmtKg, kgLabel, pick, pluralRu } from "@/lib/fitness/i18n";
import type { Lang, LoggedSet } from "@/lib/fitness/types";
import { exerciseHistory, type HistoryFacts } from "./history.mjs";
import { useActive, useActiveGym, type TemplateDays } from "./useActive";

/** One alternative as the server prepares it (names already in the page language). */
export type AltItem = { id: string; name: string; className: string; equipment: string };

const href = (lang: Lang, id: string) => localPath(lang, `/fitness/exercises/${id}`);

/** "In my program · A1" and, when the active gym lacks this exercise, the swap to use there. */
export function ProgramStatus({ lang, exerciseId, template, alternatives }: { lang: Lang; exerciseId: string; template: TemplateDays; alternatives: AltItem[] }) {
  const { gym, slots } = useActive(template);
  const mine = slots[exerciseId] ?? [];
  const missing = gym ? !isAvailable(exerciseId, gym) : false;
  const preferred = gym?.preferred?.[exerciseId];
  const swap = missing ? (alternatives.find((a) => a.id === preferred) ?? alternatives.find((a) => isAvailable(a.id, gym))) : undefined;
  if (!mine.length && !missing) return null;
  return (
    <div className="fx-status">
      {mine.length ? (
        <span className="fx-badge mine">
          {pick(lang, "In my program", "В моей программе")} · <span className="fit-num">{mine.join(", ")}</span>
        </span>
      ) : null}
      {missing && gym ? (
        <p className="fit-note warn">
          {pick(lang, `Not available at ${gym.name}.`, `Нет в зале «${gym.name}».`)}{" "}
          {swap ? (
            <>
              {pick(lang, "Use instead:", "Замена:")}{" "}
              <Link prefetch={false} href={href(lang, swap.id)}>
                {swap.name}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Ordered alternatives with their class and equipment, marked for the active gym. */
export function AlternativesList({ lang, exerciseId, items }: { lang: Lang; exerciseId: string; items: AltItem[] }) {
  const gym = useActiveGym();
  const preferred = gym?.preferred?.[exerciseId];
  return (
    <>
      <ol className="fx-alts">
        {items.map((a) => {
          const ok = gym ? isAvailable(a.id, gym) : null;
          return (
            <li key={a.id} data-available={ok === null ? undefined : String(ok)}>
              <Link prefetch={false} href={href(lang, a.id)} className="fx-alt">
                <span className="fx-alt-name">{a.name}</span>
                <span className="fx-alt-meta">
                  {a.className} · {a.equipment}
                </span>
                {ok === null ? null : (
                  <span className={ok ? "fx-mark ok" : "fx-mark no"}>
                    {!ok
                      ? pick(lang, "✕ not at your gym", "✕ нет в вашем зале")
                      : a.id === preferred
                        ? pick(lang, "★ your choice at this gym", "★ ваш выбор в этом зале")
                        : pick(lang, "✓ at your gym", "✓ есть в вашем зале")}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="fx-small fit-muted">
        {gym
          ? pick(lang, `Marks are for ${gym.name}.`, `Отметки — для зала «${gym.name}».`)
          : pick(lang, "Pick your gym to see which of these it has:", "Выберите свой зал, чтобы видеть, что в нём есть:")}{" "}
        {gym ? null : (
          <Link prefetch={false} href={localPath(lang, "/fitness/gyms")}>
            {pick(lang, "Gyms", "Залы")}
          </Link>
        )}
      </p>
    </>
  );
}

function setText(lang: Lang, s: LoggedSet, unit: HistoryFacts["repUnit"], assisted: boolean) {
  const kg = `${fmtKg(s.kg, lang)} ${kgLabel(lang)}`;
  if (unit === "seconds") return s.kg > 0 ? `${s.reps} ${pick(lang, "s", "с")} · ${kg}` : `${s.reps} ${pick(lang, "s", "с")}`;
  if (unit === "meters") return `${s.reps} ${pick(lang, "m", "м")} × ${kg}`;
  return `${s.reps} × ${kg}${assisted ? pick(lang, " assist", " помощь") : ""}`;
}

/** Best set and estimated 1RM per session (nothing until this exercise has logged sets). */
export function ExerciseHistory({ lang, exercise }: { lang: Lang; exercise: HistoryFacts }) {
  const { snapshot } = useFitness();
  const { sets, sessions, bodyweight, settings } = snapshot;
  const rows = useMemo(() => exerciseHistory({ sets, sessions, bodyweight, settings }, exercise), [sets, sessions, bodyweight, settings, exercise]);
  if (!rows.length) return null;
  const assisted = exercise.assistance === true || exercise.equipment === "assisted";
  const best = rows.reduce<(typeof rows)[number] | null>((top, r) => (r.e1rm != null && (!top || r.e1rm > (top.e1rm ?? 0)) ? r : top), null);
  const day = (ms: number) => fmtDate(new Date(ms).toISOString(), lang, { day: "numeric", month: "short", year: "2-digit" });
  const showE1rm = rows.some((r) => r.e1rm != null);
  const points = rows
    .filter((r) => r.e1rm != null)
    .map((r) => ({ x: r.at, y: r.e1rm ?? 0, hollow: !r.reliable }))
    .reverse();
  const kg = kgLabel(lang);
  return (
    <section className="fit-card fx-section" aria-labelledby="fx-history">
      <h2 id="fx-history">{pick(lang, "Your history", "Ваша история")}</h2>
      {best?.e1rm != null ? (
        <p>
          {pick(lang, "Best estimated 1RM:", "Лучший расчётный 1ПМ:")}{" "}
          <strong className="fit-num">
            {best.reliable ? "" : "≈ "}
            {fmtKg(best.e1rm, lang)} {kgLabel(lang)}
          </strong>{" "}
          <span className="fit-muted">({day(best.at)})</span>
        </p>
      ) : null}
      {points.length >= 2 ? (
        <LineChart
          kind="exercise-e1rm"
          lang={lang}
          title={pick(lang, `Estimated 1RM, ${kg}`, `Расчётный 1ПМ, ${kg}`)}
          summary={pick(
            lang,
            `${points.length} sessions from ${day(points[0].x)} to ${day(points[points.length - 1].x)}; best ${fmtKg(best?.e1rm ?? 0, lang)} ${kg}.`,
            `Тренировок: ${points.length}, с ${day(points[0].x)} по ${day(points[points.length - 1].x)}; лучший ${fmtKg(best?.e1rm ?? 0, lang)} ${kg}.`,
          )}
          dots={[
            {
              key: "e1rm",
              label: pick(lang, "Session best e1RM", "Лучший 1ПМ тренировки"),
              hollowLabel: pick(lang, "> 12 total reps (less reliable)", "> 12 повторов (менее надёжно)"),
              role: "you",
              points,
            },
          ]}
          log="auto"
          format={(v) => fmtKg(v, lang)}
          unit={kg}
          height={200}
          table={null}
        />
      ) : null}
      <div className="fx-table-wrap">
        <table className="fx-table">
          <thead>
            <tr>
              <th scope="col">{pick(lang, "Date", "Дата")}</th>
              <th scope="col">{pick(lang, "Best set", "Лучший подход")}</th>
              {showE1rm ? <th scope="col">{pick(lang, "e1RM, kg", "1ПМ, кг")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((r) => (
              <tr key={r.sessionId}>
                <td className="fit-num">{day(r.at)}</td>
                <td className="fit-num">
                  {setText(lang, r.best, exercise.repUnit, assisted)}
                  <span className="fit-muted"> · {r.sets} {pick(lang, r.sets === 1 ? "set" : "sets", pluralRu(r.sets, ["подход", "подхода", "подходов"]))}</span>
                </td>
                {showE1rm ? (
                  <td className="fit-num">{r.e1rm == null ? "—" : `${r.reliable ? "" : "≈ "}${fmtKg(r.e1rm, lang)}`}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showE1rm ? (
        <p className="fx-small fit-muted">
          {pick(
            lang,
            "e1RM: estimated one-rep max from the session's best set (Epley/Brzycki blend, reps in reserve added). ≈ = less reliable (more than 12 reps in total).",
            "1ПМ: расчётный разовый максимум по лучшему подходу (среднее формул Эпли и Бжицки, с учётом повторов в запасе). ≈ — менее надёжно (больше 12 повторов в сумме).",
          )}
        </p>
      ) : null}
    </section>
  );
}
