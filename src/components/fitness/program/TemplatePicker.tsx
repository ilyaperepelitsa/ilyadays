/** Start over from a template (2-, 3- or 4-day split). Goes into the draft like every edit: Discard undoes it. */
import type { GoalMode, Lang } from "@/lib/fitness/types";
import { pick, t2 } from "@/lib/fitness/i18n";
import { TEMPLATES } from "@/lib/fitness/templates.mjs";
import { resetToTemplate } from "@/lib/fitness/program-edit.mjs";
import type { Edit } from "./SlotRow";

export function TemplatePicker({ lang, goal, current, editable, onEdit }: { lang: Lang; goal: GoalMode; current: string; editable: boolean; onEdit: Edit }) {
  const templates = TEMPLATES.filter((t) => !t.addon);
  return (
    <details className="fit-card fpr-section fpr-templates">
      <summary>
        <h2>{pick(lang, "Templates", "Шаблоны")}</h2>
        <span className="fit-muted fpr-small">{pick(lang, "Start over from a ready-made split", "Начать заново с готовой схемы")}</span>
      </summary>
      <ul className="fpr-template-list">
        {templates.map((t) => (
          <li key={t.id} className={t.id === current ? "on" : undefined}>
            <h3>
              {t2(lang, t.name)}
              {t.id === current ? <span className="fpr-tag">{pick(lang, "Current", "Текущий")}</span> : null}
            </h3>
            <p className="fpr-small">{t2(lang, t.description)}</p>
            <p className="fit-muted fpr-small">{t.days.map((d) => t2(lang, d.name)).join(" · ")}</p>
            {editable ? (
              <button type="button" className="fit-button quiet" data-testid="template-use" data-template-id={t.id} onClick={() => onEdit((p, at) => resetToTemplate(t.id, goal, t.daysPerWeek, at, { from: p }))}>
                {t.id === current ? pick(lang, "Reset to this template", "Сбросить к этому шаблону") : pick(lang, "Use this template", "Взять этот шаблон")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {editable ? (
        <p className="fit-muted fpr-small">
          {pick(lang, "This replaces your exercises and tweaks in the draft; nothing is saved until you tap Save.", "Это заменит ваши упражнения и правки в черновике; ничего не сохранится, пока вы не нажмёте «Сохранить».")}
        </p>
      ) : null}
    </details>
  );
}
