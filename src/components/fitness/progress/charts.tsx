"use client";
/**
 * Dependency-free SVG charts (stream 06 — plans/fitness/06-progress-analytics.md), exported for every fitness page
 * (the exercise page reuses LineChart). Colour by ROLE through the site's CSS variables only:
 *   you → --accent · model / forecast → --cool · history / reference → --muted · target met → --ok · grid → --line.
 * Series also differ by mark (dots, hollow dots, solid / dashed / dotted lines, bands), so identity never rests on
 * hue alone. Each chart is measured (1 SVG unit = 1 px, text stays 11 px, ticks thinned by pixels), has a title and a
 * description for screen readers, a legend for ≥ 2 series, a pointer + keyboard readout and a table twin.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { fitText, fmtDay, fmtNum, niceTicks, textWidth, thinLabels, timeTicks, yScale } from "./scales";

export type Role = "you" | "model" | "history" | "ok";
export type TableSpec = { columns: string[]; rows: (string | number)[][]; caption?: string };
export type LegendMark = "dot" | "hollow" | "ring" | "line" | "dashed" | "dotted" | "band" | "bar" | "bar-soft" | "tick" | "cell-ring" | "check";
export type LegendItem = { key: string; label: string; role: Role; mark: LegendMark };

const FONT = 11;

/* ------------------------------------------------------------------ shared pieces */

/** Width of a container in CSS px (ResizeObserver), `fallback` before the first measurement and on the server. */
export function useMeasuredWidth(fallback = 340): [(el: HTMLDivElement | null) => void, number] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

/** Active index for a pointer/keyboard readout over `count` positions. */
function useReadout(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const current = active != null && active < count ? active : null;
  const onKeyDown = (e: KeyboardEvent) => {
    if (!count) return;
    const keys: Record<string, (i: number | null) => number | null> = {
      ArrowRight: (i) => (i == null ? 0 : Math.min(count - 1, i + 1)),
      ArrowLeft: (i) => (i == null ? count - 1 : Math.max(0, i - 1)),
      Home: () => 0,
      End: () => count - 1,
      Escape: () => null,
    };
    const f = keys[e.key];
    if (!f) return;
    e.preventDefault();
    setActive(f(current));
  };
  return { active: current, setActive, onKeyDown };
}

