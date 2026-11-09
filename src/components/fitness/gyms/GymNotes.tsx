/**
 * Notes for a gym (stream 05): free text, saved 0.8 s after typing stops, on blur, and when the editor closes.
 * Visitors see the text read-only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Gym, Lang } from "@/lib/fitness/types";
import { setNotes } from "@/lib/fitness/gyms-core.mjs";
import { type GymWrite, tr } from "./shared";

const SAVE_AFTER_MS = 800;

export function GymNotes({ lang, gym, canWrite, write }: { lang: Lang; gym: Gym; canWrite: boolean; write: GymWrite }) {
  const T = tr(lang);
  const [draft, setDraft] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const text = pending.current;
    if (text == null) return;
    pending.current = null;
    write((g, now) => setNotes(g, text, now));
  }, [write]);

  // flush a pending edit when the editor unmounts (another gym selected, page left)
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => () => saveRef.current(), []);

  if (!canWrite) {
    return gym.notes ? (
      <section className="fit-gym-block" aria-labelledby="fit-gym-notes">
        <h3 id="fit-gym-notes">{T("Notes", "Заметки")}</h3>
        <p className="fit-gym-notes-text">{gym.notes}</p>
      </section>
    ) : null;
  }

  return (
    <section className="fit-gym-block" aria-labelledby="fit-gym-notes">
      <h3 id="fit-gym-notes">{T("Notes", "Заметки")}</h3>
      <textarea
        className="fit-gym-notes"
        rows={3}
        maxLength={2000}
        value={draft ?? gym.notes ?? ""}
        placeholder={T("Opening hours, machines that are often busy, where the 2.5 kg add-on weights are…", "Часы работы, какие тренажёры часто заняты, где лежат довески по 2,5 кг…")}
        aria-labelledby="fit-gym-notes"
        data-testid="gym-notes"
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          pending.current = text;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(save, SAVE_AFTER_MS);
        }}
        onBlur={() => {
          save();
          setDraft(null);
        }}
      />
    </section>
  );
}
