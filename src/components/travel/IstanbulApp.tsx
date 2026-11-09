"use client";
// Mounts the Istanbul trip app (public/apps/istanbul, copied from ../istanbul_trip/dist by sync-content.sh).
// Everyone sees the owner's progress from Supabase; only the admin (rpc is_admin) gets editable mode.
import { useEffect, useRef, useState } from "react";
import { preconnect, preload, preloadModule } from "react-dom";
import type { Lang as TripLang, TripHandle } from "@/types/istanbul";
import { type Lang, localPath } from "@/lib/i18n";
import { tripStorage } from "@/lib/tripStorage";
import { useAuth } from "@/components/site/AuthProvider";

// Versioned by content (next.config.ts), so each file is downloaded once and then kept for a year: an app update
// re-downloads app.js (~115 KB compressed), not the map data (~400 KB).
const APP_JS = `/apps/istanbul/app.js?v=${process.env.NEXT_PUBLIC_ISTANBUL_JS_V}`;
const APP_CSS = `/apps/istanbul/app.css?v=${process.env.NEXT_PUBLIC_ISTANBUL_CSS_V}`;
/** The map graph (1.5 MB): app.js fetches this exact URL itself, so it survives app updates in the cache. */
const MAP_DATA = `/apps/istanbul/mapdata.json?v=${process.env.NEXT_PUBLIC_ISTANBUL_MAP_V}`;
const FONTS =
  "https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=IBM+Plex+Mono:wght@500;600&family=Marcellus&display=swap";

type Text = { loading: string; failed: string; readOnlySignedIn: string; editing: string };
type TripModule = { mount: (el: HTMLElement, options: object) => TripHandle };

/** Adds a stylesheet without holding back the page's first paint; settles once it applies or fails. */
function addStylesheet(href: string): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][href="${href}"]`);
  if (existing?.sheet) return Promise.resolve();
  const link = existing ?? Object.assign(document.createElement("link"), { rel: "stylesheet", href });
  const ready = new Promise<void>((resolve) => {
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => {
      link.remove(); // so the next visit asks again instead of waiting on a dead link
      resolve();
    }, { once: true });
  });
  if (!existing) document.head.append(link);
  return ready;
}

export function IstanbulApp({ lang, text }: { lang: Lang; text: Text }) {
  // Start the bundle, its stylesheet and the font hosts with the page's own HTML, not after hydration runs the
  // effect below. Neither stylesheet blocks the first paint: the app draws nothing until it mounts anyway.
  preloadModule(APP_JS);
  preload(APP_CSS, { as: "style" });
  preload(MAP_DATA, { as: "fetch", crossOrigin: "anonymous", fetchPriority: "low" }); // after the page's own CSS
  preconnect("https://fonts.googleapis.com");
  preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });
  const mountRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const handleRef = useRef<TripHandle | null>(null);
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);
  const auth = useAuth();
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  });
  const editable = !auth.loading && auth.isAdmin;
  const editableRef = useRef(editable);
  useEffect(() => {
    editableRef.current = editable;
  }, [editable]);

  // Load the module once and mount it read-only; editing is switched on below once the admin check passes.
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      try {
        void addStylesheet(FONTS); // display=swap: the app's fallback fonts until these arrive
        const [mod] = await Promise.all([
          import(/* webpackIgnore: true */ /* turbopackIgnore: true */ APP_JS) as Promise<TripModule>,
          addStylesheet(APP_CSS),
        ]);
        if (cancelled) return;
        handleRef.current = mod.mount(el, {
          lang: lang as TripLang,
          storage: tripStorage("istanbul", () => editableRef.current),
          editable: false,
          onLangChange: (to: TripLang) => {
            if (to !== lang) window.location.assign(localPath(to, "/travel/istanbul"));
          },
          onSignIn: () => {
            if (!authRef.current.user) void authRef.current.signIn();
          },
        });
        setMounted(true);
      } catch (e) {
        console.error("Istanbul app failed to load", e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [lang]);

  useEffect(() => {
    const h = handleRef.current;
    if (!mounted || !h) return;
    h.setEditable(editable);
    if (editable) void h.reload();
  }, [mounted, editable]);

  // Give the map the rest of the screen below the sticky header and the note.
  useEffect(() => {
    const fit = () => {
      const header = document.querySelector<HTMLElement>(".site-header");
      const el = mountRef.current;
      if (!el) return;
      el.style.setProperty("--header-h", `${header?.offsetHeight ?? 57}px`);
      el.style.setProperty("--note-h", `${noteRef.current?.offsetHeight ?? 0}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [auth.loading, auth.user, editable]);

  // Anonymous visitors get the app's own read-only note (with its Sign in button, wired to onSignIn) and the
  // top bar's; once signed in, say whether this account can edit.
  const note = !auth.user ? null : editable ? text.editing : text.readOnlySignedIn.replace("{email}", auth.user.email ?? "");

  return (
    <>
      {note && (
        <p ref={noteRef} className={`trip-note${editable ? " editing" : ""}`} aria-live="polite">
          {note}
        </p>
      )}
      {failed ? (
        <p className="trip-status">{text.failed}</p>
      ) : (
        <div ref={mountRef} className="trip-mount" data-loading={text.loading} />
      )}
    </>
  );
}
