"use client";
// The Istanbul app's storage adapter: the owner's progress lives in Supabase `public.trip_state`, one row per
// (trip, key). Everyone can read it; Row Level Security lets only `public.is_admin()` write it.
import type { TripData, TripKey, TripStorage } from "@/types/istanbul";
import { getSupabase, isSupabaseConfigured, supabaseProject } from "./supabase";

/** How long the map waits for Supabase before showing the progress this browser saw last (roaming, no signal). */
const REMOTE_WAIT_MS = 2500;
/** With nothing saved locally the app has to wait, but not forever: an unanswered request must not hide the map. */
const REMOTE_GIVE_UP_MS = 10000;

type Snapshot = Partial<TripData>;

function readCopy(key: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

function writeCopy(key: string, data: Snapshot) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* A full or private-mode store only loses the offline copy. */
  }
}

const wait = <T,>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

/** `isEditing` silences live updates while this tab is the one writing, so its own echoes can't overwrite newer
 *  local edits. The last progress read from Supabase is kept in localStorage (`ilyadays-trip-<trip>`), so the plan
 *  opens at once offline or on a slow connection; the fresh copy follows through the live-update channel. */
export function tripStorage(trip: string, isEditing: () => boolean = () => false): TripStorage {
  const copyKey = `ilyadays-trip:${supabaseProject}:${trip}`;
  /** A Supabase answer that arrived after the local copy was already shown. */
  let late: Promise<Snapshot | null> | null = null;

  async function fetchRemote(): Promise<Snapshot> {
    const db = await getSupabase();
    if (!db) return {};
    const { data, error } = await db.from("trip_state").select("key, value").eq("trip", trip);
    if (error) throw error;
    const snapshot = Object.fromEntries((data ?? []).map((row) => [row.key, row.value])) as Snapshot;
    writeCopy(copyKey, snapshot);
    return snapshot;
  }

  return {
    async load() {
      if (!isSupabaseConfigured) return {};
      const copy = readCopy(copyKey);
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        // No connection: the last copy, or the plan as written (the app shows that progress could not be loaded).
        if (copy) return copy;
        throw new Error("offline");
      }
      const remote = fetchRemote();
      if (!copy) {
        return Promise.race([remote, wait(REMOTE_GIVE_UP_MS, null).then(() => Promise.reject(new Error("Supabase did not answer")))]);
      }
      const first = await Promise.race([remote.catch(() => null), wait(REMOTE_WAIT_MS, null)]);
      if (first) return first;
      late = remote.catch(() => null);
      return copy;
    },
    async save<K extends TripKey>(key: K, value: TripData[K]) {
      const db = await getSupabase();
      if (!db) throw new Error("Supabase is not configured");
      const { error } = await db.from("trip_state").upsert({ trip, key, value }, { onConflict: "trip,key" });
      if (error) throw error;
    },
    // Live updates for viewers while the owner ticks stops (needs trip_state in the supabase_realtime publication).
    subscribe(onData) {
      // The fresher copy that missed the first paint replaces the local one as soon as it lands.
      void late?.then((fresh) => {
        if (fresh && !isEditing()) onData(fresh);
      });
      late = null;
      let stopped = false;
      let remove = () => {};
      void getSupabase().then((db) => {
        if (!db || stopped) return;
        const channel = db
          .channel(`trip_state:${trip}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "trip_state", filter: `trip=eq.${trip}` },
            (payload) => {
              const row = payload.new as { key?: string; value?: unknown } | undefined;
              if (row?.key && !isEditing()) onData({ [row.key]: row.value } as Partial<TripData>);
            },
          )
          .subscribe();
        remove = () => void db.removeChannel(channel);
      });
      return () => {
        stopped = true;
        remove();
      };
    },
  };
}
