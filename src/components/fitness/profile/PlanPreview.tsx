"use client";

import { useId, useRef } from "react";
import type { Lang, Program } from "@/lib/fitness/types";
import { exerciseById } from "@/lib/fitness/catalog.mjs";
import { estimateMinutes } from "@/lib/fitness/templates.mjs";
import { pick, t2 } from "@/lib/fitness/i18n";
import { ExerciseThumbnail } from "../ExerciseThumbnail";
import { ActionIcon } from "../ActionIcon";
import { rangeText, unitOfExercise } from "../program/format";

function PreviewDays({ lang, program }: { lang: Lang; program: Program }) {
  return <div className="fprofile-preview-days">{program.days.map((day) => <section key={day.key}>
    <div className="fprofile-preview-day-head"><span>{day.key}</span><div><h3>{t2(lang, day.name)}</h3><p className="fit-num">{day.slots.length} {pick(lang, "exercises", "упражнений")} / ~{estimateMinutes(day)} {pick(lang, "min", "мин")}</p></div></div>
    <ul>{day.slots.slice(0, 3).map((slot) => <li key={slot.slotId}><ExerciseThumbnail id={slot.exerciseId} /><span>{t2(lang, exerciseById(slot.exerciseId)?.name, slot.exerciseId)}<small className="fit-num">{slot.sets} × {rangeText(slot.repRange, unitOfExercise(exerciseById(slot.exerciseId)), lang)}</small></span></li>)}</ul>
    {day.slots.length > 3 ? <details><summary>{pick(lang, `Show ${day.slots.length - 3} more exercises`, `Ещё ${day.slots.length - 3} упр.`)}</summary><ul>{day.slots.slice(3).map((slot) => <li key={slot.slotId}><ExerciseThumbnail id={slot.exerciseId} /><span>{t2(lang, exerciseById(slot.exerciseId)?.name, slot.exerciseId)}<small className="fit-num">{slot.sets} × {rangeText(slot.repRange, unitOfExercise(exerciseById(slot.exerciseId)), lang)}</small></span></li>)}</ul></details> : null}
  </section>)}</div>;
}

export function PlanPreview({ lang, program, isDraft }: { lang: Lang; program: Program | null; isDraft: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const minutes = program?.days.map((day) => estimateMinutes(day)) ?? [];
  const summary = program ? `${program.days.length} ${pick(lang, "days/week", "дн./нед.")} / ~${Math.round(minutes.reduce((a, b) => a + b, 0) / Math.max(1, minutes.length))} ${pick(lang, "min/session", "мин/трен.")}` : pick(lang, "No plan selected", "Программа не выбрана");
  const content = <>
    <p className="fprofile-preview-state">{isDraft ? pick(lang, "Preview · save to apply", "Предпросмотр · сохраните для применения") : pick(lang, "Current program", "Текущая программа")}</p>
    {program ? <><PreviewDays lang={lang} program={program} /><p className="fprofile-preview-note">{pick(lang, "Start light. Your logged reps and effort establish a separate baseline for each exercise.", "Начните с лёгкого веса. Фактические повторы и усилие зададут базовый вес отдельно для каждого упражнения.")}</p></> : <p className="fit-muted">{pick(lang, "Choose to create a plan to see your training days here.", "Выберите создание программы, чтобы увидеть тренировочные дни.")}</p>}
  </>;
  return <>
    <aside className="fprofile-preview" data-testid="profile-plan-preview" aria-label={pick(lang, "Plan preview", "Предпросмотр программы")}>
      <h2>{pick(lang, "Your training week", "Ваша тренировочная неделя")}</h2><p className="fprofile-preview-summary fit-num">{summary}</p>{content}
    </aside>
    <div className="fprofile-mobile-preview"><p className="fit-num" role="status">{summary}</p><button type="button" className="fit-button quiet" onClick={() => dialog.current?.showModal()}>{pick(lang, "See plan", "Смотреть план")}</button></div>
    <dialog ref={dialog} className="fprofile-preview-dialog" aria-labelledby={titleId}>
      <header><h2 id={titleId}>{pick(lang, "Your training week", "Ваша тренировочная неделя")}</h2><button type="button" className="fit-button quiet" aria-label={pick(lang, "Close preview", "Закрыть предпросмотр")} onClick={() => dialog.current?.close()}><ActionIcon name="close" /></button></header>
      <p className="fprofile-preview-summary fit-num">{summary}</p>{content}
    </dialog>
  </>;
}
