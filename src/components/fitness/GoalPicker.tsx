"use client";

import { useId } from "react";
import type { GoalMode, Lang } from "@/lib/fitness/types";
import { GOAL_IDS, GOAL_MODES } from "@/lib/fitness/templates.mjs";
import { pick, t2 } from "@/lib/fitness/i18n";

export function GoalPicker({ lang, value, disabled = false, testId, onChange }: {
  lang: Lang; value: GoalMode; disabled?: boolean; testId: string; onChange: (goal: GoalMode) => void;
}) {
  const name = useId();
  return <div className="fit-goal-picker" role="radiogroup" aria-label={pick(lang, "Primary training goal", "Главная цель тренировок")} data-testid={testId} data-value={value}>
    {GOAL_IDS.map((goal: GoalMode) => {
      const mode = GOAL_MODES[goal];
      return <label key={goal} className={value === goal ? "is-selected" : undefined}>
        <input type="radio" name={name} value={goal} data-value={goal} checked={value === goal} disabled={disabled} onChange={() => onChange(goal)} />
        <span><strong>{t2(lang, mode.name)}</strong><small className="fit-num">{mode.repRange[0]}–{mode.repRange[1]} {pick(lang, "reps", "повт.")} / {mode.rir} RIR</small></span>
      </label>;
    })}
  </div>;
}
