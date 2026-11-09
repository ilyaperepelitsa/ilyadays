/** − value + control for reps or kg (stream 04). Buttons are ≥ 48 px; the value is announced politely. */
import type { Lang } from "@/lib/fitness/types";
import { fmtKg } from "@/lib/fitness/i18n";

export function Stepper({ lang, label, value, step, min = 0, onStep, testid }: {
  lang: Lang;
  label: string;
  value: number;
  step: number;
  min?: number;
  onStep: (delta: number) => void;
  /** Test-id prefix (`reps` / `kg`): only on the current set's steppers. */
  testid?: string;
}) {
  const shown = fmtKg(value, lang);
  const stepText = fmtKg(step, lang);
  return (
    <div className="trk-stepper" role="group" aria-label={label}>
      <span className="trk-stepper-label">{label}</span>
      <div className="trk-stepper-row">
        <button
          type="button"
          className="trk-step"
          onClick={() => onStep(-step)}
          disabled={value <= min}
          aria-label={`${label} −${stepText}`}
          data-testid={testid ? `${testid}-minus` : undefined}
        >
          −
        </button>
        <output className="trk-stepper-value fit-num" aria-live="polite">
          {shown}
        </output>
        <button
          type="button"
          className="trk-step"
          onClick={() => onStep(step)}
          aria-label={`${label} +${stepText}`}
          data-testid={testid ? `${testid}-plus` : undefined}
        >
          +
        </button>
      </div>
    </div>
  );
}
