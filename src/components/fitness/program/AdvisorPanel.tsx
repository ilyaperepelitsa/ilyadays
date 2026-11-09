/**
 * The AI coach (stream 10): the owner describes what changed, the model proposes small changes through a strict
 * schema (advisor.mjs), every change is shown as a computed diff line with its reason, and nothing changes until
 * Apply. The OpenAI key, model and effort are the trip planner's (same browser storage, same client). Also the list
 * of recent plan changes (advisor and manual saves), which everyone can read.
 */
import { useState, useSyncExternalStore } from "react";
import type {
  Adjustment, BodyweightEntry, ExerciseState, FitnessStore, Gym, Lang, LoggedSet, Program, Session, Settings, Text2,
} from "@/lib/fitness/types";
import { fmtDate, pick, pluralRu, t2 } from "@/lib/fitness/i18n";
import {
  MAX_REQUEST, adjustCall, adjustmentRow, applyProposal, asksForLegs, describeChange, validateProposal,
} from "@/lib/fitness/advisor.mjs";
import { completeJson } from "@/lib/trips/openai.mjs";
import { readAiKey, readEffort, readModel, subscribePrefs, writeAiKey, writeEffort, writeModel } from "@/lib/trips/store.mjs";

const DEFAULT_MODEL = "gpt-6.1-sol";
const EFFORTS: [string, string, string][] = [
  ["low", "Low", "Низкое"],
  ["medium", "Medium", "Среднее"],
  ["high", "High", "Высокое"],
  ["xhigh", "Max", "Максимум"],
];
const EXAMPLES: [string, string][] = [
  ["I can only train twice a week this month", "В этом месяце могу тренироваться только два раза в неделю"],
  ["Pec deck hurts my left shoulder", "На бабочке болит левое плечо"],
  ["More strength-focused", "Больше упора на силу"],
  ["I missed two weeks", "Я пропустил две недели"],
];

/** @param id low | medium | high | xhigh */
function effortLabel(lang: Lang, id: string): string {
  const e = EFFORTS.find((x) => x[0] === id) ?? EFFORTS[1];
  return pick(lang, e[1], e[2]);
}

type Validated = ReturnType<typeof validateProposal>;
type Pending = { raw: unknown; request: string; model: string; effort: string; base: Program; proposal: Validated; lines: Text2[] };
type Done = { applied: number; skipped: Validated["dropped"] };

const serverModel = () => DEFAULT_MODEL;
const serverEffort = () => "medium";
const serverKey = () => "";

/** The same error wording as the trip planner (TripComposer message()): codes first, then the API's own message. */
function advisorMessage(lang: Lang, error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  switch (code) {
    case "key":
      return pick(lang, "Add an OpenAI API key first.", "Сначала добавьте ключ OpenAI.");
    case "timeout":
      return pick(lang, "The model took too long to answer. Try again, or pick a lower effort.", "Модель слишком долго отвечала. Попробуйте ещё раз или выберите усилие пониже.");
    case "network":
      return pick(lang, "Couldn't reach OpenAI. Check the connection and try again.", "Не удалось связаться с OpenAI. Проверьте соединение и попробуйте ещё раз.");
    case "incomplete":
      return pick(lang, "The model stopped before the answer was complete. Try again.", "Модель остановилась, не закончив ответ. Попробуйте ещё раз.");
    case "shape":
      return pick(lang, "The answer did not have the expected shape. Try again.", "Ответ пришёл в неожиданном виде. Попробуйте ещё раз.");
  }
  if (error instanceof Error && error.message && error.message !== "empty") return error.message;
  return pick(lang, "That didn't work. Try again.", "Не вышло. Попробуйте ещё раз.");
}

