"use client";
/**
 * Weigh-in entry (stream 06): one number with ±0.1 steppers, the date (today by default), one tap to save. One
 * weigh-in per local day: saving again replaces that day's value. Recent entries can be deleted with a second tap.
 * Rendered only when the store can write (local mode or the signed-in owner).
 */
import { useState } from "react";
import type { BodyweightEntry, FitnessStore, Lang } from "@/lib/fitness/types";
import { kgLabel, pick } from "@/lib/fitness/i18n";
import { DAY_MS, dayKey, fromDayKey } from "@/lib/fitness/analytics.mjs";
import { fmtDay, fmtNum } from "./scales";
import { uuid } from "./shared";

const MIN_KG = 20.1;
const MAX_KG = 399.9;
const toInput = (kg: number, lang: Lang) => {
  const s = (Math.round(kg * 10) / 10).toFixed(1);
  return lang === "ru" ? s.replace(".", ",") : s;
};
/** "… 20 янв." + "." would end in two dots: add the full stop only when the sentence does not already end in one. */
const endDot = (s: string) => (s.endsWith(".") ? s : `${s}.`);
const parseKg = (text: string) => {
  const v = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(v) ? v : null;
};

export function WeighIn({ lang, entries, store, now, defaultKg }: { lang: Lang; entries: BodyweightEntry[]; store: FitnessStore; now: number; defaultKg: number | null }) {
  const today = dayKey(now);
  const [date, setDate] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const day = date && date <= today ? date : today;
  const sameDay = entries.filter((e) => dayKey(e.at) === day);
  const existing = sameDay.length ? sameDay[sameDay.length - 1] : null;
  const last = entries.length ? entries[entries.length - 1] : null;
  const base = existing?.kg ?? last?.kg ?? defaultKg ?? 80;
  const shown = text ?? toInput(base, lang);
  const parsed = parseKg(shown);
  const valid = parsed != null && parsed >= MIN_KG && parsed <= MAX_KG;
  const kgUnit = kgLabel(lang);
  const dayLabel = (key: string) => fmtDay(fromDayKey(key), lang, { day: "numeric", month: "short" });

  const bump = (delta: number) => {
    const v = Math.min(MAX_KG, Math.max(MIN_KG, Math.round(((parsed ?? base) + delta) * 10) / 10));
    setText(toInput(v, lang));
    setStatus(null);
  };

  const save = () => {
    if (!valid || parsed == null) {
      setStatus({ kind: "error", text: pick(lang, "Enter a weight between 20 and 400 kg.", "Введите вес от 20 до 400 кг.") });
      return;
    }
    const kg = Math.round(parsed * 10) / 10;
    const stamp = new Date().toISOString();
    const at = day === today ? stamp : (existing?.at ?? new Date(fromDayKey(day) + 9 * 3_600_000).toISOString());
    store.upsert("bodyweight", { id: existing?.id ?? uuid(), at, kg, bodyFatPct: existing?.bodyFatPct ?? null, ...(existing?.note ? { note: existing.note } : {}), updatedAt: stamp });
    setText(null);
    setStatus({
      kind: "ok",
      text: existing
        ? pick(lang, `Updated ${dayLabel(day)}: ${fmtNum(kg, lang, 1)} kg (was ${fmtNum(existing.kg, lang, 1)}).`, `Исправлено за ${dayLabel(day)}: ${fmtNum(kg, lang, 1)} кг (было ${fmtNum(existing.kg, lang, 1)}).`)
        : endDot(pick(lang, `Saved ${fmtNum(kg, lang, 1)} kg for ${dayLabel(day)}`, `Записано: ${fmtNum(kg, lang, 1)} кг за ${dayLabel(day)}`)),
    });
  };

  const recent = [...entries].reverse().slice(0, 5);
  const minDate = dayKey(now - 365 * DAY_MS);

  return (
    <div className="fitp-weigh">
      <form
        className="fitp-weigh-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="fitp-weigh-row">
          <button type="button" className="fit-button quiet fitp-step" onClick={() => bump(-0.1)} aria-label={pick(lang, "Minus 0.1 kg", "Минус 0,1 кг")}>
            −
          </button>
          <label className="fitp-weigh-kg">
            <span className="sr-only">{pick(lang, "Body weight, kg", "Вес тела, кг")}</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              value={shown}
              aria-invalid={!valid}
              onChange={(e) => {
                setText(e.target.value);
                setStatus(null);
              }}
            />
            <span aria-hidden="true">{kgUnit}</span>
          </label>
          <button type="button" className="fit-button quiet fitp-step" onClick={() => bump(0.1)} aria-label={pick(lang, "Plus 0.1 kg", "Плюс 0,1 кг")}>
            +
          </button>
        </div>
        <div className="fitp-weigh-row wrap">
          <label className="fitp-weigh-date">
            <span>{pick(lang, "Date", "Дата")}</span>
            <input
              type="date"
              value={day}
              min={minDate}
              max={today}
              onChange={(e) => {
                setDate(e.target.value || null);
                setText(null);
                setStatus(null);
              }}
            />
          </label>
          <button type="submit" className="fit-button fitp-weigh-save" disabled={!valid}>
            {existing ? pick(lang, "Update weigh-in", "Исправить вес") : pick(lang, "Save weigh-in", "Записать вес")}
          </button>
        </div>
        {existing && !status ? (
          <p className="fitp-hint">
            {endDot(pick(lang, `Replaces ${fmtNum(existing.kg, lang, 1)} kg logged for ${dayLabel(day)}`, `Заменит ${fmtNum(existing.kg, lang, 1)} кг, записанные за ${dayLabel(day)}`))}
          </p>
        ) : null}
        <p className={`fitp-hint${status?.kind === "error" ? " error" : ""}`} role="status" aria-live="polite">
          {status?.text ?? ""}
        </p>
      </form>
      {recent.length ? (
        <details className="fitp-recent">
          <summary>{pick(lang, "Recent weigh-ins", "Последние взвешивания")}</summary>
          <ul>
            {recent.map((e) => (
              <li key={e.id}>
                <span className="fit-num">{fmtDay(Date.parse(e.at), lang, { weekday: "short", day: "numeric", month: "short" })}</span>
                <b className="fit-num">
                  {fmtNum(e.kg, lang, 1)} {kgUnit}
                </b>
                <button
                  type="button"
                  className={`fit-button ${confirm === e.id ? "" : "quiet"} fitp-del`}
                  onClick={() => {
                    if (confirm !== e.id) {
                      setConfirm(e.id);
                      return;
                    }
                    store.remove("bodyweight", e.id);
                    setConfirm(null);
                    setStatus({ kind: "ok", text: pick(lang, "Weigh-in deleted.", "Взвешивание удалено.") });
                  }}
                  onBlur={() => setConfirm((c) => (c === e.id ? null : c))}
                >
                  {confirm === e.id ? pick(lang, "Delete?", "Удалить?") : pick(lang, "Delete", "Удалить")}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
