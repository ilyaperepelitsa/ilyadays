"use client";
// What a page shows instead of a blank screen when something throws while it renders in the browser.
import Link from "next/link";
import { useEffect } from "react";
import { type Lang, localPath, strings } from "@/lib/i18n";

export function ErrorView({ lang, error, reset }: { lang: Lang; error: Error & { digest?: string }; reset?: () => void }) {
  const t = strings(lang);
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main>
      <section className="missing" role="alert">
        <h1>{t.errorTitle}</h1>
        <p className="lede">{t.errorText}</p>
        <p className="missing-actions">
          {reset ? (
            <button type="button" className="button" onClick={reset}>
              {t.errorRetry}
            </button>
          ) : null}
          <Link prefetch={false} href={localPath(lang, "/")}>{t.backHome}</Link>
        </p>
      </section>
    </main>
  );
}
