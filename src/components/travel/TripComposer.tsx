"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { type Lang, localPath, strings } from "@/lib/i18n";
import {
  DEFAULT_BRIEF,
  TripShapeError,
  buildTrip,
  completeJson,
  completeTheme,
  enrichStop,
  parseBrief,
  readAiKey,
  tripErrorKey,
  readEffort,
  readModel,
  saveTrip,
  loadTrip,
  subscribePrefs,
  subscribeTrips,
  suggestThemes,
  writeAiKey,
  writeEffort,
  writeModel,
  type Theme,
  type TripBrief,
} from "@/lib/trips";
import { useAuth } from '@/components/site/AuthProvider';
import { getSupabase } from '@/lib/supabase';
import { eventSearchCall, validEvent, validateCommitments } from '@/lib/trips/events.mjs';
import type { SavedTrip, TripCommitment, TripEvent } from '@/lib/trips/types';
import { EventRecommendations, TripDates } from './TripEvents';
import { BriefFields, EffortPicker, ThemeFields, blankTheme } from "./TripFields";

const STAGES: Record<string, "tripStageThemes" | "tripStageRoutes" | "tripStageNotes" | "tripStagePictures"> = {
  themes: "tripStageThemes",
  routes: "tripStageRoutes",
  notes: "tripStageNotes",
  pictures: "tripStagePictures",
};

function message(copy: ReturnType<typeof strings>, error: unknown) {
  if (error instanceof TripShapeError) return copy[tripErrorKey(error.code)];
  if (error instanceof Error && error.message && error.message !== "empty") return error.message;
  return copy.tripErrGeneric;
}

const noRevision = () => null;
function readRevision() {
  const from = new URL(window.location.href).searchParams.get('from');
  return from ? loadTrip(from) : null;
}
export function TripComposer({ lang }: { lang: Lang }) {
  const revision = useSyncExternalStore(subscribeTrips, readRevision, noRevision);
  return <ComposerForm key={revision?.id ?? 'new'} lang={lang} initial={revision} />;
}

