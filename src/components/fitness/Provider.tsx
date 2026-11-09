"use client";
/**
 * Fitness data context (stream 01 — plans/fitness/01-database-and-sync.md). One local-first store per browser tab
 * (src/lib/fitness/store.ts), attached to the signed-in account: `local` without Supabase, `synced` for the owner (or
 * an enabled friend), `viewer` for everyone else, `loading` while auth settles. Components read `useFitness()`.
 * Keep this exported API stable: <FitnessProvider> (inside <AuthProvider>), useFitness(), FitnessContextValue.
 */
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
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

  // A writable copy always has settings, and a session left open for 6 h is closed — on mount and on tab focus.
  const writable = status.mode === "local" || status.mode === "synced";
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
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [store, writable]);

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
    }),
    [mismatch, snapshot, store, status.mode, status.online, status.lastError, auth, ensureProfile],
  );
  return <FitnessContext.Provider value={value}><Fragment key={user?.id ?? "anonymous"}>{children}</Fragment></FitnessContext.Provider>;
}
