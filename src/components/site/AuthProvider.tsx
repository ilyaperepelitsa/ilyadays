"use client";
// Google sign-in through Supabase (the same project as TypeKana). Whether the signed-in user may edit is decided
// by the database — `rpc('is_admin')` — and fails closed: any error, or no session, means read-only.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Auth = {
  user: User | null;
  isAdmin: boolean;
  /** True until the session and the admin check have settled. */
  loading: boolean;
  configured: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth>({
  user: null,
  isAdmin: false,
  loading: true,
  configured: isSupabaseConfigured,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const latest = useRef(0);

  useEffect(() => {
    const db = getSupabase();
    if (!db) return;

    const resolve = async (next: User | null) => {
      const request = ++latest.current;
      setUser(next);
      if (!next) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      let admin = false;
      try {
        const { data, error } = await db.rpc("is_admin");
        admin = !error && data === true;
      } catch {
        admin = false;
      }
      if (request !== latest.current) return; // a newer auth event owns the state
      setIsAdmin(admin);
      setLoading(false);
    };

    // Back from Google: supabase-js exchanges ?code= for a session (PKCE); drop the code from the address bar.
    const cleanUrl = () => {
      const u = new URL(window.location.href);
      if (!u.searchParams.has("code") && !u.searchParams.has("error_description")) return;
      ["code", "error", "error_code", "error_description", "state"].forEach((k) => u.searchParams.delete(k));
      window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
    };

    db.auth.getSession().then(({ data }) => {
      cleanUrl();
      void resolve(data.session?.user ?? null);
    });
    const { data } = db.auth.onAuthStateChange((event, session) => {
      // Token refreshes don't change who's signed in; skip the extra admin round-trip.
      if (event === "TOKEN_REFRESHED") return;
      // Supabase warns against awaiting other calls inside this callback; defer.
      setTimeout(() => void resolve(session?.user ?? null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    const db = getSupabase();
    if (!db) return;
    const back = new URL(window.location.href);
    back.hash = "";
    await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back.toString() } });
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, isAdmin, loading, configured: isSupabaseConfigured, signIn, signOut }),
    [user, isAdmin, loading, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
