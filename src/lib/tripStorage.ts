"use client";
// The Istanbul app's storage adapter: the owner's progress lives in Supabase `public.trip_state`, one row per
// (trip, key). Everyone can read it; Row Level Security lets only `public.is_admin()` write it.
import type { TripData, TripKey, TripStorage } from "@/types/istanbul";
import { getSupabase } from "./supabase";

/** `isEditing` silences live updates while this tab is the one writing, so its own echoes can't overwrite newer
 *  local edits. */
export function tripStorage(trip: string, isEditing: () => boolean = () => false): TripStorage {
  return {
    async load() {
      const db = getSupabase();
      if (!db) return {};
      const { data, error } = await db.from("trip_state").select("key, value").eq("trip", trip);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.key, row.value])) as Partial<TripData>;
    },
    async save<K extends TripKey>(key: K, value: TripData[K]) {
      const db = getSupabase();
      if (!db) throw new Error("Supabase is not configured");
      const { error } = await db.from("trip_state").upsert({ trip, key, value }, { onConflict: "trip,key" });
      if (error) throw error;
    },
    // Live updates for viewers while the owner ticks stops (needs trip_state in the supabase_realtime publication).
    subscribe(onData) {
      const db = getSupabase();
      if (!db) return;
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
      return () => void db.removeChannel(channel);
    },
  };
}
