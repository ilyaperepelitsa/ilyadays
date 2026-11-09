import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { AuthProvider } from "@/components/site/AuthProvider";
import { FitnessProvider } from "./Provider";
import { pick } from "@/lib/fitness/i18n";
import { ModeNote } from "./ModeNote";
import { GymOffline } from "./GymOffline";
import { SectionNavigation } from "./SectionNavigation";

/**
 * Every fitness page: sticky header with sign-in, auth + fitness data providers, `main.fit`, footer with a way back.
 * Server component; `children` may be server or client components.
 */
export function FitnessShell({ lang, path, children }: { lang: Lang; path: string; children: React.ReactNode }) {
  const t = strings(lang);
  return (
    <AuthProvider>
      <FitnessProvider>
        <SiteHeader lang={lang} path={path} section="fitness" auth />
        <GymOffline lang={lang} />
        <main className="fit">{children}</main>
        <SiteFooter>
          {path === "/fitness" ? (
            <Link prefetch={false} href={localPath(lang, "/")}>{t.backHome}</Link>
          ) : (
            <Link prefetch={false} href={localPath(lang, "/fitness")}>{pick(lang, "← Fitness", "← Фитнес")}</Link>
          )}
        </SiteFooter>
      </FitnessProvider>
    </AuthProvider>
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
