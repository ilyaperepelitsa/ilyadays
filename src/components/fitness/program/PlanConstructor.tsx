/** Personal constraints and prioritized goals, kept in the same reviewable draft as every program edit. */
import type { Lang, Program, TrainingPreferences } from '@/lib/fitness/types';
import { pick, t2 } from '@/lib/fitness/i18n';
import { GROUPS } from '@/lib/fitness/catalog.mjs';
import { GOAL_IDS, GOAL_MODES } from '@/lib/fitness/templates.mjs';
import { addLegs } from '@/lib/fitness/program-edit.mjs';
import { buildPersonalProgram, setPlanPreferences } from '@/lib/fitness/plan-builder.mjs';
import { LOWER_BODY_GROUPS, trainingPreferences } from '@/lib/fitness/plan-preferences.mjs';
import type { Edit } from './SlotRow';

const LOWER = new Set(LOWER_BODY_GROUPS);

export function PlanConstructor({ lang, program, editable, onEdit }: { lang: Lang; program: Program; editable: boolean; onEdit: Edit }) {
  const prefs = trainingPreferences(program.preferences ?? { bodyScope: 'custom' }, program.goal);
  const scope = (bodyScope: TrainingPreferences['bodyScope']) => onEdit((p, at) => {
    const next = setPlanPreferences(p, { bodyScope, excludedGroups: bodyScope === 'full' ? prefs.excludedGroups.filter((g) => !LOWER.has(g)) : prefs.excludedGroups }, at);
    return bodyScope === 'full' ? addLegs(next, at, { as: 'slots' }) : next;
  });
  const build = (custom: boolean) => onEdit((p, at) => ({ ...buildPersonalProgram({ goal: p.goal, daysPerWeek: p.daysPerWeek, ...prefs, title: t2(lang, p.name), now: at, custom }), pivotReason: p.pivotReason }));
  return (
    <section className="fit-card fpr-section fpr-constructor" aria-labelledby="fpr-constructor-h" data-testid="plan-constructor">
      <h2 id="fpr-constructor-h">{pick(lang, 'Make this plan yours', 'Настройте план под себя')}</h2>
      <p className="fit-muted fpr-small">{pick(lang, 'Your primary goal sets reps, effort and progression. Up to two supporting goals record your priorities; they do not create conflicting prescriptions.', 'Основная цель задаёт повторения, усилие и прогрессию. До двух дополнительных целей сохраняют ваши приоритеты, не создавая противоречивых предписаний.')}</p>
      <label className="fpr-field">
        <span>{pick(lang, 'Plan name', 'Название плана')}</span>
        <input className="fpr-input" data-testid="plan-name" key={program.name.en} defaultValue={t2(lang, program.name)} maxLength={80} disabled={!editable} onBlur={(e) => { const title = e.currentTarget.value; onEdit((p, at) => setPlanPreferences(p, { title }, at)); }} />
      </label>
      <fieldset className="fpr-choice-field" disabled={!editable}>
        <legend>{pick(lang, 'Supporting goals (optional, up to two)', 'Дополнительные цели (необязательно, до двух)')}</legend>
        <div className="fpr-checks">{GOAL_IDS.filter((id) => id !== program.goal).map((id) => (
          <label key={id}><input type="checkbox" data-testid="secondary-goal" data-value={id} checked={prefs.secondaryGoals.includes(id)} disabled={!prefs.secondaryGoals.includes(id) && prefs.secondaryGoals.length >= 2} onChange={(e) => { const checked = e.currentTarget.checked; onEdit((p, at) => setPlanPreferences(p, { secondaryGoals: checked ? [...prefs.secondaryGoals, id] : prefs.secondaryGoals.filter((g) => g !== id) }, at)); }} />{t2(lang, GOAL_MODES[id].name)}</label>
        ))}</div>
        {prefs.secondaryGoals.length ? <p className="fpr-small">{prefs.secondaryGoals.map((g, i) => `${i + 1}. ${t2(lang, GOAL_MODES[g].name)}`).join(' · ')}</p> : null}
      </fieldset>
      <fieldset className="fpr-choice-field" disabled={!editable}>
        <legend>{pick(lang, 'Training scope', 'Что тренировать')}</legend>
        <div className="fit-seg fpr-scope" data-testid="plan-scope">{(['upper', 'full', 'custom'] as const).map((value) => (
          <button key={value} type="button" data-value={value} aria-pressed={prefs.bodyScope === value} onClick={() => scope(value)}>{value === 'upper' ? pick(lang, 'Upper body · no legs', 'Верх тела · без ног') : value === 'full' ? pick(lang, 'Full body', 'Всё тело') : pick(lang, 'Custom exclusions', 'Свои исключения')}</button>
        ))}</div>
        <p className="fit-muted fpr-small">{pick(lang, 'Upper body excludes leg, glute and calf exercises, hinges, squats and loaded carries. Full body adds lower-body work across your days. Your exclusions continue to apply when you change goals, templates or days.', 'Верх тела исключает упражнения на ноги, ягодицы и икры, наклоны с весом, приседания и переноски. Всё тело добавляет работу на низ в ваши дни. Исключения сохраняются при смене целей, шаблонов и числа дней.')}</p>
        <details><summary>{pick(lang, 'Exclude target muscle groups', 'Исключить целевые группы мышц')}</summary><div className="fpr-checks">{GROUPS.map((g) => (
          <label key={g.id}><input type="checkbox" data-testid="exclude-group" data-value={g.id} checked={prefs.excludedGroups.includes(g.id)} disabled={prefs.bodyScope === 'upper' && LOWER.has(g.id)} onChange={(e) => { const checked = e.currentTarget.checked; onEdit((p, at) => setPlanPreferences(p, { excludedGroups: checked ? [...prefs.excludedGroups, g.id] : prefs.excludedGroups.filter((id) => id !== g.id) }, at)); }} />{t2(lang, g.name)}</label>
        ))}</div></details>
      </fieldset>
      <label className="fpr-field">
        <span>{pick(lang, 'Why change direction? (optional)', 'Почему меняете план? (необязательно)')}</span>
        <textarea className="fpr-input" data-testid="pivot-reason" key={program.pivotReason ?? ''} defaultValue={program.pivotReason ?? ''} maxLength={500} rows={2} disabled={!editable} onBlur={(e) => { const pivotReason = e.currentTarget.value; onEdit((p, at) => setPlanPreferences(p, { pivotReason }, at)); }} placeholder={pick(lang, 'Different goal, less time, a new gym…', 'Другая цель, меньше времени, новый зал…')} />
      </label>
      {editable ? <details><summary>{pick(lang, 'Construct a new draft', 'Собрать новый черновик')}</summary>
        <p className="fit-muted fpr-small">{pick(lang, 'A new draft replaces the exercises shown below. Your current program and training history stay intact until Save; saved changes create a new program version. A workout already started keeps its original plan.', 'Новый черновик заменит упражнения ниже. Текущая программа и история сохраняются до нажатия «Сохранить»; сохранение создаёт новую версию. Начатая тренировка продолжает идти по исходному плану.')}</p>
        <div className="fpr-builder-actions"><button type="button" className="fit-button quiet" data-testid="plan-build" onClick={() => build(false)}>{pick(lang, 'Build from a starting plan', 'Взять стартовую схему')}</button><button type="button" className="fit-button ghost" data-testid="plan-custom" onClick={() => build(true)}>{pick(lang, 'Start with empty days', 'Начать с пустых дней')}</button></div>
      </details> : null}
    </section>
  );
}
