import Link from "next/link";
import { OfflineSave } from "./OfflineSave";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { LangSwitch } from "./LangSwitch";
import { AuthButton } from "./AuthButton";

type Props = {
  lang: Lang;
  /** This page's path without the language prefix — the EN · RU switch links to the same page. */
  path: string;
  section: "home" | "food" | "travel";
  /** Food pages: the recipe groups, shown as the recipe site's own nav. */
  groups?: { id: string; name: string }[];
  /** Travel pages: the small Google sign-in in the top bar. */
  auth?: boolean;
};

export function SiteHeader({ lang, path, section, groups, auth }: Props) {
  const t = strings(lang);
  const home = localPath(lang, "/");
  const food = localPath(lang, "/food");
  const travel = localPath(lang, "/travel");
  return (
    <header className="site-header">
      {section === "food" ? (
        <>
          <span className="brand-group">
            <Link className="home-link" href={home}>ilyadays</Link>
            <span className="crumb" aria-hidden="true">/</span>
            <Link className="brand" href={food}>
              <span className="brand-mark" aria-hidden="true" />
              {t.recipes}
            </Link>
          </span>
          <nav aria-label={t.recipes}>
            {groups?.map((g) => (
              <a key={g.id} href={`${food}#${g.id}`}>{g.name}</a>
            ))}
            <Link href={travel} className="nav-section">{t.travel}</Link>
          </nav>
        </>
      ) : (
        <>
          <Link className="brand" href={home}>
            <span className="brand-mark" aria-hidden="true" />
            ilyadays
          </Link>
          <nav aria-label="ilyadays">
            <Link href={food}>{t.food}</Link>
            <Link href={travel} aria-current={section === "travel" ? "page" : undefined}>{t.travel}</Link>
          </nav>
        </>
      )}
      <div className="header-end">
        <LangSwitch lang={lang} path={path} label={t.language} />
        {auth && <AuthButton signInLabel={t.signIn} signOutLabel={t.signOut} />}
      </div>
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
