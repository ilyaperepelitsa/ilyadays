// The static Stoic pages (public/apps/stoic-*.html) draw the site header with public/apps/site-chrome.js. These tests keep that
// copy in step with the React header, src/components/site/SiteHeader.tsx: the same sections in the same order, links, labels,
// icons, classes and EN · RU pill, in both languages; and the same colour tokens as src/styles/theme.css.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";
import { localPath, strings } from "../../src/lib/i18n.ts";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const header = read("src/components/site/SiteHeader.tsx");
const chrome = read("public/apps/site-chrome.js");
const chromeCss = read("public/apps/site-chrome.css");
const theme = read("src/styles/theme.css");
const ICON_PATHS = Object.fromEntries([...read("src/components/site/ActionIcon.tsx").matchAll(/^\s+(\w+): "([^"]+)",$/gm)].map((m) => [m[1], m[2]]));

/** What SiteHeader.tsx renders for one language, read from its source: brand link, nav label, sections and pill label. */
function reactHeader(lang) {
  const t = strings(lang);
  const paths = Object.fromEntries([...header.matchAll(/const (\w+) = localPath\(lang, "([^"]+)"\);/g)].map((m) => [m[1], localPath(lang, m[2])]));
  // A label is `t.key`, or `lang === "ru" ? "…" : <t.key | "…">`.
  const label = (expr) => {
    const choice = expr.match(/^lang === "ru" \? "([^"]+)" : (.+)$/);
    if (choice) return lang === "ru" ? choice[1] : label(choice[2]);
    const literal = expr.match(/^"([^"]+)"$/);
    if (literal) return literal[1];
    const key = expr.match(/^t\.(\w+)$/);
    assert.ok(key, `unexpected label expression in SiteHeader.tsx: ${expr}`);
    return t[key[1]];
  };
  const nav = header.slice(header.indexOf('<nav className="site-primary-nav"'), header.indexOf("</nav>"));
  const navLabel = nav.match(/aria-label=\{lang === "ru" \? "([^"]+)" : "([^"]+)"\}/);
  const sections = [...nav.matchAll(/<(?:Link|a) href=\{(`[^`]*`|\w+)\}([^>]*)>\s*<ActionIcon name="(\w+)"\s*\/>\s*<span>\{([^}]+)\}<\/span>/g)].map((m) => ({
    href: m[1].startsWith("`") ? m[1].slice(1, -1).replace("${lang}", lang) : paths[m[1]],
    className: (m[2].match(/className="([^"]+)"/) || [])[1] || "",
    icon: m[3],
    label: label(m[4].trim()),
    current: /aria-current=\{section === "stoicism"/.test(m[2]),
  }));
  return { brand: paths.home, navLabel: lang === "ru" ? navLabel[1] : navLabel[2], sections, language: t.language };
}

/** Runs site-chrome.js against a stand-in document; returns the header markup it writes and what it exposes. */
function staticHeader({ search = "", stored = {} } = {}) {
  let html = "";
  const store = { ...stored };
  const context = {
    location: { search, pathname: "/apps/stoic-constitution.html", hash: "#article-2" },
    URLSearchParams,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: {
      currentScript: { parentNode: {}, insertAdjacentHTML: (where, markup) => { assert.equal(where, "beforebegin"); html = markup; } },
      querySelectorAll: () => [],
    },
    window: {},
  };
  vm.runInNewContext(chrome, context);
  return { html, lang: context.window.siteChrome.lang, store };
}

/** The static header's parts, read back from its markup. */
function parse(html) {
  const nav = html.slice(html.indexOf('<nav class="site-primary-nav"'), html.indexOf("</nav>"));
  return {
    brand: html.match(/<a class="brand" href="([^"]+)">/)[1],
    navLabel: nav.match(/aria-label="([^"]+)"/)[1],
    sections: [...nav.matchAll(/<a href="([^"]+)"(?: class="([^"]+)")?( aria-current="page")?><svg class="action-icon"[^>]*><path d="([^"]+)"\/><\/svg><span>([^<]+)<\/span><\/a>/g)].map((m) => ({
      href: m[1].replace(/&amp;/g, "&"), className: m[2] || "", current: Boolean(m[3]), path: m[4], label: m[5],
    })),
    language: html.match(/<nav class="lang" aria-label="([^"]+)">/)[1],
    pill: [...html.matchAll(/<span class="on" aria-current="true">(\w+)<\/span>|<a href="([^"]+)" hreflang="(\w+)" lang="\w+" data-lang="\w+">(\w+)<\/a>/g)].map((m) => (m[1] ? { on: m[1] } : { href: m[2].replace(/&amp;/g, "&"), lang: m[3], text: m[4] })),
  };
}

