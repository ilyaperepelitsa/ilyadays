import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { AuthProvider } from "@/components/site/AuthProvider";
import { OWNER_TEMPLATE } from "@/lib/fitness/catalog.mjs";
import { AccountBoundary, FitnessProvider } from "./Provider";
import { pick } from "@/lib/fitness/i18n";
import { ModeNote } from "./ModeNote";
import { GymOffline } from "./GymOffline";
import { SectionNavigation } from "./SectionNavigation";

/** Exercise ids of the default program, for the offline copy (server-side: the client never loads the catalog for this). */
const TEMPLATE_EXERCISE_IDS: string[] = [...new Set(OWNER_TEMPLATE.days.flatMap((d: { slots: string[][] }) => d.slots.map((slot) => slot[1])))];

/**
 * Auth and fitness data for the whole section. Mounted once by the fitness layouts (src/app/(en)/fitness/layout.tsx,
 * src/app/ru/fitness/layout.tsx), so moving between fitness pages keeps the sign-in, the store and every page's state
 * in place instead of mounting them again.
 */
export function FitnessProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <FitnessProvider>{children}</FitnessProvider>
    </AuthProvider>
  );
}

/**
 * Every fitness page (inside <FitnessProviders>): sticky header with sign-in, `main.fit`, footer with a way back.
 * Server component; `children` may be server or client components. The page content is remounted when the signed-in
 * account changes (AccountBoundary), so one account's unsaved input never shows under another.
 */
export function FitnessShell({ lang, path, children }: { lang: Lang; path: string; children: React.ReactNode }) {
  const t = strings(lang);
  return (
    <>
      <SiteHeader lang={lang} path={path} section="fitness" auth />
      <GymOffline lang={lang} templateExerciseIds={TEMPLATE_EXERCISE_IDS} />
      <main className="fit">
        <AccountBoundary>{children}</AccountBoundary>
      </main>
      <SiteFooter>
        {path === "/fitness" ? (
          <Link prefetch={false} href={localPath(lang, "/")}>{t.backHome}</Link>
        ) : (
          <Link prefetch={false} href={localPath(lang, "/fitness")}>{pick(lang, "← Fitness", "← Фитнес")}</Link>
        )}
      </SiteFooter>
    </>
  );
}

/** Sub-navigation shown under the title on every fitness page, followed by the one-line store status (local /
 *  synced / viewer). Views must not render <ModeNote> themselves. */
export function FitnessNav({ lang, current }: { lang: Lang; current: string }) {
  return (
    <>
      <SectionNavigation lang={lang} current={current} />
      <ModeNote lang={lang} current={current} />
    </>
  );
}
