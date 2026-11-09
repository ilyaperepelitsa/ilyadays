/**
 * Pure chart helpers for the progress charts (stream 06): nice ticks, log ticks, time ticks thinned by pixel width,
 * text width estimates and number/date formatters. No React, no DOM.
 */
import type { Lang } from "@/lib/fitness/types";

/** 1, 2, 2.5, 5 × 10^k at or above `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

const decimalsOf = (step: number) => Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9) + (String(step).includes("2.5") ? 1 : 0)));

/** Ticks on clean numbers covering [min, max], about `count` of them; the domain snaps to the outer ticks. */
export function niceTicks(min: number, max: number, count: number): { ticks: number[]; lo: number; hi: number } {
  let a = Math.min(min, max);
  let b = Math.max(min, max);
  if (!(b > a)) {
    const pad = Math.abs(a) * 0.05 || 1;
    a -= pad;
    b += pad;
  }
  const step = niceStep((b - a) / Math.max(1, count - 1));
  const lo = Math.floor(a / step + 1e-9) * step;
  const hi = Math.ceil(b / step - 1e-9) * step;
  const d = decimalsOf(step);
  const ticks: number[] = [];
  for (let i = 0, v = lo; v <= hi + step * 1e-6 && i < 50; i++, v = lo + i * step) ticks.push(Number(v.toFixed(d)));
  return { ticks, lo, hi };
}

/** Log-scale ticks: clean linear values inside [min, max], thinned so neighbours are ≥ `minGapPx` apart. */
export function logTicks(min: number, max: number, heightPx: number, minGapPx = 24): number[] {
  const { ticks } = niceTicks(min, max, 8);
  const inside = ticks.filter((t) => t > 0 && t >= min * 0.999 && t <= max * 1.001);
  const span = Math.log(max / min);
  const out: number[] = [];
  for (const t of inside) {
    const last = out[out.length - 1];
    if (last == null || (Math.log(t / last) / span) * heightPx >= minGapPx) out.push(t);
  }
  return out.length >= 2 ? out : [min, max];
}

export type LinearOrLog = { map: (v: number) => number; ticks: number[]; lo: number; hi: number; log: boolean };