export function AdvisorPanel({
  lang,
  program,
  store,
  canWrite,
  dirty,
  states,
  sessions,
  sets,
  settings,
  bodyweight,
  adjustments,
  gym,
  onProgram,
}: {
  lang: Lang;
  program: Program;
  store: FitnessStore;
  canWrite: boolean;
  /** The editor has unsaved edits: the advisor works on the saved program only. */
  dirty: boolean;
  states: Record<string, ExerciseState>;
  sessions: Record<string, Session>;
  sets: Record<string, LoggedSet>;
  settings: Settings | null;
  bodyweight: Record<string, BodyweightEntry>;
  adjustments: Record<string, Adjustment>;
  gym: Gym | null;
  /** Save a new program version (commitProgram + settings); returns the row written */
  onProgram: (next: Program, at: string) => Program;
}) {
  const storedKey = useSyncExternalStore(subscribePrefs, readAiKey, serverKey);
  const storedModel = useSyncExternalStore(subscribePrefs, readModel, serverModel);
  const effort = useSyncExternalStore(subscribePrefs, readEffort, serverEffort);
  const [modelDraft, setModelDraft] = useState<string | null>(null);
  const model = modelDraft ?? storedModel;
  const [keyDraft, setKeyDraft] = useState("");
  const [changingKey, setChangingKey] = useState(false);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const latestKg = Object.values(bodyweight).sort((a, b) => (a.at < b.at ? 1 : -1))[0]?.kg ?? settings?.bodyweightKg ?? null;
  const validate = (raw: unknown, text: string) => validateProposal(raw, program, null, { states, gym, allowLegs: asksForLegs(text), bodyweightKg: latestKg });

  async function ask() {
    const text = request.trim();
    if (!text || busy || dirty) return;
    setError("");
    setDone(null);
    setPending(null);
    const secret = keyDraft.trim() || storedKey;
    if (!secret) {
      setError(advisorMessage(lang, { code: "key" }));
      return;
    }
    const chosen = model.trim() || DEFAULT_MODEL;
    if (keyDraft.trim()) writeAiKey(keyDraft.trim());
    writeModel(chosen);
    writeEffort(effort);
    setKeyDraft("");
    setChangingKey(false);
    setBusy(true);
    try {
      const call = adjustCall({ program, states, sessions, sets, settings, bodyweight, adjustments, gym, request: text, lang, now: new Date().toISOString() });
      const raw = await completeJson(secret, chosen, effort, call);
      const proposal = validate(raw, text);
      const lines = proposal.changes.map((c) => ({ en: describeChange(c, program, states, "en"), ru: describeChange(c, program, states, "ru") }));
      setPending({ raw, request: text, model: chosen, effort, base: program, proposal, lines });
    } catch (err) {
      setError(advisorMessage(lang, err));
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    // unsaved editor edits would be replaced by the new version: save or discard them first
    if (!pending || !canWrite || dirty) return;
    const at = new Date().toISOString();
    // the program may have changed since the question (another device, a save): check the answer again against it
    const proposal = pending.base === program ? pending.proposal : validate(pending.raw, pending.request);
    const result = applyProposal({ program, states, proposal, now: at, settings, gym, bodyweightKg: latestKg });
    const saved = result.program !== program ? onProgram(result.program, at) : null;
    for (const s of result.changedStates) store.upsert("exercise_state", s);
    store.upsert("adjustments", adjustmentRow({ now: at, request: pending.request, lang, model: pending.model, effort: pending.effort, program, proposal, dropped: proposal.dropped, result, applied: true, saved }));
    setDone({ applied: result.applied.length, skipped: result.skipped });
    setPending(null);
    setRequest("");
  }

  function dismiss() {
    if (!pending) return;
    if (canWrite) {
      store.upsert("adjustments", adjustmentRow({ now: new Date().toISOString(), request: pending.request, lang, model: pending.model, effort: pending.effort, program, proposal: pending.proposal, dropped: pending.proposal.dropped, applied: false }));
    }
    setPending(null);
  }

  const showKeyField = !storedKey || changingKey;
  return (
    <section className="fit-card fpr-section fad" aria-labelledby="fad-h">
      <h2 id="fad-h">{pick(lang, "AI coach", "ИИ-тренер")}</h2>
      <p className="fit-muted fpr-small">
        {pick(
          lang,
          "Tell it what changed or what you want. It reads your program and your recent sessions and proposes small changes; nothing changes until you apply them.",
          "Расскажите, что изменилось или чего хотите. Он смотрит программу и последние тренировки и предлагает небольшие изменения; ничего не меняется, пока вы их не примените.",
        )}
      </p>

      <div className="fad-chips" role="group" aria-label={pick(lang, "Examples", "Примеры")}>
        {EXAMPLES.map(([en, ru]) => (
          <button key={en} type="button" className="fad-chip" data-testid="advisor-example" disabled={busy} onClick={() => setRequest(pick(lang, en, ru))}>
            {pick(lang, en, ru)}
          </button>
        ))}
      </div>

      <label className="fpr-field">
        <span className="fpr-stepper-label">{pick(lang, "Your request", "Ваш запрос")}</span>
        <textarea
          className="fpr-input fad-request"
          data-testid="advisor-request"
          value={request}
          rows={3}
          maxLength={MAX_REQUEST}
          disabled={busy}
          placeholder={pick(lang, "e.g. My elbow is sore after curls", "например: После сгибаний болит локоть")}
          onChange={(e) => setRequest(e.target.value)}
        />
      </label>

      {showKeyField ? (
        <label className="fpr-field">
          <span className="fpr-stepper-label">{pick(lang, "OpenAI API key", "Ключ OpenAI")}</span>
          <input
            className="fpr-input"
            type="password"
            data-testid="advisor-key"
            value={keyDraft}
            autoComplete="off"
            spellCheck={false}
            placeholder={storedKey ? "••••" : "sk-…"}
            onChange={(e) => setKeyDraft(e.target.value)}
          />
          <span className="fit-muted fpr-small">
            {pick(
              lang,
              "The key stays in this browser (the same key as the trip planner). It is sent to OpenAI and nowhere else.",
              "Ключ остаётся в этом браузере (тот же, что у планировщика поездок). Он уходит в OpenAI и больше никуда.",
            )}
          </span>
        </label>
      ) : (
        <p className="fad-key fpr-small">
          {pick(lang, "Key saved in this browser.", "Ключ сохранён в этом браузере.")}{" "}
          <button type="button" className="fad-link" data-testid="advisor-key-change" onClick={() => setChangingKey(true)}>
            {pick(lang, "Change", "Сменить")}
          </button>{" "}
          <button type="button" className="fad-link" data-testid="advisor-key-remove" onClick={() => writeAiKey("")}>
            {pick(lang, "Remove", "Удалить")}
          </button>
        </p>
      )}

      <details className="fpr-details fad-model">
        <summary>
          {pick(lang, "Model and effort", "Модель и усилие")}: {model || DEFAULT_MODEL} · {effortLabel(lang, effort)}
        </summary>
        <label className="fpr-field">
          <span className="fpr-stepper-label">{pick(lang, "Model", "Модель")}</span>
          <input className="fpr-input" data-testid="advisor-model" value={model} autoComplete="off" spellCheck={false} onChange={(e) => setModelDraft(e.target.value)} />
        </label>
        <div className="fpr-field">
          <span className="fpr-stepper-label">{pick(lang, "Effort", "Усилие")}</span>
          <div className="fit-seg fpr-chips" role="group" aria-label={pick(lang, "Effort", "Усилие")} data-testid="advisor-effort" data-value={effort}>
            {EFFORTS.map(([id, en, ru]) => (
              <button key={id} type="button" aria-pressed={effort === id} data-value={id} onClick={() => writeEffort(id)}>
                {pick(lang, en, ru)}
              </button>
            ))}
          </div>
          <span className="fit-muted fpr-small">{pick(lang, "Higher effort thinks longer (up to a few minutes).", "Высокое усилие думает дольше (до нескольких минут).")}</span>
        </div>
      </details>

      {dirty ? <p className="fit-note">{pick(lang, "Save or discard your edits first: the coach works on the saved program.", "Сначала сохраните или отмените правки: тренер работает с сохранённой программой.")}</p> : null}

      <button type="button" className="fit-button fad-ask" data-testid="advisor-ask" disabled={busy || dirty || !request.trim()} onClick={ask}>
        {busy ? pick(lang, "Thinking…", "Думаю…") : pick(lang, "Ask the coach", "Спросить тренера")}
      </button>
      {busy ? (
        <p className="fit-muted fpr-small" role="status">
          {pick(lang, "This usually takes under a minute; high effort can take several.", "Обычно это меньше минуты; на высоком усилии — несколько минут.")}
        </p>
      ) : null}
      {error ? (
        <p className="fit-note warn" role="alert" data-testid="advisor-error">
          {error}
        </p>
      ) : null}

      {done ? (
        <div className="fit-note editing" role="status" data-testid="advisor-done" data-applied={done.applied}>
          <p>
            {done.applied
              ? pick(lang, `Applied ${done.applied} ${done.applied === 1 ? "change" : "changes"}. Your next session uses them.`, `Применено: ${done.applied} ${pluralRu(done.applied, ["изменение", "изменения", "изменений"])}. Следующая тренировка учтёт их.`)
              : pick(lang, "Nothing to change in the program.", "В программе ничего не меняется.")}
          </p>
          {done.skipped.length ? (
            <ul className="fpr-small">
              {done.skipped.map((s, i) => (
                <li key={i}>
                  {describeChange(s.change, program, states, lang)} — {t2(lang, s.reason)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {pending ? (
        <div className="fad-proposal" data-testid="advisor-proposal">
          {t2(lang, pending.proposal.summary) ? <p className="fad-summary">{t2(lang, pending.proposal.summary)}</p> : null}
          {pending.proposal.changes.length ? (
            <ol className="fad-changes">
              {pending.proposal.changes.map((c, i) => (
                <li key={i} data-testid="advisor-change" data-type={c.type}>
                  <strong className="fad-line">{t2(lang, pending.lines[i])}</strong>
                  {c.type !== "note" && t2(lang, c.reason) ? <span className="fad-reason">{t2(lang, c.reason)}</span> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="fit-muted">{pick(lang, "No changes suggested.", "Изменений не предложено.")}</p>
          )}
          {pending.proposal.cautions.length ? (
            <div className="fit-note warn fad-cautions">
              <strong>{pick(lang, "Be careful", "Осторожно")}</strong>
              <ul>
                {pending.proposal.cautions.map((c, i) => (
                  <li key={i}>{t2(lang, c)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {pending.proposal.dropped.length ? (
            <details className="fpr-details">
              <summary>
                {pick(
                  lang,
                  `${pending.proposal.dropped.length} ${pending.proposal.dropped.length === 1 ? "suggestion" : "suggestions"} left out`,
                  `Отброшено: ${pending.proposal.dropped.length} ${pluralRu(pending.proposal.dropped.length, ["предложение", "предложения", "предложений"])}`,
                )}
              </summary>
              <ul className="fpr-small">
                {pending.proposal.dropped.map((d, i) => (
                  <li key={i}>
                    {describeChange(d.change, program, states, lang)} — {t2(lang, d.reason)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="fad-actions">
            <button type="button" className="fit-button ghost" data-testid="advisor-dismiss" onClick={dismiss}>
              {pick(lang, "Dismiss", "Отклонить")}
            </button>
            <button type="button" className="fit-button" data-testid="advisor-apply" disabled={!canWrite || dirty} onClick={apply}>
              {pending.proposal.changes.some((c) => c.type !== "note") ? pick(lang, "Apply", "Применить") : pick(lang, "Got it", "Понятно")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** One line for a stored plan change: the advisor's summary or the first diff lines of a manual save. */
function changeText(a: Adjustment, lang: Lang): string {
  const out = a.output as { summary?: unknown; lines?: unknown };
  const summary = out.summary as Text2 | undefined;
  if (summary && typeof summary === "object" && (summary.en || summary.ru)) return t2(lang, summary);
  if (Array.isArray(out.lines)) {
    const lines = (out.lines as Text2[]).filter((l) => l && typeof l === "object").map((l) => t2(lang, l));
    return lines.length > 3 ? `${lines.slice(0, 3).join("; ")} … (+${lines.length - 3})` : lines.join("; ");
  }
  return "";
}

export function PlanHistory({ lang, adjustments }: { lang: Lang; adjustments: Record<string, Adjustment> }) {
  const rows = Object.values(adjustments)
    .filter((a) => a && typeof a.at === "string")
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);
  if (!rows.length) return null;
  const source = (a: Adjustment) =>
    a.source === "ai" ? pick(lang, "AI coach", "ИИ-тренер") : a.source === "manual" ? pick(lang, "Edit", "Правка") : pick(lang, "Engine", "Движок");
  return (
    <section className="fit-card fpr-section fad-history" aria-labelledby="fad-history-h" data-testid="plan-history">
      <h2 id="fad-history-h">{pick(lang, "Plan changes", "Изменения плана")}</h2>
      <ul>
        {rows.map((a) => (
          <li key={a.id} data-testid="plan-change" data-source={a.source} data-applied={a.applied}>
            <span className="fad-history-meta fpr-small">
              <time dateTime={a.at}>{fmtDate(a.at, lang)}</time> · {source(a)}
              {a.applied ? "" : ` · ${pick(lang, "dismissed", "отклонено")}`}
            </span>
            <span className="fpr-small">{changeText(a, lang)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