function ComposerForm({ lang, initial }: { lang: Lang; initial: SavedTrip | null }) {
  const copy = strings(lang);
  const router = useRouter();
  const auth = useAuth();
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [accepted, setAccepted] = useState<TripCommitment[]>(() => initial?.commitments ?? []);
  const [searched, setSearched] = useState(false);
  const revisionOf = initial?.id;
  const [unavailableSources, setUnavailableSources] = useState(0);
  const searchVersion = useRef(0);
  const say = (en: string, ru: string) => lang === 'ru' ? ru : en;
  const errorText = (err: unknown) => {
    const code = err instanceof TripShapeError ? err.code : '';
    if (code === 'timezone') return say('Choose a valid destination time zone, such as Europe/Lisbon, before finding events.', 'Для событий укажите корректный часовой пояс города, например Europe/Lisbon.');
    if (code === 'dates') return say('Choose valid arrival/departure dates (up to 90 days), with no more walking routes than stay days.', 'Укажите корректные даты приезда и отъезда (до 90 дней). Маршрутов не должно быть больше, чем дней поездки.');
    if (code === 'events') return say('Review the accepted events: their city, date, time and duration must fit this stay. Remove any event that no longer fits.', 'Проверьте принятые события: город, дата, время и длительность должны соответствовать поездке. Уберите события, которые больше не подходят.');
    if (code === 'event_conflict') return say('These events overlap or leave less than 30 minutes between venues. Remove one or change a flexible visit time.', 'События пересекаются или между ними меньше 30 минут. Уберите одно или измените свободное время визита.');
    if (code === 'event_budget') return say('The walking plan does not fit around your fixed events. Allow a longer day, fewer stops or fewer events, then generate again. Your accepted events are still kept.', 'Маршрут не помещается между закреплёнными событиями. Увеличьте день, уменьшите число остановок или событий и повторите. Принятые события сохранены.');
    if (code === 'storage') return say('The browser could not save this trip. Free some storage or allow local storage, then retry.', 'Браузер не смог сохранить поездку. Освободите место или разрешите локальное хранилище и повторите.');
    return message(copy, err);
  };
  const [brief, setBrief] = useState<TripBrief>(() => initial?.brief ?? DEFAULT_BRIEF);
  const [themes, setThemes] = useState<Theme[]>(() => initial?.routes.map((r) => r.theme) ?? Array.from({ length: DEFAULT_BRIEF.routes }, blankTheme));
  const [key, setKey] = useState("");
  const storedKey = useSyncExternalStore(subscribePrefs, readAiKey, () => "");
  const storedModel = useSyncExternalStore(subscribePrefs, readModel, () => "gpt-6.1-sol");
  const [modelDraft, setModelDraft] = useState<string | null>(null);
  const model = modelDraft ?? storedModel;
  const effort = useSyncExternalStore(subscribePrefs, readEffort, () => "medium");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const onBrief = (next: TripBrief) => {
    if (next.city !== brief.city || next.stayStart !== brief.stayStart || next.stayEnd !== brief.stayEnd || next.timeZone !== brief.timeZone) {
      searchVersion.current += 1; setEvents([]); setSearched(false); setUnavailableSources(0);
    }
    setBrief(next);
    setThemes((prev) => Array.from({ length: next.routes }, (_, i) => prev[i] ?? blankTheme()));
  };

  const apiKey = () => {
    const next = key.trim() || storedKey;
    if (!next) throw new TripShapeError("key");
    if (key.trim()) writeAiKey(key.trim());
    writeModel(model);
    writeEffort(effort);
    setKey("");
    return next;
  };

  const client = (secret: string) => (call: Parameters<typeof completeJson>[3]) => completeJson(secret, model.trim() || "gpt-6.1-sol", effort, call);

  async function onSuggest() {
    setError("");
    setBusy(true);
    setStatus(copy.tripStageThemes);
    try {
      const parsed = parseBrief(brief);
      const next = await suggestThemes(parsed, client(apiKey()));
      setThemes(next);
      setStatus("");
    } catch (err) {
      setError(errorText(err));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate() {
    setError("");
    setBusy(true);
    try {
      const parsed = parseBrief(brief);
      const commitments = validateCommitments(accepted, parsed);
      const ready = themes.slice(0, parsed.routes).map((theme) => completeTheme(theme));
      const secret = apiKey();
      const trip = await buildTrip({
        brief: parsed,
        commitments,
        revisionOf,
        themes: ready,
        client: client(secret),
        enrich: enrichStop,
        id: crypto.randomUUID(),
        created: new Date().toISOString(),
        pauseMs: 250,
        onProgress: (event) => {
          const stage = copy[STAGES[event.stage] ?? "tripStageRoutes"];
          setStatus(event.total > 1
            ? copy.tripStageStep.replace("{stage}", stage).replace("{done}", String(event.done + 1)).replace("{total}", String(event.total))
            : stage);
        },
      });
      if (!saveTrip(trip)) throw new TripShapeError("storage");
      router.push(localPath(lang, `/travel/made/${trip.id}`));
    } catch (err) {
      setError(errorText(err));
      setStatus("");
      setBusy(false);
    }
  }

  async function onFindEvents() {
    setError(''); setBusy(true);
    setStatus(say('Searching live listings and checking publisher dates…', 'Ищем события и проверяем даты на страницах организаторов…'));
    const version = ++searchVersion.current;
    try {
      const parsed = parseBrief(brief);
      const db = await getSupabase();
      const session = db ? (await db.auth.getSession()).data.session : null;
      if (!session) throw new Error(say('Sign in before checking event sources.', 'Войдите перед проверкой событий.'));
      const result = await completeJson(apiKey(), model.trim() || 'gpt-6.1-sol', effort, eventSearchCall(parsed)) as { urls: string[] };
      const response = await fetch('/api/trips/events/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ urls: result.urls, brief: parsed }), signal: AbortSignal.timeout(55000) });
      const verified = await response.json();
      if (!response.ok) throw new Error(verified.error || say('Could not check event sources.', 'Не удалось проверить события.'));
      if (!Array.isArray(verified.events) || !verified.events.every(validEvent)) throw new Error(say('Event verification returned invalid data. Try again later.', 'Проверка вернула неверные данные. Повторите позже.'));
      if (version === searchVersion.current) { setEvents(verified.events); setSearched(true); setUnavailableSources(Number(verified.unavailable) || 0); }
    } catch (err) {
      if (version === searchVersion.current) setError(errorText(err));
    } finally { setBusy(false); setStatus(''); }
  }

  return (
    <div className="trip-builder" data-testid="trip-composer">
      <fieldset disabled={busy} aria-label={say("Trip settings", "Параметры поездки")} style={{ display: "contents", border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {revisionOf ? <p className="trip-hint">{say("Rebuilding a saved trip. Fixed events stay selected. Changes are saved as a new trip.", "Перестраиваем сохранённую поездку. Закреплённые события остаются выбранными. Изменения сохранятся как новая поездка.")}</p> : null}
      <BriefFields brief={brief} copy={copy} onChange={onBrief} />
      <TripDates lang={lang} brief={brief} onChange={onBrief} />
      <EventRecommendations lang={lang} brief={brief} events={events} accepted={accepted} searched={searched} unavailableSources={unavailableSources} busy={busy} signedIn={Boolean(auth.user)} onSearch={() => void onFindEvents()} onSignIn={() => void auth.signIn()} onError={(err) => setError(errorText(err))} onChange={(next) => { try { if (next.length > accepted.length) validateCommitments(next, brief); setAccepted(next); setError(''); } catch (err) { setError(errorText(err)); } }} />
      <ThemeFields themes={themes} copy={copy} onChange={setThemes} />
      <details className="trip-panel trip-model">
        <summary>{copy.tripSettings}</summary>
        <label className="trip-field">
          <span>{copy.tripKey}</span>
          <input type="password" value={key} placeholder={storedKey ? "••••" : "sk-…"} autoComplete="off" onChange={(e) => setKey(e.target.value)} />
          <small>{copy.tripKeyHint}</small>
        </label>
        <label className="trip-field">
          <span>{copy.tripModel}</span>
          <input value={model} onChange={(e) => setModelDraft(e.target.value)} />
        </label>
        <EffortPicker value={effort} copy={copy} onChange={writeEffort} />
      </details>
      <div className="trip-actions">
        <button type="button" className="button ghost" data-testid="trip-suggest-themes" disabled={busy} onClick={onSuggest}>{copy.tripSuggest}</button>
        <button type="button" className="button" data-testid="trip-generate" disabled={busy} onClick={onGenerate}>{copy.tripGenerate}</button>
      </div>
      </fieldset>
      {status ? <p className="trip-status" role="status">{status}</p> : null}
      {error ? <p className="trip-error" role="alert" data-testid="trip-error">{error}</p> : null}
    </div>
  );
}
