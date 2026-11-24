// The static Stoic pages (public/apps/stoic-*.html) get their search and link-preview head from src/lib/stoic-seo.mjs, served
// by src/app/stoic-html/[lang]/[page]/route.ts at the page's own URL (next.config.ts rewrites). For every page and language,
// localize() on the real file must give one title, description and canonical, the right <html lang>, alternates only where
// there are two languages, Open Graph and Twitter tags, JSON-LD of the expected type, the Constitution's articles in its
// <noscript>, and otherwise the page byte for byte.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  SITE_NAME, SITE_URL, STOIC_PAGES, constitutionIndex, escapeHtml, isStoicRoute, localize, stoicImage, stoicRoutes, stoicUrl,
} from "../../src/lib/stoic-seo.mjs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const original = Object.fromEntries(Object.entries(STOIC_PAGES).map(([page, entry]) => [page, read(`public/apps/${entry.file}`)]));
const dataFor = (page, lang) => {
  const file = STOIC_PAGES[page].data?.[lang];
  return file ? JSON.parse(read(`public/apps/${file}`)) : undefined;
};
const headOf = (html) => html.slice(0, html.search(/<\/head\s*>/i));
const count = (text, re) => [...text.matchAll(re)].length;
const attr = (head, re) => (head.match(re) || [])[1];
const unescape = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
// Head tags outside the head's own scripts and styles (an inline script may mention a tag name).
const outsideCode = (head) => head.replace(/<(script|style)\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/\1>/gi, "");

describe("stoic-seo: the page table", () => {
  it("shares the site URL and name with src/lib/metadata.ts", () => {
    const metadata = read("src/lib/metadata.ts");
    assert.equal(SITE_URL, metadata.match(/export const SITE_URL = "([^"]+)"/)[1]);
    assert.equal(SITE_NAME, metadata.match(/export const SITE_NAME = "([^"]+)"/)[1]);
  });

  it("lists the six pages (four in English and Russian), each a file that exists", () => {
    const routes = stoicRoutes().map(({ lang, page }) => `${lang}/${page}`);
    for (const route of ["en/changelog", "en/composition", "en/constitution", "en/diagrams", "en/method", "en/translation",
      "ru/changelog", "ru/constitution", "ru/diagrams", "ru/method"]) {
      assert.ok(routes.includes(route), route);
    }
    assert.equal(routes.length, new Set(routes).size);
    for (const [page, entry] of Object.entries(STOIC_PAGES)) {
      assert.ok(existsSync(new URL(`../../public/apps/${entry.file}`, import.meta.url)), `${page}: public/apps/${entry.file}`);
      assert.ok(entry.langs[0] === "en" && entry.langs.every((l) => l === "en" || l === "ru"), `${page}: English first, then Russian`);
      assert.match(page, /^[a-z]+$/, `${page}: a plain route segment`);
    }
    assert.ok(!isStoicRoute("ru", "translation") && !isStoicRoute("en", "nope") && !isStoicRoute("en", "toString"));
  });

  it("writes a title and a description in every language, descriptions of 140–200 characters", () => {
    for (const [page, entry] of Object.entries(STOIC_PAGES)) {
      for (const lang of entry.langs) {
        const text = entry.text[lang];
        assert.ok(text?.title && text.description && text.imageAlt, `${page} ${lang}`);
        const length = [...text.description].length;
        assert.ok(length >= 140 && length <= 200, `${page} ${lang}: description is ${length} characters`);
        if (lang === "ru") assert.match(text.title + text.description, /[а-яё]/i, `${page} ru is Russian`);
      }
    }
  });

  it("keeps the pages' own titles (the method's and changelog's TITLE maps, the Constitution's Russian title)", () => {
    for (const page of ["method", "changelog"]) {
      const own = original[page].match(/const TITLE = \{en: '([^']+)', ru: '([^']+)'\}/);
      assert.ok(own, `the ${page} page's TITLE map`);
      assert.equal(STOIC_PAGES[page].text.en.title, own[1]);
      assert.equal(STOIC_PAGES[page].text.ru.title, own[2]);
    }
    assert.match(original.constitution, new RegExp(`document\\.title = '${STOIC_PAGES.constitution.text.ru.title}'`));
  });

  it("points every link preview at a picture that exists", () => {
    for (const { lang, page } of stoicRoutes()) {
      const image = stoicImage(page, lang);
      assert.ok(existsSync(new URL(`../../public${image.path}`, import.meta.url)), `${page} ${lang}: ${image.path}`);
    }
  });
});

