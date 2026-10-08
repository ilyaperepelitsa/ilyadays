"use client";

import { useState, useSyncExternalStore } from "react";
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
  subscribePrefs,
  suggestThemes,
  writeAiKey,
  writeEffort,
  writeModel,
  type Theme,
  type TripBrief,
} from "@/lib/trips";
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

export function TripComposer({ lang }: { lang: Lang }) {
  const copy = strings(lang);
  const router = useRouter();
  const [brief, setBrief] = useState<TripBrief>(DEFAULT_BRIEF);
  const [themes, setThemes] = useState<Theme[]>(() => Array.from({ length: DEFAULT_BRIEF.routes }, blankTheme));
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
      setError(message(copy, err));
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
      const ready = themes.slice(0, parsed.routes).map((theme) => completeTheme(theme));
      const secret = apiKey();
      const trip = await buildTrip({
        brief: parsed,
        themes: ready,
        client: client(secret),
        enrich: enrichStop,
        id: crypto.randomUUID(),
        created: new Date().toISOString(),
        pauseMs: 250,
        onProgress: (event) => setStatus(copy[STAGES[event.stage] ?? "tripStageRoutes"]),
      });
      saveTrip(trip);
      router.push(localPath(lang, `/travel/made/${trip.id}`));
    } catch (err) {
      setError(message(copy, err));
      setStatus("");
      setBusy(false);
    }
  }

  return (
    <div className="trip-builder">
      <BriefFields brief={brief} copy={copy} onChange={onBrief} />
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
        <button type="button" className="button ghost" disabled={busy} onClick={onSuggest}>{copy.tripSuggest}</button>
        <button type="button" className="button" disabled={busy} onClick={onGenerate}>{copy.tripGenerate}</button>
      </div>
      {status ? <p className="trip-status" role="status">{status}</p> : null}
      {error ? <p className="trip-error" role="alert">{error}</p> : null}
    </div>
  );
}
