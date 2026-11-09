import Link from "next/link";
import { OfflineSave } from "./OfflineSave";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { LangSwitch } from "./LangSwitch";
import { AuthButton } from "./AuthButton";
import { ActionIcon } from "./ActionIcon";

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
        <Link className="brand" href={home} prefetch={false}>
          <span className="brand-mark" aria-hidden="true" />
          ilyadays
        </Link>
      <nav className="site-primary-nav" aria-label={lang === "ru" ? "Разделы сайта" : "Site sections"}>
        <Link href={food} aria-current={section === "food" ? "page" : undefined}><ActionIcon name="food" /><span>{t.food}</span></Link>
        <Link href={travel} className="nav-section" prefetch={false}
          aria-current={section === "travel" ? "page" : undefined}><ActionIcon name="travel" /><span>{lang === "ru" ? "Поездки" : t.travel}</span></Link>
        <Link href={fitness} className="nav-section nav-fitness" prefetch={false}
          aria-current={section === "fitness" ? "page" : undefined}><ActionIcon name="fitness" /><span>{t.fitness}</span></Link>
      </nav>
      <div className="header-end">
        <LangSwitch lang={lang} path={path} label={t.language} />
        {auth && <AuthButton signInLabel={t.signIn} signOutLabel={t.signOut} />}
      </div>
      {section === "food" && path === "/food" && groups?.length ? (
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
      <div className="site-footer-inner">
        <div className="site-footer-context">{children ?? <span className="site-footer-wordmark">ilyadays.com</span>}</div>
        <OfflineSave />
      </div>
    </footer>
  );
}
