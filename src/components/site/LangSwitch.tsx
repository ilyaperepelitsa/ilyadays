"use client";
import { LANG_KEY, type Lang, localPath } from "@/lib/i18n";

/** EN · RU. Remembers the choice in localStorage (the head script reads it on every page); never a cookie. */
export function LangSwitch({ lang, path, label }: { lang: Lang; path: string; label: string }) {
  const remember = (to: Lang) => {
    try {
      localStorage.setItem(LANG_KEY, to);
    } catch {
      /* storage blocked: the link still works for this page */
    }
  };
  return (
    <nav className="lang" aria-label={label}>
      {(["en", "ru"] as const).map((l, i) => (
        <span key={l} style={{ display: "contents" }}>
          {i > 0 && <span className="sep" aria-hidden="true">·</span>}
          {l === lang ? (
            <span className="on" aria-current="true">{l.toUpperCase()}</span>
          ) : (
            <a href={localPath(l, path)} hrefLang={l} lang={l} onClick={() => remember(l)}>
              {l.toUpperCase()}
            </a>
          )}
        </span>
      ))}
    </nav>
  );
}
