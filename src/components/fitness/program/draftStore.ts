/**
 * The unsaved program draft of this tab (sessionStorage). The program page links out of an open slot editor (the
 * exercise page) and to Train; without this, following a link and coming back, or a reload, discarded every edit.
 * One draft per tab, tied to the account that made it and to the saved program it started from: it comes back only
 * for that account while that program is still the saved one. Every storage access is wrapped (private windows).
 */
import type { Program } from "@/lib/fitness/types";

const KEY = "ilyadays-fitness:program-draft";
type Stored = { v: 1; account: string; baseId: string; baseUpdatedAt: string; program: Program };

function read(): Stored | null {
  try {
    const v: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
    if (typeof v !== "object" || v === null) return null;
    const s = v as Partial<Stored>;
    const p = s.program as Partial<Program> | undefined;
    const ok = s.v === 1 && typeof s.account === "string" && typeof s.baseId === "string" && typeof s.baseUpdatedAt === "string"
      && typeof p === "object" && p !== null && typeof p.id === "string" && Array.isArray(p.days) && p.days.every((d) => Array.isArray(d?.slots));
    return ok ? (s as Stored) : null;
  } catch {
    return null;
  }
}

/** The draft `account` left on `base`, or null (none, another account's, or the saved program has changed since). */
export function readProgramDraft(account: string, base: Program): Program | null {
  const s = read();
  return s && s.account === account && s.baseId === base.id && s.baseUpdatedAt === base.updatedAt ? s.program : null;
}

export function writeProgramDraft(account: string, base: Program, program: Program) {
  try {
    const value: Stored = { v: 1, account, baseId: base.id, baseUpdatedAt: base.updatedAt, program };
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // blocked or full: the draft lives in memory for this page, as before
  }
}

export function clearProgramDraft() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing was stored
  }
}
