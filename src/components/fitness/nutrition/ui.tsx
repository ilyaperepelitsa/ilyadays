/**
 * Small shared pieces of the nutrition page (stream 09): number formatting, a decimal-friendly number field, a
 * segmented control and "[n]" source references. Hook-free, so the server view can use `Refs` too.
 */
import type { ReactNode } from "react";
import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { sourceNumber } from "@/lib/fitness/nutrition.mjs";

const locale = (lang: Lang) => (lang === "ru" ? "ru-RU" : "en-GB");

/** 1973 → "1,973" / "1 973"; `digits` fixes the decimals (0.4 → "0.40" with 2). */
export function fmt(n: number, lang: Lang, digits = 0) {
  return new Intl.NumberFormat(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** At most `digits` decimals, no trailing zeros: 0.5 → "0.5", 2 → "2". */
export function fmtUpTo(n: number, lang: Lang, digits = 1) {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(n);
}

/** +157 / −440 with a real minus sign; `upTo` drops trailing zeros (−0.5 rather than −0.50). */
export function fmtSigned(n: number, lang: Lang, digits = 0, upTo = false) {
  const s = upTo ? fmtUpTo(Math.abs(n), lang, digits) : fmt(Math.abs(n), lang, digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

/** Anchor id of a source in the sources list. */
export const sourceAnchor = (id: string) => `nutrition-source-${id}`;

/** "[3, 7]" linking to the numbered sources at the bottom of the page. */
export function Refs({ ids, lang }: { ids: readonly string[]; lang: Lang }) {
  // Numbered like a reference list: ascending, each source once.
  const known = [...new Set(ids)].filter((id) => sourceNumber(id) > 0).sort((a, b) => sourceNumber(a) - sourceNumber(b));
  if (!known.length) return null;
  return (
    <sup className="nut-refs" aria-label={pick(lang, "Sources", "Источники")}>
      [
      {known.map((id, i) => (
        <span key={id}>
          {i > 0 ? ", " : ""}
          <a href={`#${sourceAnchor(id)}`}>{sourceNumber(id)}</a>
        </span>
      ))}
      ]
    </sup>
  );
}

export function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  placeholder,
  hint,
  invalid,
}: {
  id: string;
  label: ReactNode;
  unit?: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  invalid?: boolean;
}) {
  return (
    <div className={`nut-field${invalid ? " invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="nut-input">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").slice(0, 7))}
        />
        {unit ? <span className="nut-unit" aria-hidden="true">{unit}</span> : null}
      </div>
      {hint ? <small id={`${id}-hint`} className="nut-hint">{hint}</small> : null}
    </div>
  );
}

export type SegOption<T extends string> = { value: T; label: ReactNode; hint?: ReactNode };

/** A labelled row of toggle buttons (aria-pressed), styled by `.fit-seg`. */
export function Seg<T extends string>({
  legend,
  options,
  value,
  onChange,
  className,
}: {
  legend: ReactNode;
  options: SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={`nut-seg ${className ?? ""}`}>
      <legend>{legend}</legend>
      <div className="fit-seg">
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            <span className="nut-seg-label">{o.label}</span>
            {o.hint ? <small className="nut-seg-hint">{o.hint}</small> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
