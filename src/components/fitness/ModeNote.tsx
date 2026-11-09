"use client";
/**
 * One line at the top of fitness pages saying where data goes (stream 01 — plans/fitness/01-database-and-sync.md):
 * this browser only, the owner's account (with what is still waiting to upload), or read-only for visitors. The site
 * admin gets a "Create my fitness profile" button while the store cannot write for them yet.
 */
import Link from "next/link";
import { localPath } from "@/lib/i18n";
import { useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { isSyncedStore, type LocalReason, type StoreStatus } from "@/lib/fitness/store";
import { useFitness } from "./Provider";
import { ActionIcon } from "../site/ActionIcon";

const noSubscribe = () => () => {};
const noStatus = () => null;

/** The browser store's sync status (null during the server render). */
export function useStoreStatus(): StoreStatus | null {
  const { store } = useFitness();
  const synced = isSyncedStore(store) ? store : null;
  return useSyncExternalStore(synced ? synced.subscribe : noSubscribe, synced ? synced.getStatus : noStatus, noStatus);
}

/** `lastError` is "kind: detail"; the kind picks the sentence, the detail goes into the tooltip. */
function problemText(lang: Lang, lastError: string): string {
  switch (lastError.slice(0, lastError.indexOf(":"))) {
    case "offline":
      return pick(lang, "No connection: changes are kept here and upload later.", "Нет связи: изменения сохранены здесь и отправятся позже.");
    case "permission":
      return pick(lang, "The database refused the change (permissions). It is kept in this browser.", "База данных не приняла изменение (нет прав). Оно сохранено в этом браузере.");
    case "schema":
      return pick(lang, "The fitness tables are missing in Supabase: run the fitness migration.", "В Supabase нет таблиц фитнеса: выполните миграцию.");
    case "auth":
      return pick(lang, "The sign-in has expired: sign in again to upload.", "Сессия истекла: войдите снова, чтобы отправить изменения.");
    case "profile":
      return pick(lang, "This account has no fitness profile yet.", "У этого аккаунта ещё нет фитнес-профиля.");
    case "rejected":
      return pick(lang, "Some changes were refused by the database and stay in this browser only.", "Часть изменений база данных не приняла: они остались только в этом браузере.");
    case "storage":
      return pick(lang, "This browser refused to save (storage full or blocked).", "Браузер не смог сохранить данные (хранилище заполнено или запрещено).");
    case "invalid":
      return pick(lang, "A change was not saved: the data was invalid.", "Изменение не сохранено: неверные данные.");
    default:
      return pick(lang, "Sync problem: retrying.", "Проблема синхронизации: повторяем попытку.");
  }
}

/** Local mode: why nothing leaves this browser. */
function localText(lang: Lang, reason: LocalReason | null | undefined, signedIn: boolean): string {
  switch (reason) {
    case "backend-missing":
      return pick(lang, "Saved in this browser only: the fitness database is not set up yet.", "Сохраняется только в этом браузере: база данных фитнеса ещё не настроена.");
    case "checking":
      return pick(lang, "Saved in this browser for now: checking your account…", "Пока сохраняется в этом браузере: проверяем аккаунт…");
    case "offline":
      return signedIn
        ? pick(lang, "Saved in this browser only for now: no connection to check your account.", "Пока сохраняется только в этом браузере: нет связи, чтобы проверить аккаунт.")
        : pick(lang, "Saved in this browser only for now: no connection.", "Пока сохраняется только в этом браузере: нет связи.");
    case "signed-out":
      return pick(lang, "Saved in this browser only. Sign in to upload it to your account.", "Сохраняется только в этом браузере. Войдите, чтобы загрузить в аккаунт.");
    default:
      return pick(lang, "Saved in this browser only. Sign in on the live site to sync.", "Сохраняется только в этом браузере. Чтобы синхронизировать, войдите на основном сайте.");
  }
}

export function ModeNote({ lang, current }: { lang: Lang; current?: string }) {
  const { mode, pending, online, lastError, auth, ensureProfile } = useFitness();
  const status = useStoreStatus();
  const [busy, setBusy] = useState(false);
  // While the sign-in loads, a writer's phone already logs (store: provisional); the note waits for auth to say which.
  if (mode === "loading" || (mode === "synced" && status?.provisional)) return null;
  // These pages already explain personal setup; avoid stacking a second signup panel above the main action.
  if (mode === "viewer" && (current === "/fitness/profile" || (current === "/fitness" && !status?.ownerId))) return null;

  const offlineBadge = online ? null : <span className="fit-mode-badge off">{pick(lang, "offline", "нет сети")}</span>;
  const problem =
    lastError && !lastError.startsWith("offline") ? (
      <span className="fit-mode-problem" role="status" title={lastError}>
        {problemText(lang, lastError)}
      </span>
    ) : null;
  const canCreate = auth.isAdmin && (mode === "viewer" || (mode === "synced" && status?.profile === "missing"));
  const createProfile = async () => {
    setBusy(true);
    try {
      await ensureProfile();
    } finally {
      setBusy(false);
    }
  };
  const createButton = canCreate ? (
    <button type="button" className="fit-button quiet" onClick={() => void createProfile()} disabled={busy}>
      {busy ? pick(lang, "Creating…", "Создаём…") : pick(lang, "Create my fitness profile", "Создать мой фитнес-профиль")}
    </button>
  ) : null;

  if (mode === "local") {
    const reason = status?.localReason;
    const text = localText(lang, reason, Boolean(auth.user));
    const localProblem = reason === "backend-missing" ? null : problem;
    return (
      <div className={`fit-note fit-mode${localProblem ? " warn" : ""}`} data-testid="mode-note" data-mode="local" data-reason={reason ?? ""}>
        <span className="fit-mode-text">{text}</span>
        {localProblem}
        {reason === "signed-out" && auth.configured ? (
          <button type="button" className="fit-button quiet" onClick={() => void auth.signIn()}>
            {pick(lang, "Sign in", "Войти")}
          </button>
        ) : null}
      </div>
    );
  }

  if (mode === "viewer") {
    if (current === "/fitness/exercises" && !auth.isAdmin) return (
      <div className="fit-mode fit-catalog-mode" data-testid="mode-note" data-mode="viewer">
        <span>{pick(lang, "Explore the exercise library", "Изучайте каталог упражнений")}</span>
        {offlineBadge}
        <Link prefetch={false} href={localPath(lang, "/fitness/profile")}>{pick(lang, "Build your plan", "Создать программу")}<ActionIcon name="arrow" /></Link>
      </div>
    );
    return (
      <div className={`fit-note fit-mode${problem && auth.isAdmin ? " warn" : ""}`} data-testid="mode-note" data-mode="viewer">
        <span className="fit-mode-text">
          {status?.ownerId
            ? pick(lang, "You are viewing the public plan and log. Create your own profile to train here.", "Вы смотрите публичные программу и журнал. Создайте свой профиль для тренировок.")
            : pick(lang, "Create a private profile to build your plan and record your progress.", "Создайте приватный профиль для своей программы и записей о прогрессе.")}
        </span>
        {offlineBadge}
        {auth.isAdmin ? problem : null}
        {createButton}
        {!auth.isAdmin ? <Link prefetch={false} className="fit-button quiet" href={localPath(lang, "/fitness/profile")}>{pick(lang, "Create my private profile", "Создать приватный профиль")}</Link> : null}
      </div>
    );
  }

  // Writing on the session stored on this device while the site reports signed out (expired token, no signal).
  const awaiting = status?.awaitingSession === true;
  return (
    <div className={`fit-note fit-mode ${problem ? "warn" : "editing"}`} data-testid="mode-note" data-mode="synced" data-pending={pending}>
      <span className="fit-mode-text">
        {awaiting
          ? pick(lang, "Editing offline — changes wait in this browser and upload when the connection is back.", "Редактирование без сети — изменения ждут в этом браузере и отправятся, когда появится связь.")
          : pick(lang, "Editing — saved to your account", "Редактирование — сохраняется в вашем аккаунте")}
      </span>
      <span className="fit-mode-meta">
        {pending > 0 ? (
          <span className="fit-mode-badge fit-num" title={pick(lang, "Changes waiting to upload", "Изменения ждут отправки")}>
            {pick(lang, `${pending} to upload`, `к отправке: ${pending}`)}
          </span>
        ) : null}
        {offlineBadge}
      </span>
      {problem}
      {createButton}
    </div>
  );
}
