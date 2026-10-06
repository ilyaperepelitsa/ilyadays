"use client";
// Mounts the Istanbul trip app (public/apps/istanbul, copied from ../istanbul_trip/dist by sync-content.sh).
// Everyone sees the owner's progress from Supabase; only the admin (rpc is_admin) gets editable mode.
import { useEffect, useRef, useState } from "react";
import type { Lang as TripLang, TripHandle } from "@/types/istanbul";
import { type Lang, localPath } from "@/lib/i18n";
import { tripStorage } from "@/lib/tripStorage";
import { useAuth } from "@/components/site/AuthProvider";

const APP_JS = "/apps/istanbul/app.js";
const APP_CSS = "/apps/istanbul/app.css";
const FONTS =
  "https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=IBM+Plex+Mono:wght@500;600&family=Marcellus&display=swap";

type Text = { loading: string; failed: string; readOnlySignedIn: string; editing: string };
type TripModule = { mount: (el: HTMLElement, options: object) => TripHandle };

export function IstanbulApp({ lang, text }: { lang: Lang; text: Text }) {
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
        const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ APP_JS)) as TripModule;
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
      <link rel="stylesheet" href={APP_CSS} precedence="default" />
      <link rel="stylesheet" href={FONTS} precedence="default" />
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
