"use client";
/**
 * Fitness data context (stream 01 — plans/fitness/01-database-and-sync.md). One local-first store per browser tab
 * (src/lib/fitness/store.ts), attached to the signed-in account: `local` without Supabase, `synced` for the owner (or
 * an enabled friend), `viewer` for everyone else, `loading` while auth settles. Components read `useFitness()`.
 * Keep this exported API stable: <FitnessProvider> (inside <AuthProvider>), useFitness(), FitnessContextValue.
 *
 * Both providers are mounted once per language by the fitness layouts (src/app/(en)/fitness/layout.tsx and the RU
 * twin), so navigating between fitness pages keeps auth and the store attached. Page content sits inside
 * <AccountBoundary> (Shell.tsx): unsaved form state (a program draft, a typed body weight, an open editor) is dropped
 * when the signed-in account changes, and only then — not while the sign-in is still settling.
 */
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/site/AuthProvider";
import { EMPTY_SNAPSHOT } from "@/lib/fitness/empty";
import { INITIAL_STATUS, createFitnessStore, displayNameOf, type SyncedFitnessStore } from "@/lib/fitness/store";
import { getSupabase, isSupabaseConfigured, supabaseProject } from "@/lib/supabase";
import type { FitnessStore, Snapshot, StoreMode } from "@/lib/fitness/types";

export type FitnessContextValue = {
  snapshot: Snapshot;
  store: FitnessStore;
  mode: StoreMode;
  /** Local mode or the signed-in owner (or an enabled friend) */
  canWrite: boolean;
  auth: ReturnType<typeof useAuth>;
  /** Connectivity as the store last saw it (browser events and request outcomes) */
  online: boolean;
  /** Changes waiting to upload (synced mode) */
  pending: number;
  /** Last sync or storage problem as "kind: detail", null when all is well */
  lastError: string | null;
  /** Admin bootstrap: create the signed-in admin's fitness profile (owner when there is none), then re-check access */
  ensureProfile: () => Promise<void>;
  /** Goes up by one each time the signed-in account changes after the first settled sign-in state (see AccountBoundary) */
  accountEpoch: number;
};

/** The server render (and any store-less context) gets a read-only, empty store. */
const noopStore: FitnessStore = {
  getSnapshot: () => EMPTY_SNAPSHOT,
  subscribe: () => () => {},
  upsert: () => {},
  remove: () => {},
  refresh: async () => {},
  flush: async () => {},
  mode: () => "loading",
  canWrite: () => false,
};

let tabStore: SyncedFitnessStore | null = null;

/** One store per tab, shared by every fitness page: client-side navigation keeps the snapshot and does not re-pull. */
function browserStore(): SyncedFitnessStore | null {
  if (typeof window === "undefined") return null;
  tabStore ??= createFitnessStore({ getSupabase, configured: isSupabaseConfigured, project: supabaseProject });
  return tabStore;
}

const noSubscribe = () => () => {};
const emptySnapshot = () => EMPTY_SNAPSHOT;
const initialStatus = () => INITIAL_STATUS;

const FitnessContext = createContext<FitnessContextValue | null>(null);

export function useFitness(): FitnessContextValue {
  const value = useContext(FitnessContext);
  if (!value) throw new Error("useFitness must be used inside <FitnessProvider>");
  return value;
}

export function FitnessProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const store = browserStore();
  const snapshot = useSyncExternalStore(store ? store.subscribe : noSubscribe, store ? store.getSnapshot : emptySnapshot, emptySnapshot);
  const status = useSyncExternalStore(store ? store.subscribe : noSubscribe, store ? store.getStatus : initialStatus, initialStatus);
  const { user, isAdmin, loading } = auth;

  useEffect(() => store?.start(), [store]);

  useEffect(() => {
    store?.attach({ user, isAdmin, loading });
  }, [store, user, isAdmin, loading]);

  // Who is signed in, once auth has settled (undefined until then). The first settled answer is not a change; every
  // later one is: sign-out, or another account signing in. State derived during render (no effect, no extra paint).
  const identity = loading ? undefined : (user?.id ?? null);
  const [account, setAccount] = useState<{ id: string | null | undefined; epoch: number }>({ id: undefined, epoch: 0 });
  if (identity !== undefined && identity !== account.id) {
    setAccount({ id: identity, epoch: account.id === undefined ? account.epoch : account.epoch + 1 });
  }

  // A writable copy always has settings, and a session left open for 6 h is closed — on mount, on tab focus, and once
  // a minute while a session is open (the gym screen holds a wake lock, so the tab may never lose and regain focus).
  const writable = status.mode === "local" || status.mode === "synced";
  const sessionOpen = useMemo(() => Object.values(snapshot.sessions).some((s) => s.status === "active"), [snapshot.sessions]);
  useEffect(() => {
    if (!store || !writable) return;
    const tidy = () => {
      store.bootstrapSettings();
      store.closeStaleSessions();
    };
    tidy();
    const onVisibility = () => {
      if (document.visibilityState === "visible") tidy();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const tick = sessionOpen ? window.setInterval(() => store.closeStaleSessions(), 60_000) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(tick);
    };
  }, [store, writable, sessionOpen]);

  const ensureProfile = useCallback(async () => {
    if (store) await store.ensureProfile(displayNameOf(user));
  }, [store, user]);

  const mismatch = !loading && status.mode === "synced" && status.userId !== (user?.id ?? null) && !(status.awaitingSession && !user);
  const value = useMemo<FitnessContextValue>(
    () => ({
      snapshot: mismatch ? EMPTY_SNAPSHOT : snapshot,
      store: store ?? noopStore,
      mode: mismatch ? "loading" : status.mode,
      canWrite: !mismatch && (status.mode === "local" || status.mode === "synced"),
      auth,
      online: status.online,
      pending: snapshot.pending,
      lastError: status.lastError,
      ensureProfile,
      accountEpoch: account.epoch,
    }),
    [mismatch, snapshot, store, status.mode, status.online, status.lastError, auth, ensureProfile, account.epoch],
  );
  return <FitnessContext.Provider value={value}>{children}</FitnessContext.Provider>;
}

/**
 * Remounts its children when the signed-in account changes (sign-out, another account), so no component keeps the
 * previous account's unsaved input. Stable while the first sign-in state loads and across page navigation.
 */
export function AccountBoundary({ children }: { children: React.ReactNode }) {
  const { accountEpoch } = useFitness();
  return <Fragment key={accountEpoch}>{children}</Fragment>;
}