describe("stoic-seo: localize() on the real pages", () => {
  for (const { lang, page } of stoicRoutes()) {
    const entry = STOIC_PAGES[page], both = entry.langs.length > 1, text = entry.text[lang];
    const out = localize(original[page], page, lang, dataFor(page, lang));
    const head = headOf(out), tags = outsideCode(head);

    describe(`${page} (${lang})`, () => {
      it("has one title, description and canonical, with the right values", () => {
        assert.equal(count(tags, /<title\b/gi), 1);
        assert.equal(count(tags, /<meta name="description"/gi), 1);
        assert.equal(count(tags, /<link rel="canonical"/gi), 1);
        assert.equal(unescape(attr(tags, /<title>([^<]*)<\/title>/)), text.title);
        assert.equal(unescape(attr(tags, /<meta name="description" content="([^"]*)">/)), text.description);
        const canonical = attr(tags, /<link rel="canonical" href="([^"]+)">/);
        assert.equal(canonical, `${SITE_URL}/apps/${entry.file}${both ? `?lang=${lang}` : ""}`);
      });

      it(`sets <html lang="${lang}">`, () => {
        assert.match(out, new RegExp(`^<!doctype html>\\s*<html lang="${lang}">`, "i"));
        assert.equal(count(out, /<html\b/gi), 1);
      });

      it(both ? "lists en, ru and x-default alternates" : "has no language alternates", () => {
        const alternates = [...tags.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]);
        if (!both) return assert.deepEqual(alternates, []);
        assert.deepEqual(alternates, [
          ["en", stoicUrl(page, "en")], ["ru", stoicUrl(page, "ru")], ["x-default", stoicUrl(page, "en")],
        ]);
        assert.ok(stoicUrl(page, "ru").endsWith("?lang=ru"));
      });

      it("has Open Graph and Twitter tags, and the site's icon instead of an empty one", () => {
        const og = Object.fromEntries([...tags.matchAll(/<meta property="(og:[^"]+)" content="([^"]*)">/g)].map((m) => [m[1], unescape(m[2])]));
        for (const key of ["og:type", "og:url", "og:title", "og:description", "og:image", "og:site_name", "og:locale"]) assert.ok(og[key], key);
        assert.equal(og["og:url"], stoicUrl(page, lang));
        assert.equal(og["og:description"], text.description);
        assert.equal(og["og:site_name"], "ilyadays");
        assert.equal(og["og:locale"], lang === "ru" ? "ru_RU" : "en_US");
        assert.equal(og["og:locale:alternate"], both ? (lang === "ru" ? "en_US" : "ru_RU") : undefined);
        assert.ok(og["og:image"].startsWith(`${SITE_URL}/`), og["og:image"]);
        assert.match(tags, /<meta name="twitter:card" content="summary_large_image">/);
        assert.match(tags, /<meta name="twitter:image" content="https:\/\/www\.ilyadays\.com\/[^"]+">/);
        assert.doesNotMatch(tags, /href="data:,"/);
        assert.match(tags, /<link rel="icon" href="\/icons\/icon-32\.png"/);
      });

      it("has one JSON-LD block of the expected type, published by the site and naming no person as author", () => {
        const blocks = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
        assert.equal(blocks.length, 1);
        const ld = JSON.parse(blocks[0][1]);
        const expected = { method: "ScholarlyArticle", translation: "Book" };
        assert.equal(ld["@context"], "https://schema.org");
        assert.equal(ld["@type"], expected[page] ?? "CreativeWork");
        assert.deepEqual(ld.publisher, { "@type": "WebSite", name: "ilyadays", url: "https://www.ilyadays.com" });
        assert.equal(ld.url, stoicUrl(page, lang));
        assert.equal(ld.inLanguage, lang);
        if (page === "method") assert.ok(ld.headline && [...ld.headline].length <= 110, ld.headline);
        if (page === "changelog") {
          assert.equal(ld.image, `${SITE_URL}/share/stoicism.jpg`, "the Constitution's preview picture");
          const length = [...text.description].length;
          assert.ok(length >= 140 && length <= 160, `changelog ${lang}: ${length} characters`);
        }
        if (page === "constitution") {
          assert.equal(ld.isBasedOn["@type"], "Book");
          assert.equal(ld.isBasedOn.author.sameAs, "https://en.wikipedia.org/wiki/Marcus_Aurelius");
          assert.deepEqual(ld.about.map((p) => p.sameAs), ["https://en.wikipedia.org/wiki/Marcus_Aurelius", "https://en.wikipedia.org/wiki/Seneca_the_Younger"]);
        }
        if (page === "translation") {
          assert.equal(ld.translationOfWork.inLanguage, "grc");
          assert.equal(ld.author.name, "Marcus Aurelius");
          assert.equal(ld.license, "https://creativecommons.org/publicdomain/zero/1.0/");
        }
        // Only Marcus and Seneca appear as people.
        const people = JSON.stringify(ld).match(/"@type":"Person","name":"[^"]+"/g) || [];
        for (const person of people) assert.match(person, /Marcus Aurelius|Марк Аврелий|Seneca|Сенека/);
      });

      it("keeps the generated tags between <!-- seo --> and <!-- /seo -->", () => {
        assert.equal(count(out, /<!-- seo -->/g), 1);
        const block = out.match(/<!-- seo -->\n([\s\S]*?)<!-- \/seo -->/)[1];
        assert.match(block, /<title>/);
        assert.match(block, /application\/ld\+json/);
        assert.equal(localize(out, page, lang, dataFor(page, lang)), out, "localize() is idempotent");
      });

      it("leaves the rest of the page byte for byte", () => {
        const strip = (html) => {
          const end = html.search(/<\/head\s*>/i);
          let h = html.slice(0, end).replace(/<!-- seo -->[\s\S]*?<!-- \/seo -->\n/, "").replace(/<html lang="[a-z]+">/, "<html>");
          for (const re of [/<title>[^<]*<\/title>\n/, /<meta name="description" content="[^"]*">\n/, /<link rel="icon" href="data:,">\n/]) h = h.replace(re, "");
          return h + html.slice(end).replace(/<noscript>[\s\S]*?<\/noscript>/, "<noscript/>");
        };
        assert.equal(strip(out), strip(original[page]));
        if (page !== "constitution") assert.equal(out.slice(out.search(/<\/head\s*>/i)), original[page].slice(original[page].search(/<\/head\s*>/i)));
      });

      if (page === "constitution") {
        it("puts every article in the <noscript>, chapter by chapter, linked to its place on the page", () => {
          const data = dataFor(page, lang);
          const noscripts = [...out.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)];
          assert.equal(noscripts.length, 1);
          const index = noscripts[0][1];
          assert.match(index, lang === "ru" ? /нужен JavaScript/ : /needs JavaScript/);
          const links = [...index.matchAll(/<li value="(\d+)"><a href="([^"]+)">([^<]*)<\/a><br>([^<]*)<\/li>/g)];
          assert.equal(data.articles.length, 38);
          assert.equal(links.length, 38);
          const byNumber = new Map(data.articles.map((a) => [a.number, a]));
          for (const [, number, href, title, statement] of links) {
            const article = byNumber.get(Number(number));
            assert.ok(article, `article ${number}`);
            assert.equal(unescape(title), article.title);
            assert.equal(unescape(statement), article.statement.t);
            assert.equal(unescape(href), `stoic-constitution.html?lang=${lang}&c=${article.chapter}#article-${number}`);
          }
          assert.deepEqual(links.map((m) => Number(m[1])).sort((a, b) => a - b), data.articles.map((a) => a.number).sort((a, b) => a - b));
          // Chapters as h2 in the page's order, each followed by its summary.
          const chapters = [...data.chapters].sort((a, b) => a.order - b.order);
          const heads = [...index.matchAll(/<h2>([^<]*)<\/h2>\n<p>([^<]*)<\/p>/g)];
          assert.deepEqual(heads.map((m) => unescape(m[1])), chapters.map((c) => `${lang === "ru" ? "Глава" : "Chapter"} ${c.order}. ${c.title}`));
          assert.deepEqual(heads.map((m) => unescape(m[2])), chapters.map((c) => c.summary));
        });

        it("uses the page's own deep links (?c= and #article-N)", () => {
          assert.match(original.constitution, /q\.get\('c'\)/);
          assert.match(original.constitution, /location\.hash\.match\(\/\^#article-\(\\d\+\)\$\/\)/);
        });
      }
    });
  }

  it("escapes text in the index and refuses a page or language it does not know", () => {
    const html = constitutionIndex({
      chapters: [{ id: "c1", order: 1, title: "<b>&", summary: '"x"', sections: [{ article: 1 }] }],
      articles: [{ number: 1, chapter: "c1", title: "a<script>", statement: { t: "it's" } }],
    }, "en");
    assert.doesNotMatch(html, /<b>|<script>/);
    assert.match(html, /&lt;b&gt;&amp;/);
    assert.equal(escapeHtml(`<a href="x">'`), "&lt;a href=&quot;x&quot;&gt;&#39;");
    assert.throws(() => localize(original.translation, "translation", "ru"));
    assert.throws(() => localize(original.constitution, "constitution", "en"), /index JSON/);
  });
});

describe("stoic-seo: wiring", () => {
  const config = read("next.config.ts"), route = read("src/app/stoic-html/[lang]/[page]/route.ts"), sitemap = read("src/app/sitemap.ts");

  it("rewrites the pages before the public files, ?lang=ru first", () => {
    assert.match(config, /beforeFiles: stoic/);
    assert.match(config, /has: \[\{ type: "query" as const, key: "lang", value: "ru" \}\], destination: `\/stoic-html\/ru\/\$\{page\}`/);
    assert.ok(config.indexOf("/stoic-html/ru/") < config.indexOf("/stoic-html/en/"));
    assert.doesNotMatch(read("public/apps/stoic-constitution.html"), /<base\b/);
  });

  it("builds the route statically for the known pairs only", () => {
    assert.match(route, /export const dynamic = "force-static"/);
    assert.match(route, /export const dynamicParams = false/);
    assert.match(route, /generateStaticParams/);
    assert.match(route, /text\/html; charset=utf-8/);
  });

  it("lists the pages in the sitemap", () => {
    assert.match(sitemap, /STOIC_PAGES/);
    assert.match(sitemap, /stoicUrl\(page, "ru"\)/);
  });
});