/** A y scale to pixels [bottom, top]. `log` maps ln(v); zero/negative values fall back to linear. */
export function yScale(values: number[], bottom: number, top: number, opts: { log?: boolean | "auto"; includeZero?: boolean; domain?: [number, number] } = {}): LinearOrLog {
  const finite = values.filter((v) => Number.isFinite(v));
  let min = opts.domain?.[0] ?? (finite.length ? Math.min(...finite) : 0);
  let max = opts.domain?.[1] ?? (finite.length ? Math.max(...finite) : 1);
  if (opts.includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  const wantLog = opts.log === true || (opts.log === "auto" && min > 0 && max / min > 1.5);
  const h = bottom - top;
  if (wantLog && min > 0) {
    const lo = min * 0.97;
    const hi = max * 1.03;
    const span = Math.log(hi / lo);
    return { map: (v) => bottom - (Math.log(Math.max(v, lo * 1e-3) / lo) / span) * h, ticks: logTicks(lo, hi, h), lo, hi, log: true };
  }
  const { ticks, lo, hi } = niceTicks(min, max, Math.max(3, Math.min(6, Math.round(h / 40) + 1)));
  const span = hi - lo || 1;
  return { map: (v) => bottom - ((v - lo) / span) * h, ticks, lo, hi, log: false };
}

/** Approximate rendered width of a label (system sans): good enough to avoid collisions with a margin. */
export function textWidth(text: string, fontPx = 11): number {
  let w = 0;
  for (const ch of text) w += ch === "\u2060" ? 0 : /[.,:;'!|il1 \u00a0]/.test(ch) ? 0.32 : /[MWмшщжюЩШЖМЮ%]/.test(ch) ? 0.9 : /[А-Яа-яЁё]/.test(ch) ? 0.64 : 0.58;
  return w * fontPx;
}

/** Ellipsize a label to fit `maxPx`. */
export function fitText(text: string, maxPx: number, fontPx = 11): string {
  if (textWidth(text, fontPx) <= maxPx) return text;
  let s = text;
  while (s.length > 1 && textWidth(`${s}…`, fontPx) > maxPx) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

const locale = (lang: Lang) => (lang === "ru" ? "ru-RU" : "en-GB");
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** Locale number with at most `digits` decimals (ru: decimal comma), a true minus sign and never "−0". */
export function fmtNum(v: number, lang: Lang, digits = 1): string {
  if (!Number.isFinite(v)) return "—";
  const key = `${lang}:${digits}`;
  let f = numberFormats.get(key);
  if (!f) numberFormats.set(key, (f = new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits })));
  const s = f.format(Math.abs(v));
  return v < 0 && /[1-9]/.test(s) ? `−${s}` : s;
}

/** Signed number: "+1.2", "−0.6" (true minus sign). */
export const fmtSigned = (v: number, lang: Lang, digits = 1) => {
  const s = fmtNum(Math.abs(v), lang, digits);
  return Number(Math.abs(v).toFixed(digits)) === 0 ? s : `${v < 0 ? "−" : "+"}${s}`;
};

export function fmtDay(at: number, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  const key = `${lang}:${JSON.stringify(opts)}`;
  let f = dateFormats.get(key);
  if (!f) dateFormats.set(key, (f = new Intl.DateTimeFormat(locale(lang), opts)));
  return Number.isFinite(at) ? f.format(new Date(at)) : "";
}

export type TimeTick = { at: number; label: string };

const DAY = 86_400_000;
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Time-axis ticks between t0 and t1, at most one per `minGapPx` pixels: days, Mondays, every other Monday, months
 * (1st), 2/3/6 months, years — the first interval that fits wins.
 */
export function timeTicks(t0: number, t1: number, widthPx: number, lang: Lang, minGapPx = 64): TimeTick[] {
  if (!(t1 > t0)) return [{ at: t0, label: fmtDay(t0, lang) }];
  const max = Math.max(2, Math.floor(widthPx / minGapPx));
  const spanYears = new Date(t1).getFullYear() !== new Date(t0).getFullYear();
  const dayLabel = (t: number) => fmtDay(t, lang);
  const monthLabel = (t: number) => {
    const d = new Date(t);
    return spanYears && d.getMonth() === 0 ? fmtDay(t, lang, { month: "short", year: "numeric" }) : fmtDay(t, lang, { month: "short" });
  };
  const days = (step: number, mondays: boolean) => {
    const out: number[] = [];
    let t = startOfDay(t0);
    if (mondays) while (new Date(t).getDay() !== 1) t = startOfDay(t + DAY * 1.5);
    for (let i = 0; t <= t1 && i < 400; i++) {
      if (t >= t0) out.push(t);
      for (let k = 0; k < (mondays ? 7 * step : step); k++) t = startOfDay(t + DAY * 1.5);
    }
    return out;
  };
  const months = (step: number) => {
    const out: number[] = [];
    const d = new Date(t0);
    const m = new Date(d.getFullYear(), d.getMonth() + (d.getDate() === 1 && d.getHours() === 0 ? 0 : 1), 1);
    while (m.getMonth() % step !== 0) m.setMonth(m.getMonth() + 1);
    for (let i = 0; m.getTime() <= t1 && i < 200; i++) {
      out.push(m.getTime());
      m.setMonth(m.getMonth() + step);
    }
    return out;
  };
  const candidates: [() => number[], (t: number) => string][] = [
    [() => days(1, false), dayLabel],
    [() => days(2, false), dayLabel],
    [() => days(1, true), dayLabel],
    [() => days(2, true), dayLabel],
    [() => months(1), monthLabel],
    [() => months(2), monthLabel],
    [() => months(3), monthLabel],
    [() => months(6), monthLabel],
    [() => months(12), (t) => fmtDay(t, lang, { year: "numeric" })],
  ];
  for (const [gen, label] of candidates) {
    const ts = gen();
    if (ts.length >= 1 && ts.length <= max) return ts.map((at) => ({ at, label: label(at) }));
  }
  return [t0, t1].map((at) => ({ at, label: dayLabel(at) }));
}

export type PlacedLabel<T> = T & { cx: number };

/**
 * Collision-free axis labels: each label spans its estimated width around `x`, clamped into [lo, hi]; labels are kept
 * greedily from the right (the latest wins) and dropped when closer than `gap` px to one already kept.
 */
export function thinLabels<T extends { x: number; label: string }>(items: T[], lo: number, hi: number, fontPx = 11, gap = 6): PlacedLabel<T>[] {
  const kept: PlacedLabel<T>[] = [];
  let leftEdge = Infinity;
  for (const it of [...items].sort((a, b) => b.x - a.x)) {
    const w = textWidth(it.label, fontPx);
    let x0 = it.x - w / 2;
    let x1 = it.x + w / 2;
    if (x1 > hi) {
      x1 = hi;
      x0 = hi - w;
    }
    if (x0 < lo) {
      x0 = lo;
      x1 = lo + w;
    }
    if (x1 + gap > leftEdge) continue;
    kept.push({ ...it, cx: (x0 + x1) / 2 });
    leftEdge = x0;
  }
  return kept.reverse();
}