describe("static site header (public/apps/site-chrome.js)", () => {
  for (const lang of ["en", "ru"]) {
    it(`matches SiteHeader.tsx in ${lang === "en" ? "English" : "Russian"}`, () => {
      const want = reactHeader(lang);
      const got = parse(staticHeader({ search: `?lang=${lang}&c=c2` }).html);
      assert.equal(want.sections.length, 4, "SiteHeader.tsx could not be read: expected four sections");
      assert.equal(got.brand, want.brand);
      assert.equal(got.navLabel, want.navLabel);
      assert.equal(got.language, want.language);
      assert.deepEqual(got.sections.map((s) => s.label), want.sections.map((s) => s.label));
      assert.deepEqual(got.sections.map((s) => s.href), want.sections.map((s) => s.href));
      assert.deepEqual(got.sections.map((s) => s.className), want.sections.map((s) => s.className));
      assert.deepEqual(got.sections.map((s) => s.path), want.sections.map((s) => ICON_PATHS[s.icon]));
      // On a Stoic page, Stoicism is the current section, as SiteHeader marks it with section="stoicism".
      assert.deepEqual(got.sections.map((s) => s.current), want.sections.map((s) => s.current));
      assert.equal(got.sections.filter((s) => s.current).length, 1);
    });
  }

  it("draws the EN · RU pill as the site does, switching this page's ?lang and keeping its query and hash", () => {
    const { pill } = parse(staticHeader({ search: "?lang=en&c=c2&with=seneca" }).html);
    assert.deepEqual(pill[0], { on: "EN" });
    assert.equal(pill[1].lang, "ru");
    assert.equal(pill[1].text, "RU");
    assert.equal(pill[1].href, "/apps/stoic-constitution.html?lang=ru&c=c2&with=seneca#article-2");
    const ru = parse(staticHeader({ search: "?lang=ru" }).html).pill;
    assert.equal(ru[0].href, "/apps/stoic-constitution.html?lang=en#article-2");
    assert.deepEqual(ru[1], { on: "RU" });
  });

  it("takes the language from ?lang, then the page's choice, then the site's, else English", () => {
    assert.equal(staticHeader({ search: "?lang=ru" }).lang, "ru");
    assert.equal(staticHeader({ search: "?lang=ru" }).store["stoic-constitution:lang"], "ru");
    assert.equal(staticHeader({ stored: { "stoic-constitution:lang": "ru", "site-lang": "en" } }).lang, "ru");
    assert.equal(staticHeader({ stored: { "site-lang": "ru" } }).lang, "ru");
    assert.equal(staticHeader({ search: "?lang=xx" }).lang, "en");
    assert.equal(staticHeader().lang, "en");
  });

  it("is on every Stoic static page, first in <body>, with its stylesheet ahead of the page's own styles and no old top bar", () => {
    const pages = readdirSync(new URL("../../public/apps/", import.meta.url)).filter((name) => /^stoic-.*\.html$/.test(name));
    assert.ok(pages.length >= 3);
    for (const name of pages) {
      const html = read(`public/apps/${name}`);
      assert.match(html, /<body[^>]*>\n<script src="\/apps\/site-chrome\.js"><\/script>/, `${name}: the header script opens <body>`);
      const link = html.indexOf('<link rel="stylesheet" href="/apps/site-chrome.css">');
      assert.ok(link > 0 && link < html.indexOf("<style>"), `${name}: site-chrome.css is linked before the page's <style>`);
      assert.doesNotMatch(html, /class="wrap top"/, `${name}: the old top bar is gone`);
    }
  });

  it("uses the site's colour tokens, light and dark", () => {
    const tokens = (css) => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,8})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
    const darkOf = (css) => css.slice(css.search(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/));
    const lightOf = (css) => css.slice(0, css.search(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/));
    const names = ["bg", "surface", "surface-2", "ink", "muted", "line", "accent", "accent-soft", "action", "on-action"];
    for (const [part, label] of [[lightOf, "light"], [darkOf, "dark"]]) {
      const site = tokens(part(theme)), mine = tokens(part(chromeCss));
      for (const name of names) assert.equal(mine[name], site[name], `--${name} (${label})`);
    }
  });
});
