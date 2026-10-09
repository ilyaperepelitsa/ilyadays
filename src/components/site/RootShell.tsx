import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LANG_SCRIPT, type Lang } from "@/lib/i18n";
import { SITE_NAME, SITE_URL } from "@/lib/metadata";
import { PageMemory } from "./PageMemory";

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const rootViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1916" },
  ],
};

/** <html> for one language. Analytics and Speed Insights are Vercel's cookieless ones. */
export function RootShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <html lang={lang}>
      {/* eslint-disable-next-line @next/next/no-head-element -- App Router root layout; the script must run first */}
      <head>
        {/* Before first paint: follow the reader's saved language (localStorage, never a cookie). */}
        <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} />
      </head>
      <body>
        {children}
        <PageMemory />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
