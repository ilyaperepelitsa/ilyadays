/** − value + with 48 px buttons (program page). The value is shown, not typed: no keyboard on a phone. */
export function Stepper({
  label,
  value,
  text,
  min,
  max,
  step = 1,
  disabled,
  onChange,
  testid,
  wide,
}: {
  label: string;
  value: number;
  /** Shown instead of the number (e.g. "2:30") */
  text?: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  testid?: string;
  /** Takes the whole row (long value texts) */
  wide?: boolean;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div className={wide ? "fpr-stepper wide" : "fpr-stepper"} role="group" aria-label={label} data-testid={testid} data-value={testid ? value : undefined}>
      <span className="fpr-stepper-label">{label}</span>
      <span className="fpr-stepper-row">
        <button type="button" className="fpr-step" aria-label={`${label}: −`} data-testid={testid ? `${testid}-minus` : undefined} disabled={disabled || value <= min} onClick={() => set(value - step)}>
          −
        </button>
        <output className="fpr-stepper-value fit-num" aria-live="polite">
          {text ?? value}
        </output>
        <button type="button" className="fpr-step" aria-label={`${label}: +`} data-testid={testid ? `${testid}-plus` : undefined} disabled={disabled || value >= max} onClick={() => set(value + step)}>
          +
        </button>
      </span>
    </div>
  );
}
