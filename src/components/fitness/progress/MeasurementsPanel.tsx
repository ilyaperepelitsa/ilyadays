"use client";
import { useMemo, useState } from "react";
import type { Lang, MeasurementSite } from "@/lib/fitness/types";
import { useFitness } from "../Provider";
import { pick } from "@/lib/fitness/i18n";
import { dayKey } from "@/lib/fitness/analytics.mjs";
import { MEASUREMENT_SITES, measurementRow, measurementTrend } from "@/lib/fitness/measurements.mjs";

export function MeasurementsPanel({ lang, now }: { lang: Lang; now: number }) {
  const { snapshot, store, canWrite } = useFitness();
  const [day, setDay] = useState(dayKey(now));
  const [draft, setDraft] = useState<Partial<Record<MeasurementSite, string>>>({});
  const [note, setNote] = useState("");
  const [site, setSite] = useState<MeasurementSite>("waist");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const entries = useMemo(() => Object.values(snapshot.measurements ?? {}).sort((a, b) => b.at.localeCompare(a.at) || b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id)), [snapshot.measurements]);
  const trend = useMemo(() => measurementTrend(snapshot.measurements ?? {}, site), [snapshot.measurements, site]);
  const label = (id: string) => { const row = MEASUREMENT_SITES.find(([s]) => s === id); return row ? pick(lang, row[1], row[2]) : id; };
  const format = (n: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 1, signDisplay: "auto" }).format(n);
  const date = (at: string) => new Date(at).toLocaleDateString(lang, { year: "numeric", month: "short", day: "numeric" });
  const commonSites = new Set(["waist", "left-biceps", "right-biceps", "left-forearm", "right-forearm"]);
  const field = ([key, en, ru]: readonly string[]) => <label key={key}>{pick(lang, en, ru)} ({pick(lang, "cm", "см")})<input data-testid={`measurement-${key}`} inputMode="decimal" value={draft[key as MeasurementSite] ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, [key]: e.target.value })); setMessage(""); }} /></label>;
  const save = () => {
    if (!canWrite) return;
    const values = Object.fromEntries(Object.entries(draft).filter(([, v]) => v.trim()).map(([k, v]) => [k, Number(v.trim().replace(",", "."))]));
    const row = measurementRow({ day, values, note, now: new Date() });
    if (!row) { setError(pick(lang, "Choose today or an earlier valid date and enter at least one measurement between 0 and 300 cm.", "Выберите сегодняшнюю или более раннюю дату и введите хотя бы один замер от 0 до 300 см.")); return; }
    store.upsert("measurements", row);
    setDraft({}); setNote(""); setError(""); setMessage(pick(lang, "Measurements recorded.", "Замеры записаны."));
  };
  return <section className="fit-card fmeasure" id="measurements" data-testid="measurements-panel">
    <h2>{pick(lang, "Body measurements", "Замеры тела")}</h2>
    <p>{pick(lang, "Record tape measurements independently of weigh-ins. Keep the same tape position, posture and time of day; note whether your arm was relaxed or flexed. A circumference change alone does not identify muscle gain or fat loss.", "Записывайте замеры лентой независимо от взвешиваний. Сохраняйте положение ленты, позу и время суток; отмечайте, была ли рука расслаблена или напряжена. Изменение окружности само по себе не определяет рост мышц или потерю жира.")}</p>
    {canWrite ? <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label>{pick(lang, "Date", "Дата")}<input type="date" data-testid="measurement-date" value={day} max={dayKey(now)} onChange={(e) => setDay(e.target.value)} required /></label>
      <div className="fmeasure-grid">{MEASUREMENT_SITES.filter(([key]) => commonSites.has(key)).map(field)}</div>
      <details><summary>{pick(lang, "Chest, hips, neck and other measurements", "Грудь, бёдра, шея и другие замеры")}</summary><div className="fmeasure-grid">{MEASUREMENT_SITES.filter(([key]) => !commonSites.has(key)).map(field)}</div></details>
      <label>{pick(lang, "Measurement conditions (optional)", "Условия измерения (необязательно)")}<input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={pick(lang, "e.g. arm relaxed, before training", "например, рука расслаблена, до тренировки")} /></label>
      {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
      <button type="submit" data-testid="measurement-save" className="fit-button">{pick(lang, "Record measurements", "Записать замеры")}</button>
    </form> : null}
    <label>{pick(lang, "Compare recorded measurements", "Сравнить записанные замеры")}<select data-testid="measurement-trend-site" value={site} onChange={(e) => setSite(e.target.value as MeasurementSite)}>{MEASUREMENT_SITES.map(([id, en, ru]) => <option key={id} value={id}>{pick(lang, en, ru)}</option>)}</select></label>
    {trend.length >= 2 ? <p className="fit-num" data-testid="measurement-change">{label(site)}: {format(trend[0].cm)} → {format(trend.at(-1)!.cm)} {pick(lang, "cm", "см")} ({format(trend.at(-1)!.cm - trend[0].cm)} {pick(lang, "cm", "см")}), {date(trend[0].at)} → {date(trend.at(-1)!.at)}</p> : <p className="fit-muted">{pick(lang, "Two observations for the selected site are needed to show a change. Missing measurements stay empty.", "Для сравнения нужны два замера выбранного участка. Отсутствующие значения остаются пустыми.")}</p>}
    {!entries.length ? <p>{pick(lang, "No tape measurements recorded yet.", "Замеров лентой пока нет.")}</p> : <ul className="fmeasure-history">{entries.slice(0, 30).map((row) => <li key={row.id} data-testid="measurement-entry"><time dateTime={row.at}>{date(row.at)}</time><span>{Object.entries(row.values).map(([k, v]) => `${label(k)}: ${format(v)} ${pick(lang,"cm","см")}`).join(" · ")}{row.note ? ` — ${row.note}` : ""}</span>{canWrite ? <button type="button" className="fit-button quiet" aria-label={pick(lang, "Delete this measurement record", "Удалить запись замеров")} onClick={() => { if (deleting === row.id) { store.remove("measurements", row.id); setDeleting(null); } else setDeleting(row.id); }}>{deleting === row.id ? pick(lang, "Confirm delete", "Подтвердить удаление") : pick(lang, "Delete", "Удалить")}</button> : null}</li>)}</ul>}
  </section>;
}
