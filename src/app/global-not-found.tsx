// Any URL no route matches. Both root layouts are language-specific, so this one is a standalone bilingual page.
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found · ilyadays", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true" />
            ilyadays
          </Link>
        </header>
        <main>
          <section className="missing">
            <h1>Page not found</h1>
            <p className="lede">There&apos;s nothing at this address. · По этому адресу ничего нет.</p>
            <p>
              <Link href="/">← Home</Link> · <Link href="/ru">← На главную</Link>
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}
