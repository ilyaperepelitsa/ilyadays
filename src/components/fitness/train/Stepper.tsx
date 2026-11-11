/**
 * − value + control, shared by the gym screen (reps, kg) and the program page (sets, rest, ranges, progression). The
 * value is shown, not typed: no keyboard on a phone. Buttons are ≥ 44 px; the value is announced politely.
 * One look everywhere (fitness.css `.fit-stepper*`: white pill, 48 px buttons). `look` only says where it is used: the
 * program editor also marks the group with the test id and the value.
 */
export function Stepper({
  label,
  value,
  step = 1,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  format = String,
  stepText,
  disabled,
  onChange,
  testid,
  wide,
  look = "program",
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  /** How the value reads (e.g. 150 → "2:30", 2.5 → "2,5") */
  format?: (value: number) => string;
  /** The step as text for the button names ("Weight −2.5"); without it they are "Weight: −" */
  stepText?: string;
  disabled?: boolean;
  /** `next` is clamped to min…max and rounded to 0.01; `delta` is the raw ±step for callers that apply steps themselves */
  onChange: (next: number, delta: number) => void;
  /** Test-id prefix: `<testid>-minus` / `<testid>-plus`; the program look also marks the group with it and the value */
  testid?: string;
  /** Takes the whole row (long value texts) */
  wide?: boolean;
  look?: "train" | "program";
}) {
  const move = (delta: number) => onChange(Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100)), delta);
  const name = (sign: "−" | "+") => (stepText ? `${label} ${sign}${stepText}` : `${label}: ${sign}`);
  const group = look === "program" && testid ? { "data-testid": testid, "data-value": value } : null;
  return (
    <div className={`fit-stepper${wide ? " wide" : ""}`} role="group" aria-label={label} {...group}>
      <span className="fit-stepper-label">{label}</span>
      <div className="fit-stepper-row">
        <button type="button" className="fit-step" aria-label={name("−")} data-testid={testid ? `${testid}-minus` : undefined} disabled={disabled || value <= min} onClick={() => move(-step)}>
          −
        </button>
        <output className="fit-stepper-value fit-num" aria-live="polite">
          {format(value)}
        </output>
        <button type="button" className="fit-step" aria-label={name("+")} data-testid={testid ? `${testid}-plus` : undefined} disabled={disabled || value >= max} onClick={() => move(step)}>
          +
        </button>
      </div>
    </div>
  );
}
