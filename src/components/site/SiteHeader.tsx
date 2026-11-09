import Link from "next/link";
import { OfflineSave } from "./OfflineSave";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { LangSwitch } from "./LangSwitch";
import { AuthButton } from "./AuthButton";

type Props = {
  lang: Lang;
  /** This page's path without the language prefix — the EN · RU switch links to the same page. */
  path: string;
  section: "home" | "food" | "travel" | "fitness";
  /** Food pages: the recipe groups, shown as the recipe site's own nav. */
  groups?: { id: string; name: string }[];
  /** Travel pages: the small Google sign-in in the top bar. */
  auth?: boolean;
};

/**
 * The sticky top bar. Links into another section don't prefetch: a prefetched home or travel page brings its
 * full-width cover pictures (about 260 KB) along to every recipe page that never shows them.
 */
export function SiteHeader({ lang, path, section, groups, auth }: Props) {
  const t = strings(lang);
  const home = localPath(lang, "/");
  const food = localPath(lang, "/food");
  const travel = localPath(lang, "/travel");
  const fitness = localPath(lang, "/fitness");
  return (
    <header className="site-header">
      {section === "food" ? (
        <span className="brand-group">
          <Link className="home-link" href={home} prefetch={false}>ilyadays</Link>
          <span className="crumb" aria-hidden="true">/</span>
          <Link className="brand" href={food}>{t.recipes}</Link>
        </span>
      ) : (
        <Link className="brand" href={home} prefetch={section !== "home" ? false : undefined}>
          <span className="brand-mark" aria-hidden="true" />
          ilyadays
        </Link>
      )}
      <nav className="site-primary-nav" aria-label={lang === "ru" ? "Разделы сайта" : "Site sections"}>
        <Link href={food} aria-current={section === "food" ? "page" : undefined}>{t.food}</Link>
        <Link href={travel} className="nav-section" prefetch={false}
          aria-current={section === "travel" ? "page" : undefined}>{t.travel}</Link>
        <Link href={fitness} className="nav-section nav-fitness" prefetch={false}
          aria-current={section === "fitness" ? "page" : undefined}>{t.fitness}</Link>
      </nav>
      <div className="header-end">
        <LangSwitch lang={lang} path={path} label={t.language} />
        {auth && <AuthButton signInLabel={t.signIn} signOutLabel={t.signOut} />}
      </div>
      {section === "food" && groups?.length ? (
        <nav className="group-nav" aria-label={t.recipes}>
          {groups.map((g) => <a key={g.id} href={`${food}#${g.id}`}>{g.name}</a>)}
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="site-footer">
      <OfflineSave />
      {children ?? "ilyadays.com"}
    </footer>
  );
}