export function ChartTable({ lang, table }: { lang: Lang; table: TableSpec }) {
  if (!table.rows.length) return null;
  return (
    <details className="fitc-table">
      <summary>{pick(lang, "Table view", "Таблица")}</summary>
      <div className="fitc-table-scroll">
        <table>
          {table.caption ? <caption className="sr-only">{table.caption}</caption> : null}
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) =>
                  j === 0 ? (
                    <th key={j} scope="row">
                      {v}
                    </th>
                  ) : (
                    <td key={j}>{v}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function MarkSvg({ mark }: { mark: LegendMark }) {
  switch (mark) {
    case "dot":
      return <circle className="fitc-dot" cx="10" cy="6" r="4" />;
    case "hollow":
      return <circle className="fitc-dot hollow" cx="10" cy="6" r="3.5" />;
    case "ring":
      return <circle className="fitc-pr" cx="10" cy="6" r="4.5" />;
    case "line":
      return <line className="fitc-line" x1="1.5" y1="6" x2="18.5" y2="6" />;
    case "dashed":
      return <line className="fitc-line dashed" x1="1.5" y1="6" x2="18.5" y2="6" />;
    case "dotted":
      return <line className="fitc-line dotted" x1="2" y1="6" x2="18" y2="6" />;
    case "band":
      return <rect className="fitc-band" x="1" y="1" width="18" height="10" rx="2" />;
    case "bar":
      return <rect className="fitc-bar" x="5" y="1" width="10" height="10" rx="2" />;
    case "bar-soft":
      return <rect className="fitc-bar soft" x="5" y="1" width="10" height="10" rx="2" />;
    case "tick":
      return <line className="fitc-tick" x1="10" y1="2" x2="10" y2="10" />;
    case "check":
      return (
        <text className="fitc-check" x="10" y="10.5" textAnchor="middle">
          ✓
        </text>
      );
    case "cell-ring":
      return (
        <>
          <rect className="fitc-cell" x="3" y="0.5" width="14" height="11" rx="3" style={{ fillOpacity: 0.45 }} />
          <rect className="fitc-cell-ring" x="4" y="1.5" width="12" height="9" rx="2" />
        </>
      );
  }
}

export function Legend({ items }: { items: LegendItem[] }) {
  if (!items.length) return null;
  return (
    <ul className="fitc-legend">
      {items.map((it) => (
        <li key={it.key} className={`fitc-r-${it.role}`}>
          <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden="true" focusable="false">
            <MarkSvg mark={it.mark} />
          </svg>
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Frame({ title, legend, table, lang, kind, children }: { title: string; legend: LegendItem[] | null; table?: TableSpec | null; lang: Lang; kind?: string; children: ReactNode }) {
  return (
    <figure className="fitc" data-testid="chart" data-kind={kind}>
      <figcaption className="fitc-title">{title}</figcaption>
      {legend && legend.length > 1 ? <Legend items={legend} /> : null}
      {children}
      {table ? <ChartTable lang={lang} table={table} /> : null}
    </figure>
  );
}

/** Tooltip anchored beside the crosshair, flipped to stay inside the plot. */
/**
 * Readout box beside the cursor: on the roomier side, and clamped into the plot when it fits on neither (a long
 * label on a 300 px phone plot). Placed after layout from its measured width, before paint, so it never flickers.
 */
function Tip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const gap = 10;
    const leftSide = x - gap - w;
    const rightSide = x + gap;
    const fitsLeft = leftSide >= 0;
    const fitsRight = rightSide + w <= width;
    const pos = fitsLeft && (x > width / 2 || !fitsRight) ? leftSide : fitsRight ? rightSide : x > width / 2 ? 0 : width - w;
    el.style.left = `${Math.max(0, Math.min(width - w, pos))}px`;
    el.style.visibility = "visible";
  });
  return (
    <div ref={ref} className="fitc-tip" style={{ left: 0, visibility: "hidden" }} aria-hidden="true">
      {children}
    </div>
  );
}

/** Nearest index in a sorted pixel array. */
function nearest(px: number[], x: number): number {
  let best = 0;
  for (let i = 1; i < px.length; i++) if (Math.abs(px[i] - x) < Math.abs(px[best] - x)) best = i;
  return best;
}

/** Interpolated y of a polyline at x (null outside its range). */
function interp(points: { x: number; y: number }[], x: number): number | null {
  if (!points.length || x < points[0].x - 1 || x > points[points.length - 1].x + 1) return null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (x <= b.x) return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return points[points.length - 1].y;
}

const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");

/** Column with a rounded data end (top) and a square baseline. */
function barPath(x: number, yTop: number, w: number, yBottom: number, rounded: boolean): string {
  const h = yBottom - yTop;
  const r = rounded ? Math.min(4, w / 2, h) : 0;
  return `M${x} ${yBottom}V${yTop + r}${r ? `Q${x} ${yTop} ${x + r} ${yTop}` : ""}H${x + w - r}${r ? `Q${x + w} ${yTop} ${x + w} ${yTop + r}` : ""}V${yBottom}Z`;
}

/* ------------------------------------------------------------------ LineChart */

export type XYPoint = { x: number; y: number };
export type DotPoint = XYPoint & { hollow?: boolean; ring?: boolean };
export type DotSeries = { key: string; label: string; role: Role; points: DotPoint[]; hollowLabel?: string; ringLabel?: string; small?: boolean };
export type LineSeries = { key: string; label: string; role: Role; points: XYPoint[]; style?: "solid" | "dashed" | "dotted"; endLabel?: string; thin?: boolean };
export type BandSeries = { key: string; label: string; role: Role; points: { x: number; lo: number; hi: number }[] };
export type RefLine = { key: string; label: string; y: number; role?: Role };
export type RefBand = { key: string; label: string; lo: number; hi: number; role?: Role };
export type EventTicks = { key: string; label: string; role: Role; xs: number[] };

export type LineChartProps = {
  lang: Lang;
  /** Test hook (master plan §15): data-kind on the chart's figure, e.g. "e1rm", "volume" */
  kind?: string;
  /** Visible caption and SVG <title> */
  title: string;
  /** One sentence with the key numbers: the SVG <desc> */
  summary: string;
  dots?: DotSeries[];
  lines?: LineSeries[];
  bands?: BandSeries[];
  refs?: RefLine[];
  refBands?: RefBand[];
  events?: EventTicks[];
  /** "auto": logarithmic when max/min > 1.5 (progress is multiplicative) */
  log?: boolean | "auto";
  includeZero?: boolean;
  yDomain?: [number, number];
  /** epoch ms */
  xDomain?: [number, number];
  /** total SVG height in px (≥ 180) */
  height?: number;
  format?: (v: number) => string;
  unit?: string;
  table?: TableSpec | null;
  /** override the derived legend; false hides it */
  legend?: LegendItem[] | false;
};

/** Time-series chart: points + lines + uncertainty bands + reference lines/bands + event ticks, x = epoch ms. */
export function LineChart(props: LineChartProps) {
  const { lang, title, summary, dots = [], lines = [], bands = [], refs = [], refBands = [], events = [], unit } = props;
  const [measure, W] = useMeasuredWidth();
  const uid = useId();
  const H = Math.max(180, props.height ?? 220);
  const format = useMemo(() => props.format ?? ((v: number) => fmtNum(v, lang, 1)), [props.format, lang]);

  const geo = useMemo(() => {
    const xs = [
      ...dots.flatMap((d) => d.points.map((p) => p.x)),
      ...lines.flatMap((l) => l.points.map((p) => p.x)),
      ...bands.flatMap((b) => b.points.map((p) => p.x)),
      ...events.flatMap((e) => e.xs),
    ].filter(Number.isFinite);
    let x0 = props.xDomain?.[0] ?? (xs.length ? Math.min(...xs) : 0);
    let x1 = props.xDomain?.[1] ?? (xs.length ? Math.max(...xs) : 1);
    if (!(x1 > x0)) {
      x0 -= 3 * 86_400_000;
      x1 += 3 * 86_400_000;
    }
    const ys = [
      ...dots.flatMap((d) => d.points.map((p) => p.y)),
      ...lines.flatMap((l) => l.points.map((p) => p.y)),
      ...bands.flatMap((b) => b.points.flatMap((p) => [p.lo, p.hi])),
      ...refs.map((r) => r.y),
      ...refBands.flatMap((r) => [r.lo, r.hi]),
    ].filter(Number.isFinite);
    const top = 12;
    const bottom = H - 22;
    const y = yScale(ys, bottom, top, { log: props.log ?? false, includeZero: props.includeZero, domain: props.yDomain });
    const yLabels = y.ticks.map((t) => format(t));
    const left = Math.ceil(Math.max(20, ...yLabels.map((l) => textWidth(l, FONT)))) + 8;
    const ends = lines.filter((l) => l.endLabel && l.points.length);
    const right = ends.length ? Math.min(Math.round(W * 0.3), Math.ceil(Math.max(...ends.map((l) => textWidth(l.endLabel ?? "", FONT)))) + 12) : 10;
    const plotW = Math.max(40, W - left - right);
    const x = (t: number) => left + ((t - x0) / (x1 - x0)) * plotW;
    const ticks = thinLabels(
      timeTicks(x0, x1, plotW, lang).map((t) => ({ ...t, x: x(t.at) })),
      2,
      W - 2,
    );
    const anchors = [...new Set((dots.length ? dots.flatMap((d) => d.points.map((p) => p.x)) : lines.flatMap((l) => l.points.map((p) => p.x))).filter(Number.isFinite))].sort((a, b) => a - b);
    // end labels: keep those ≥ 13 px apart vertically (the legend carries the rest)
    const placed: { key: string; label: string; x: number; y: number }[] = [];
    for (const l of [...ends].sort((a, b) => y.map(a.points[a.points.length - 1].y) - y.map(b.points[b.points.length - 1].y))) {
      const p = l.points[l.points.length - 1];
      const py = y.map(p.y);
      if (placed.every((q) => Math.abs(q.y - py) >= 13)) placed.push({ key: l.key, label: l.endLabel ?? "", x: x(p.x), y: py });
    }
    return { x0, x1, y, yLabels, left, right, plotW, top, bottom, x, ticks, anchors, endLabels: placed };
  }, [dots, lines, bands, events, refs, refBands, props.xDomain, props.yDomain, props.log, props.includeZero, H, W, lang, format]);

  const { active, setActive, onKeyDown } = useReadout(geo.anchors.length);
  const anchorPx = geo.anchors.map(geo.x);
  const ax = active != null ? geo.anchors[active] : null;

  const readout = useMemo(() => {
    if (ax == null) return null;
    const rows: { key: string; role: Role; mark: LegendMark; label: string; value: string }[] = [];
    for (const d of dots) {
      const p = d.points.find((q) => q.x === ax);
      if (p) rows.push({ key: d.key, role: d.role, mark: p.hollow ? "hollow" : "dot", label: p.hollow && d.hollowLabel ? d.hollowLabel : d.label, value: `${format(p.y)}${unit ? ` ${unit}` : ""}` });
    }
    for (const l of lines) {
      const v = interp(l.points, ax);
      if (v != null) rows.push({ key: l.key, role: l.role, mark: l.style === "dashed" ? "dashed" : l.style === "dotted" ? "dotted" : "line", label: l.label, value: `${format(v)}${unit ? ` ${unit}` : ""}` });
    }
    for (const b of bands) {
      const lo = interp(b.points.map((p) => ({ x: p.x, y: p.lo })), ax);
      const hi = interp(b.points.map((p) => ({ x: p.x, y: p.hi })), ax);
      if (lo != null && hi != null) rows.push({ key: b.key, role: b.role, mark: "band", label: b.label, value: `${format(lo)}–\u2060${format(hi)}` });
    }
    return { date: fmtDay(ax, lang, { weekday: "short", day: "numeric", month: "short" }), rows };
  }, [ax, dots, lines, bands, format, unit, lang]);

  const legend: LegendItem[] | null =
    props.legend === false
      ? null
      : props.legend ?? [
          ...dots.flatMap((d) => [
            { key: d.key, label: d.label, role: d.role, mark: "dot" as const },
            ...(d.hollowLabel && d.points.some((p) => p.hollow) ? [{ key: `${d.key}-hollow`, label: d.hollowLabel, role: d.role, mark: "hollow" as const }] : []),
            ...(d.ringLabel && d.points.some((p) => p.ring) ? [{ key: `${d.key}-ring`, label: d.ringLabel, role: d.role, mark: "ring" as const }] : []),
          ]),
          ...lines.map((l) => ({ key: l.key, label: l.label, role: l.role, mark: (l.style === "dashed" ? "dashed" : l.style === "dotted" ? "dotted" : "line") as LegendMark })),
          ...bands.map((b) => ({ key: b.key, label: b.label, role: b.role, mark: "band" as const })),
          ...refBands.map((b) => ({ key: b.key, label: b.label, role: b.role ?? "ok", mark: "band" as const })),
          ...events.map((e) => ({ key: e.key, label: e.label, role: e.role, mark: "tick" as const })),
        ];

  const onPointer = (e: PointerEvent<SVGRectElement>) => {
    if (!anchorPx.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = geo.left + ((e.clientX - r.left) / Math.max(1, r.width)) * geo.plotW;
    setActive(nearest(anchorPx, px));
  };
  const { x, y, top, bottom, left, plotW } = geo;
  const dotR = (d: DotSeries) => (d.small ? Math.max(2.25, Math.min(3, plotW / Math.max(1, d.points.length) / 2)) : 4);
  const renderDots = (d: DotSeries) => (
    <g key={d.key} className={`fitc-r-${d.role}`}>
      {d.points.map((p, i) => (
        <g key={`${p.x}-${i}`}>
          {p.ring ? <circle className="fitc-pr" cx={x(p.x)} cy={y.map(p.y)} r={dotR(d) + 3.5} /> : null}
          <circle className={`fitc-dot${p.hollow ? " hollow" : ""}${d.small ? " small" : ""}${p.x === ax ? " on" : ""}`} cx={x(p.x)} cy={y.map(p.y)} r={p.x === ax ? dotR(d) + 1 : dotR(d)} />
        </g>
      ))}
    </g>
  );

  return (
    <Frame title={title} legend={legend} table={props.table} lang={lang} kind={props.kind}>
      <div
        className="fitc-plot"
        ref={measure}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        aria-label={`${title}. ${pick(lang, "Arrow keys read the values.", "Стрелки читают значения.")}`}
        role="group"
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-labelledby={`${uid}t ${uid}d`}>
          <title id={`${uid}t`}>{title}</title>
          <desc id={`${uid}d`}>{summary}</desc>
          {refBands.map((b) => {
            const y1 = y.map(b.hi);
            const y2 = y.map(b.lo);
            return (
              <g key={b.key} className={`fitc-r-${b.role ?? "ok"}`}>
                <rect className="fitc-band" x={left} y={Math.min(y1, y2)} width={plotW} height={Math.abs(y2 - y1)} />
              </g>
            );
          })}
          <g className="fitc-grid">
            {y.ticks.map((t, i) => (
              <g key={t}>
                <line x1={left} x2={left + plotW} y1={y.map(t)} y2={y.map(t)} />
                <text className="fitc-axis" x={left - 6} y={y.map(t) + 3.5} textAnchor="end">
                  {geo.yLabels[i]}
                </text>
              </g>
            ))}
            {geo.ticks.map((t, i) => (
              <text key={`${t.at}-${i}`} className="fitc-axis" x={t.cx} y={H - 6} textAnchor="middle">
                {t.label}
              </text>
            ))}
          </g>
          {bands.map((b) => (
            <g key={b.key} className={`fitc-r-${b.role}`}>
              <path
                className="fitc-band"
                d={`${path(b.points.map((p) => [x(p.x), y.map(p.hi)]))}${path([...b.points].reverse().map((p) => [x(p.x), y.map(p.lo)])).replace(/^M/, "L")}Z`}
              />
            </g>
          ))}
          {refs.map((r) => (
            <g key={r.key} className={`fitc-r-${r.role ?? "history"}`}>
              <line className="fitc-ref" x1={left} x2={left + plotW} y1={y.map(r.y)} y2={y.map(r.y)} />
            </g>
          ))}
          {dots.filter((d) => d.role === "history").map(renderDots)}
          {lines.map((l) => (
            <g key={l.key} className={`fitc-r-${l.role}`}>
              <path className={`fitc-line${l.style && l.style !== "solid" ? ` ${l.style}` : ""}${l.thin ? " thin" : ""}`} d={path(l.points.map((p) => [x(p.x), y.map(p.y)]))} />
            </g>
          ))}
          {events.map((e) => (
            <g key={e.key} className={`fitc-r-${e.role}`}>
              {e.xs.map((t, i) => (
                <line key={`${t}-${i}`} className="fitc-tick" x1={x(t)} x2={x(t)} y1={bottom - 7} y2={bottom} />
              ))}
            </g>
          ))}
          <line className="fitc-baseline" x1={left} x2={left + plotW} y1={bottom} y2={bottom} />
          {ax != null ? <line className="fitc-cross" x1={x(ax)} x2={x(ax)} y1={top} y2={bottom} /> : null}
          {dots.filter((d) => d.role !== "history").map(renderDots)}
          {/* reference labels paint over the data, so their surface halo keeps them readable where a line crosses */}
          {refs.map((r) => (
            <text key={`${r.key}-label`} className="fitc-ref-label" x={left + 4} y={y.map(r.y) - 4}>
              {fitText(r.label, plotW - 8)}
            </text>
          ))}
          {geo.endLabels.map((l) => (
            <text key={l.key} className="fitc-end" x={Math.min(l.x + 6, W - 2)} y={l.y + 3.5} textAnchor={l.x + 6 + textWidth(l.label, FONT) > W ? "end" : "start"}>
              {l.label}
            </text>
          ))}
          <rect
            className="fitc-hit"
            x={left}
            y={top}
            width={plotW}
            height={bottom - top}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={(e) => (e.pointerType === "mouse" ? setActive(null) : undefined)}
          />
        </svg>
        {readout && ax != null ? (
          <Tip x={x(ax)} width={W}>
            <b>{readout.date}</b>
            {readout.rows.map((r) => (
              <span key={r.key} className={`fitc-tip-row fitc-r-${r.role}`}>
                <svg width="14" height="10" viewBox="0 0 20 12" aria-hidden="true" focusable="false">
                  <MarkSvg mark={r.mark} />
                </svg>
                <strong>{r.value}</strong> <span>{r.label}</span>
              </span>
            ))}
          </Tip>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {readout ? `${readout.date}: ${readout.rows.map((r) => `${r.label} ${r.value}`).join("; ")}` : ""}
        </p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ Bars */

export type BarSeries = { key: string; label: string; role: Role; soft?: boolean; values: number[] };
export type BarsProps = {
  lang: Lang;
  /** Test hook (master plan §15): data-kind on the chart's figure, e.g. "e1rm", "volume" */
  kind?: string;
  title: string;
  summary: string;
  categories: { key: string; label: string; current?: boolean }[];
  /** stacked bottom → top */
  series: BarSeries[];
  /** horizontal target band (e.g. 10–20 sets) */
  band?: { lo: number; hi: number; label: string } | null;
  height?: number;
  format?: (v: number) => string;
  unit?: string;
  /** extra tooltip lines for a column */
  details?: (index: number) => string[];
  valueLabels?: boolean;
  table?: TableSpec | null;
  legend?: LegendItem[] | false;
};

/** Weekly (stacked) columns: ≤ 24 px, rounded data end, 2 px surface gaps between segments, optional target band. */
export function Bars(props: BarsProps) {
  const { lang, title, summary, categories, series, band, unit } = props;
  const [measure, W] = useMeasuredWidth();
  const uid = useId();
  const H = Math.max(180, props.height ?? 200);
  const format = props.format ?? ((v: number) => fmtNum(v, lang, 1));
  const n = categories.length;
  const totals = categories.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const top = 16;
  const bottom = H - 22;
  const maxV = Math.max(1, ...totals, band ? band.hi * 1.08 : 0);
  const { ticks, hi } = niceTicks(0, maxV, Math.max(3, Math.min(5, Math.round((bottom - top) / 40) + 1)));
  const yMap = (v: number) => bottom - (v / (hi || 1)) * (bottom - top);
  const yLabels = ticks.map((t) => format(t));
  const left = Math.ceil(Math.max(16, ...yLabels.map((l) => textWidth(l, FONT)))) + 8;
  const plotW = Math.max(40, W - left - 8);
  const slot = plotW / Math.max(1, n);
  const barW = Math.min(24, Math.max(6, slot * 0.6));
  const cx = (i: number) => left + slot * (i + 0.5);
  const catLabels = thinLabels(
    categories.map((c, i) => ({ key: c.key, label: c.label, current: c.current, x: cx(i) })),
    2,
    W - 2,
  );
  const { active, setActive, onKeyDown } = useReadout(n);
  const legend: LegendItem[] | null =
    props.legend === false
      ? null
      : props.legend ?? [
          ...series.map((s) => ({ key: s.key, label: s.label, role: s.role, mark: (s.soft ? "bar-soft" : "bar") as LegendMark })),
          ...(band ? [{ key: "band", label: band.label, role: "ok" as const, mark: "band" as const }] : []),
        ];
  const onPointer = (e: PointerEvent<SVGRectElement>) => {
    if (!n) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / Math.max(1, r.width)) * plotW;
    setActive(Math.max(0, Math.min(n - 1, Math.floor(px / slot))));
  };
  const inBand = (v: number) => band != null && v >= band.lo && v <= band.hi;
  const readout =
    active != null
      ? {
          title: categories[active].label,
          rows: [
            ...series.map((s) => ({ key: s.key, role: s.role, soft: s.soft, label: s.label, value: format(s.values[active] ?? 0) })),
            ...(series.length > 1 ? [{ key: "total", role: "history" as Role, soft: false, label: pick(lang, "total", "всего"), value: format(totals[active]) }] : []),
          ],
          extra: props.details?.(active) ?? [],
        }
      : null;

  return (
    <Frame title={title} legend={legend} table={props.table} lang={lang} kind={props.kind}>
      <div className="fitc-plot" ref={measure} tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setActive(null)} role="group" aria-label={`${title}. ${pick(lang, "Arrow keys read the values.", "Стрелки читают значения.")}`}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-labelledby={`${uid}t ${uid}d`}>
          <title id={`${uid}t`}>{title}</title>
          <desc id={`${uid}d`}>{summary}</desc>
          {active != null ? <rect className="fitc-col-on" x={left + slot * active + 1} y={top - 6} width={slot - 2} height={bottom - top + 6} rx="6" /> : null}
          {band ? (
            <g className="fitc-r-ok">
              <rect className="fitc-band" x={left} y={yMap(band.hi)} width={plotW} height={yMap(band.lo) - yMap(band.hi)} />
            </g>
          ) : null}
          <g className="fitc-grid">
            {ticks.map((t, i) => (
              <g key={t}>
                <line x1={left} x2={left + plotW} y1={yMap(t)} y2={yMap(t)} />
                <text className="fitc-axis" x={left - 6} y={yMap(t) + 3.5} textAnchor="end">
                  {yLabels[i]}
                </text>
              </g>
            ))}
            {catLabels.map((c) => (
              <text key={c.key} className={`fitc-axis${c.current ? " now" : ""}`} x={c.cx} y={H - 6} textAnchor="middle">
                {c.label}
              </text>
            ))}
          </g>
          {categories.map((c, i) => {
            let acc = 0;
            const segs = series
              .map((s) => {
                const v = s.values[i] ?? 0;
                const from = acc;
                acc += v;
                return { s, v, from, to: acc };
              })
              .filter((g) => g.v > 0);
            return (
              <g key={c.key}>
                {segs.map((g, k) => {
                  const yTop = yMap(g.to);
                  let yBottom = yMap(g.from);
                  if (k > 0 && yBottom - yTop > 3) yBottom -= 2;
                  return (
                    <g key={g.s.key} className={`fitc-r-${g.s.role}`}>
                      <path className={`fitc-bar${g.s.soft ? " soft" : ""}`} d={barPath(cx(i) - barW / 2, yTop, barW, yBottom, k === segs.length - 1)} />
                    </g>
                  );
                })}
                {props.valueLabels !== false && totals[i] > 0 && textWidth(format(totals[i]), FONT) <= slot - 2 ? (
                  <text className="fitc-value" x={cx(i)} y={yMap(totals[i]) - 5} textAnchor="middle">
                    {format(totals[i])}
                  </text>
                ) : null}
                {band && inBand(totals[i]) ? (
                  <text className="fitc-check" x={cx(i)} y={top - 4} textAnchor="middle" aria-hidden="true">
                    ✓
                  </text>
                ) : null}
              </g>
            );
          })}
          <line className="fitc-baseline" x1={left} x2={left + plotW} y1={bottom} y2={bottom} />
          <rect className="fitc-hit" x={left} y={top - 6} width={plotW} height={bottom - top + 6} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={(e) => (e.pointerType === "mouse" ? setActive(null) : undefined)} />
        </svg>
        {readout && active != null ? (
          <Tip x={cx(active)} width={W}>
            <b>{readout.title}</b>
            {readout.rows.map((r) => (
              <span key={r.key} className={`fitc-tip-row fitc-r-${r.role}`}>
                {r.key === "total" ? null : (
                  <svg width="14" height="10" viewBox="0 0 20 12" aria-hidden="true" focusable="false">
                    <MarkSvg mark={r.soft ? "bar-soft" : "bar"} />
                  </svg>
                )}
                <strong>{r.value}</strong> <span>{r.label}</span>
                {unit && r.key === "total" ? <span> {unit}</span> : null}
              </span>
            ))}
            {readout.extra.map((line) => (
              <span key={line} className="fitc-tip-row fitc-tip-extra">
                {line}
              </span>
            ))}
          </Tip>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {readout ? `${readout.title}: ${readout.rows.map((r) => `${r.label} ${r.value}`).join("; ")}` : ""}
        </p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ Heatmap */

export type HeatmapProps = {
  lang: Lang;
  /** Test hook (master plan §15): data-kind on the chart's figure, e.g. "e1rm", "volume" */
  kind?: string;
  title: string;
  summary: string;
  columns: { key: string; label: string; current?: boolean }[];
  rows: { key: string; label: string; values: number[] }[];
  /** target range: cells inside it get the --ok ring */
  band: [number, number];
  /** value at full colour (default: band top). Cells show whole numbers; the tooltip and the table keep `format`. */
  max?: number;
  format?: (v: number) => string;
  cellText?: (row: number, col: number) => string;
  table?: TableSpec | null;
  legend?: LegendItem[] | false;
};

/** Fill levels (%) where a cell's number changes treatment; progress.css picks ink, ink on a halo or the accent's text per scheme. */
const TINT_STEPS = [54, 70, 74, 87];
const tintClass = (level: number) => TINT_STEPS.filter((t) => level > t / 100).map((t) => ` t${t}`).join("");

/** Weeks × groups grid: one hue, darker = more, number in the cell when it fits, ring when inside the target band. */
export function Heatmap(props: HeatmapProps) {
  const { lang, title, summary, columns, rows, band } = props;
  const [measure, W] = useMeasuredWidth();
  const uid = useId();
  const format = props.format ?? ((v: number) => fmtNum(v, lang, 1));
  const max = props.max ?? band[1];
  const labelW = Math.min(Math.round(W * 0.38), Math.ceil(Math.max(30, ...rows.map((r) => textWidth(r.label, 12)))) + 10);
  const cols = Math.max(1, columns.length);
  const cellW = (W - labelW) / cols;
  const cellH = 26;
  const H = rows.length * cellH + 24;
  const colLabels = thinLabels(
    columns.map((c, i) => ({ key: c.key, label: c.label, current: c.current, x: labelW + (i + 0.5) * cellW })),
    labelW,
    W - 1,
  );
  const [active, setActive] = useState<[number, number] | null>(null);
  const cell = active && active[0] < rows.length && active[1] < cols ? active : null;
  const text = (r: number, c: number) => props.cellText?.(r, c) ?? `${rows[r].label} · ${columns[c].label}: ${format(rows[r].values[c] ?? 0)}`;
  const onKeyDown = (e: KeyboardEvent) => {
    if (!rows.length) return;
    const [r, c] = cell ?? [0, cols - 1];
    const moves: Record<string, [number, number] | null> = {
      ArrowRight: [r, Math.min(cols - 1, c + 1)],
      ArrowLeft: [r, Math.max(0, c - 1)],
      ArrowDown: [Math.min(rows.length - 1, r + 1), c],
      ArrowUp: [Math.max(0, r - 1), c],
      Escape: null,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    setActive(cell == null && e.key !== "Escape" ? [0, cols - 1] : moves[e.key]);
  };
  const onPointer = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / Math.max(1, r.width)) * (W - labelW);
    const py = ((e.clientY - r.top) / Math.max(1, r.height)) * (rows.length * cellH);
    setActive([Math.max(0, Math.min(rows.length - 1, Math.floor(py / cellH))), Math.max(0, Math.min(cols - 1, Math.floor(px / cellW)))]);
  };
  const legend: LegendItem[] | null =
    props.legend === false
      ? null
      : props.legend ?? [
          { key: "cell", label: pick(lang, "darker = more sets", "темнее\u00a0— больше подходов"), role: "you", mark: "bar" },
          { key: "ring", label: pick(lang, `ring = within ${band[0]}–\u2060${band[1]}`, `рамка\u00a0— в пределах ${band[0]}–\u2060${band[1]}`), role: "ok", mark: "cell-ring" },
        ];

  return (
    <Frame title={title} legend={legend} table={props.table} lang={lang} kind={props.kind}>
      <div className="fitc-plot" ref={measure} tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setActive(null)} role="group" aria-label={`${title}. ${pick(lang, "Arrow keys read the cells.", "Стрелки читают ячейки.")}`}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-labelledby={`${uid}t ${uid}d`}>
          <title id={`${uid}t`}>{title}</title>
          <desc id={`${uid}d`}>{summary}</desc>
          {rows.map((row, r) => (
            <g key={row.key}>
              <text className="fitc-row-label" x={0} y={r * cellH + cellH / 2 + 4}>
                {fitText(row.label, labelW - 8, 12)}
              </text>
              {row.values.map((v, c) => {
                const x0 = labelW + c * cellW + 1;
                const y0 = r * cellH + 1;
                const w = cellW - 2;
                const h = cellH - 2;
                const level = v > 0 ? 0.16 + 0.84 * Math.min(1, v / max) : 0;
                const label = fmtNum(Math.round(v), lang, 0);
                const on = cell != null && cell[0] === r && cell[1] === c;
                return (
                  <g key={columns[c]?.key ?? c} className="fitc-r-you">
                    {v > 0 ? <rect className="fitc-cell" x={x0} y={y0} width={w} height={h} rx="4" style={{ fillOpacity: level }} /> : <rect className="fitc-cell empty" x={x0} y={y0} width={w} height={h} rx="4" />}
                    {v >= band[0] && v <= band[1] ? <rect className="fitc-cell-ring" x={x0 + 1.5} y={y0 + 1.5} width={w - 3} height={h - 3} rx="3" /> : null}
                    {on ? <rect className="fitc-cell-on" x={x0 - 0.5} y={y0 - 0.5} width={w + 1} height={h + 1} rx="4.5" /> : null}
                    {v > 0 && textWidth(label, 10.5) <= w - 4 ? (
                      <text className={`fitc-cell-value${tintClass(level)}`} x={x0 + w / 2} y={y0 + h / 2 + 3.5} textAnchor="middle">
                        {label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          ))}
          {colLabels.map((c) => (
            <text key={c.key} className={`fitc-axis${c.current ? " now" : ""}`} x={c.cx} y={H - 6} textAnchor="middle">
              {c.label}
            </text>
          ))}
          <rect className="fitc-hit" x={labelW} y={0} width={W - labelW} height={rows.length * cellH} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={(e) => (e.pointerType === "mouse" ? setActive(null) : undefined)} />
        </svg>
        {cell ? (
          <Tip x={labelW + (cell[1] + 0.5) * cellW} width={W}>
            <span className="fitc-tip-row">{text(cell[0], cell[1])}</span>
          </Tip>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {cell ? text(cell[0], cell[1]) : ""}
        </p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ Calendar */

export type CalendarWeek = {
  key: string;
  start: number;
  planned: number;
  done: number;
  met: boolean;
  current: boolean;
  beforeStart: boolean;
  missed: number;
  days: { date: string; at: number; count: number; future: boolean; today: boolean }[];
};
export type CalendarProps = { lang: Lang; title: string; summary: string; weeks: CalendarWeek[]; table?: TableSpec | null; kind?: string };

/** Weeks as columns, Monday → Sunday as rows; filled = trained; under each week done/planned and ✓ when met. */
export function Calendar(props: CalendarProps) {
  const { lang, title, summary, weeks } = props;
  const [measure, W] = useMeasuredWidth();
  const uid = useId();
  const labelW = 26;
  const cols = Math.max(1, weeks.length);
  const colW = (W - labelW) / cols;
  const size = Math.max(10, Math.min(24, colW - 3));
  const gap = 3;
  const top = 16;
  const gridH = 7 * (size + gap);
  const H = top + gridH + 30;
  const dayNames = lang === "ru" ? ["Пн", "", "Ср", "", "Пт", "", ""] : ["Mon", "", "Wed", "", "Fri", "", ""];
  const [active, setActive] = useState<[number, number] | null>(null);
  const cell = active && active[0] < cols ? active : null;
  const monthLabels: { x: number; label: string }[] = [];
  weeks.forEach((w, i) => {
    const d = new Date(w.start);
    const prev = i > 0 ? new Date(weeks[i - 1].start) : null;
    if (!prev || prev.getMonth() !== d.getMonth()) {
      const x = labelW + i * colW;
      const label = fmtDay(w.start + 3 * 86_400_000, lang, { month: "short" });
      const last = monthLabels[monthLabels.length - 1];
      if (!last || x - last.x >= textWidth(last.label, FONT) + 6) monthLabels.push({ x, label });
    }
  });
  const dayText = (wi: number, di: number) => {
    const day = weeks[wi].days[di];
    const date = fmtDay(day.at, lang, { weekday: "short", day: "numeric", month: "short" });
    const state = day.count > 0 ? pick(lang, day.count > 1 ? `${day.count} sessions` : "trained", day.count > 1 ? `${day.count} тренировки` : "тренировка") : day.future ? pick(lang, "ahead", "впереди") : pick(lang, "rest", "отдых");
    const w = weeks[wi];
    const week = w.beforeStart ? "" : ` · ${pick(lang, "week", "неделя")} ${w.done}/${w.planned}`;
    return `${date}: ${state}${week}`;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const [c, d] = cell ?? [cols - 1, 0];
    const moves: Record<string, [number, number] | null> = {
      ArrowRight: [Math.min(cols - 1, c + 1), d],
      ArrowLeft: [Math.max(0, c - 1), d],
      ArrowDown: [c, Math.min(6, d + 1)],
      ArrowUp: [c, Math.max(0, d - 1)],
      Escape: null,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    setActive(cell == null && e.key !== "Escape" ? [cols - 1, 0] : moves[e.key]);
  };
  const onPointer = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / Math.max(1, r.width)) * (W - labelW);
    const py = ((e.clientY - r.top) / Math.max(1, r.height)) * gridH;
    setActive([Math.max(0, Math.min(cols - 1, Math.floor(px / colW))), Math.max(0, Math.min(6, Math.floor(py / (size + gap))))]);
  };
  const legend: LegendItem[] = [
    { key: "done", label: pick(lang, "trained", "тренировка"), role: "you", mark: "bar" },
    { key: "met", label: pick(lang, "week target met", "план недели выполнен"), role: "ok", mark: "check" },
  ];

  return (
    <Frame title={title} legend={legend} table={props.table} lang={lang} kind={props.kind}>
      <div className="fitc-plot" ref={measure} tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setActive(null)} role="group" aria-label={`${title}. ${pick(lang, "Arrow keys read the days.", "Стрелки читают дни.")}`}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-labelledby={`${uid}t ${uid}d`}>
          <title id={`${uid}t`}>{title}</title>
          <desc id={`${uid}d`}>{summary}</desc>
          {monthLabels.map((m) => (
            <text key={`${m.x}`} className="fitc-axis" x={m.x + 1} y={11}>
              {m.label}
            </text>
          ))}
          {dayNames.map((d, i) =>
            d ? (
              <text key={d} className="fitc-axis" x={0} y={top + i * (size + gap) + size / 2 + 4}>
                {d}
              </text>
            ) : null,
          )}
          {weeks.map((w, wi) => {
            const x0 = labelW + wi * colW + (colW - size) / 2;
            return (
              <g key={w.key}>
                {w.days.map((d, di) => {
                  const y0 = top + di * (size + gap);
                  const cls = d.count > 0 ? "done" : d.future ? "future" : w.beforeStart ? "before" : "rest";
                  const on = cell != null && cell[0] === wi && cell[1] === di;
                  return (
                    <g key={d.date} className="fitc-r-you">
                      <rect className={`fitc-day ${cls}${d.today ? " today" : ""}${on ? " on" : ""}`} x={x0} y={y0} width={size} height={size} rx="4" />
                    </g>
                  );
                })}
                {w.beforeStart ? null : (
                  <>
                    <text className={`fitc-week${w.met ? " met" : ""}`} x={x0 + size / 2} y={top + gridH + 11} textAnchor="middle">
                      {colW >= 26 ? `${w.done}/${w.planned}` : `${w.done}`}
                    </text>
                    {w.met ? (
                      <text className="fitc-check" x={x0 + size / 2} y={top + gridH + 25} textAnchor="middle">
                        ✓
                      </text>
                    ) : null}
                  </>
                )}
              </g>
            );
          })}
          <rect className="fitc-hit" x={labelW} y={top} width={W - labelW} height={gridH} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={(e) => (e.pointerType === "mouse" ? setActive(null) : undefined)} />
        </svg>
        {cell ? (
          <Tip x={labelW + (cell[0] + 0.5) * colW} width={W}>
            <span className="fitc-tip-row">{dayText(cell[0], cell[1])}</span>
          </Tip>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {cell ? dayText(cell[0], cell[1]) : ""}
        </p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ Sparkline */

/** Tiny trend line for stat tiles: history in --muted, the latest value as an --accent dot. */
export function Sparkline({ values, summary, height = 28 }: { values: number[]; summary: string; height?: number }) {
  const [measure, W] = useMeasuredWidth(120);
  const pts = values.filter(Number.isFinite);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const pad = 3;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = (v: number) => (max > min ? height - pad - ((v - min) / (max - min)) * (height - 2 * pad) : height / 2);
  return (
    <div className="fitc-spark" ref={measure}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label={summary}>
        <g className="fitc-r-history">
          <path className="fitc-line thin" d={path(pts.map((v, i) => [x(i), y(v)]))} />
        </g>
        <g className="fitc-r-you">
          <circle className="fitc-dot" cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="3" />
        </g>
      </svg>
    </div>
  );
}
