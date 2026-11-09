"use client";
// Browser-only Supabase client for this site's project. The session lives in localStorage — no cookies, no
// @supabase/ssr, no middleware. Created lazily so statically generated pages never touch it at build time.
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Scope both auth and cached progress to the configured project during a backend cutover.
export const supabaseProject = url ? new URL(url).hostname : "unconfigured";

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: Promise<SupabaseClient | null> | null = null;

/** The client, loaded on first use. The library is about 70 KB compressed, and the shared header imports the sign-in
 *  button on every page, so a static import put it on recipe pages that never sign in or read trip progress. */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured || typeof window === "undefined") return Promise.resolve(null);
  client ??= import("@supabase/supabase-js")
    .then(({ createClient }) =>
      createClient(url!, anonKey!, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: `ilyadays-auth:${supabaseProject}`,
          flowType: "pkce",
        },
      }),
    )
    .catch(() => {
      client = null; // offline before the library was ever cached: try again next time
      return null;
    });
  return client;
}
