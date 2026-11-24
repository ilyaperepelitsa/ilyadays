// Search and link-preview tags for the five static Stoic pages (public/apps/stoic-*.html), which the Next pages'
// pageMetadata() (src/lib/metadata.ts) does not reach. Each page is one English file whose script draws Russian at run time,
// so localize() gives a copy of it the head that a search engine or a link preview reads for one language: <html lang>, title,
// description, canonical URL, EN/RU alternates, Open Graph and Twitter tags, JSON-LD and the site's icons; and, for the
// Constitution, an index of its articles in place of the <noscript> note. src/app/stoic-html/[lang]/[page]/route.ts serves
// that copy, built once at build time, and next.config.ts rewrites the page's own URL to it (beforeFiles), so the browser stays
// on /apps/… and the pages' relative links and fetches work as before. Plain ESM so next.config.ts, the route and the node
// tests (tests/site/stoic-seo.test.mjs) share it.

/** Same as SITE_URL and SITE_NAME in src/lib/metadata.ts (a test keeps them equal). */
export const SITE_URL = "https://ilyadays.com";
export const SITE_NAME = "ilyadays";

/** @typedef {"en" | "ru"} StoicLang */
/** @typedef {{ title: string, description: string, headline?: string, imageAlt: string }} StoicText */
/**
 * @typedef {object} StoicPage
 * @property {string} file  path under public/apps/
 * @property {StoicLang[]} langs  ["en", "ru"] when the page switches with ?lang=, else ["en"]
 * @property {"constitution" | "method" | "diagrams" | "translation" | "composition" | "page"} kind  the JSON-LD shape;
 *   "page" is a plain CreativeWork
 * @property {"website" | "article"} ogType
 * @property {{ path: string, width: number, height: number } | ((lang: StoicLang) => { path: string, width: number, height: number })} image
 * @property {Partial<Record<StoicLang, string>>} [data]  the JSON (under public/apps/) the noscript index is drawn from
 * @property {Partial<Record<StoicLang, StoicText>>} text
 */

const CARD = { path: "/share/stoicism.jpg", width: 1200, height: 630 };
const CARD_ALT = {
  en: "Marcus Aurelius in profile, drawn as a network of points of light",
  ru: "Марк Аврелий в профиль, нарисованный сетью светящихся точек",
};
/** Figure 1 of the method paper as a 1200 × 627 card, in the page's language. */
const PIPELINE = (/** @type {StoicLang} */ lang) => ({ path: `/apps/stoic-method/share/pipeline-${lang}-landscape.png`, width: 1200, height: 627 });
const PIPELINE_ALT = {
  en: "Figure 1, how the Constitution was made: from 418 passages to 38 articles",
  ru: "Рис. 1, как сделана конституция: от 418 фрагментов к 38 статьям",
};

/**
 * The pages. Titles are the pages' own (the method's TITLE map; the Constitution's Russian title from its script). The
 * method and figures pages keep their own English descriptions; the figures page's Russian one is its Russian lede.
 * A new page is one more entry here: the route, the rewrites (next.config.ts), the sitemap and the tests all read this table.
 * @type {Record<string, StoicPage>}
 */
export const STOIC_PAGES = {
  constitution: {
    file: "stoic-constitution.html",
    langs: ["en", "ru"],
    kind: "constitution",
    ogType: "website",
    image: CARD,
    data: { en: "stoic-constitution.json", ru: "stoic-constitution.ru.json" },
    text: {
      en: {
        title: "The Stoic Constitution · ilyadays",
        description: "Thirty-eight articles to live by, fused from all 418 passages of Marcus Aurelius’s Meditations, every phrase traced to his words, with Seneca as a second voice.",
        imageAlt: CARD_ALT.en,
      },
      ru: {
        title: "Стоическая конституция · ilyadays",
        description: "Тридцать восемь статей для жизни, слитых из всех 418 фрагментов «Размышлений» Марка Аврелия; каждая фраза прослежена до его слов, Сенека — второй голос.",
        imageAlt: CARD_ALT.ru,
      },
    },
  },
  method: {
    file: "stoic-method.html",
    langs: ["en", "ru"],
    kind: "method",
    ogType: "article",
    image: PIPELINE,
    text: {
      en: {
        title: "From notes to a constitution · Stoic Constitution",
        description: "How the Stoic Constitution was made, written as a paper: materials, embedding, clustering, fusion into articles, the five sides, a second author, translation, prompting, validation and results.",
        headline: "From a book of notes to a testable constitution: fusing the Meditations of Marcus Aurelius",
        imageAlt: PIPELINE_ALT.en,
      },
      ru: {
        title: "От заметок к конституции · Стоическая конституция",
        description: "Как сделана Стоическая конституция, в форме научной статьи: материалы, векторы, кластеризация, слияние в статьи, пять сторон, второй автор, перевод и проверки.",
        headline: "От книги заметок к проверяемой конституции: слияние «Размышлений» Марка Аврелия",
        imageAlt: PIPELINE_ALT.ru,
      },
    },
  },
  diagrams: {
    file: "stoic-method/diagrams.html",
    langs: ["en", "ru"],
    kind: "diagrams",
    ogType: "website",
    image: PIPELINE,
    text: {
      en: {
        title: "How the Constitution was made · Figures",
        description: "The eight figures of the method paper, drawn from the published record. Each comes as a 1200 × 1200 and a 1200 × 627 image for sharing, and as SVG, in light and in dark.",
        imageAlt: PIPELINE_ALT.en,
      },
      ru: {
        title: "Как сделана конституция · Рисунки",
        description: "Восемь рисунков к описанию метода, построенных по опубликованным данным. Каждый — в виде картинок 1200 × 1200 и 1200 × 627 для публикации и в SVG, в светлом и в тёмном варианте.",
        imageAlt: PIPELINE_ALT.ru,
      },
    },
  },
  translation: {
    file: "stoic-translation.html",
    langs: ["en"],
    kind: "translation",
    ogType: "website",
    image: CARD,
    text: {
      en: {
        title: "Marcus from the Greek · Stoic Constitution",
        description: "The passages behind the Stoic Constitution, translated anew from Marcus Aurelius’s Greek and shown three ways: the Greek, the new English and the 1634 English.",
        imageAlt: CARD_ALT.en,
      },
    },
  },
  composition: {
    file: "stoic-composition.html",
    langs: ["en"],
    kind: "composition",
    ogType: "website",
    image: CARD,
    text: {
      en: {
        title: "How two passages become one article · Stoic Constitution",
        description: "A study of how two passages of the Meditations of Marcus Aurelius become one draft article, each phrase marked by the passage or the editor’s step it came from.",
        imageAlt: CARD_ALT.en,
      },
    },
  },
  changelog: {
    file: "stoic-changelog.html",
    langs: ["en", "ru"],
    kind: "page",
    ogType: "website",
    image: CARD,
    text: {
      en: {
        title: "What changed · Stoic Constitution",
        description: "A dated record of how the Stoic Constitution has changed, newest first: its articles, the translations from Greek and Latin, the Russian edition and the method.",
        imageAlt: CARD_ALT.en,
      },
      ru: {
        title: "Что изменилось · Стоическая конституция",
        description: "Датированный перечень изменений Стоической конституции, начиная с последних: статьи, переводы с греческого и латыни, русское издание и описание метода.",
        imageAlt: CARD_ALT.ru,
      },
    },
  },
};

/** Every (lang, page) pair the route builds. */
export function stoicRoutes() {
  return Object.entries(STOIC_PAGES).flatMap(([page, entry]) => entry.langs.map((lang) => ({ lang, page })));
}

/** True when `page` is one of the five and has `lang`. */
export function isStoicRoute(/** @type {string} */ lang, /** @type {string} */ page) {
  return Object.hasOwn(STOIC_PAGES, page) && /** @type {string[]} */ (STOIC_PAGES[page].langs).includes(lang);
}

/** The page's public URL path, "/apps/stoic-method/diagrams.html". */
export function stoicPath(/** @type {string} */ page) {
  return `/apps/${STOIC_PAGES[page].file}`;
}

/** The canonical URL: ?lang= on a page that has both languages, the bare URL on an English-only page. */
export function stoicUrl(/** @type {string} */ page, /** @type {StoicLang} */ lang) {
  const base = `${SITE_URL}${stoicPath(page)}`;
  return STOIC_PAGES[page].langs.length > 1 ? `${base}?lang=${lang}` : base;
}

/** The link-preview picture for a page in one language. */
export function stoicImage(/** @type {string} */ page, /** @type {StoicLang} */ lang) {
  const { image } = STOIC_PAGES[page];
  return typeof image === "function" ? image(lang) : image;
}

const ESC = /** @type {Record<string, string>} */ ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" });
/** Text made safe for HTML content and double-quoted attributes. */
export const escapeHtml = (/** @type {unknown} */ value) => String(value).replace(/[&<>"']/g, (c) => ESC[c]);

const PUBLISHER = { "@type": "WebSite", name: SITE_NAME, url: SITE_URL };
const MARCUS = {
  en: { "@type": "Person", name: "Marcus Aurelius", sameAs: "https://en.wikipedia.org/wiki/Marcus_Aurelius" },
  ru: { "@type": "Person", name: "Марк Аврелий", sameAs: "https://en.wikipedia.org/wiki/Marcus_Aurelius" },
};
const SENECA = {
  en: { "@type": "Person", name: "Seneca", sameAs: "https://en.wikipedia.org/wiki/Seneca_the_Younger" },
  ru: { "@type": "Person", name: "Сенека", sameAs: "https://en.wikipedia.org/wiki/Seneca_the_Younger" },
};
const MEDITATIONS = (/** @type {StoicLang} */ lang) => ({
  "@type": "Book",
  name: lang === "ru" ? "Размышления" : "Meditations",
  alternateName: "Τὰ εἰς ἑαυτόν",
  inLanguage: "grc",
  author: MARCUS[lang],
  sameAs: "https://en.wikipedia.org/wiki/Meditations",
});
const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

/** The page's one JSON-LD object. */
export function stoicJsonLd(/** @type {string} */ page, /** @type {StoicLang} */ lang) {
  const entry = STOIC_PAGES[page], text = /** @type {StoicText} */ (entry.text[lang]), image = stoicImage(page, lang);
  const base = {
    "@context": "https://schema.org",
    name: ogTitle(text.title),
    description: text.description,
    url: stoicUrl(page, lang),
    inLanguage: lang,
    image: `${SITE_URL}${image.path}`,
    publisher: PUBLISHER,
  };
  switch (entry.kind) {
    case "constitution":
      return { ...base, "@type": "CreativeWork", isBasedOn: MEDITATIONS(lang), about: [MARCUS[lang], SENECA[lang]] };
    case "method": {
      const headline = /** @type {string} */ (text.headline);
      return { ...base, "@type": "ScholarlyArticle", name: headline, headline, about: MEDITATIONS(lang) };
    }
    case "translation":
      return {
        ...base, "@type": "Book", name: "Meditations", alternateName: "Marcus, from the Greek", author: MARCUS.en,
        translationOfWork: { ...MEDITATIONS("en"), name: "Τὰ εἰς ἑαυτόν", alternateName: "Meditations" },
        license: CC0,
      };
    case "diagrams": {
      const method = /** @type {StoicText} */ (STOIC_PAGES.method.text[lang]);
      return { ...base, "@type": "CreativeWork", isPartOf: { "@type": "ScholarlyArticle", headline: method.headline, url: stoicUrl("method", lang) } };
    }
    case "composition":
      return { ...base, "@type": "CreativeWork", isBasedOn: MEDITATIONS(lang) };
    default:
      return { ...base, "@type": "CreativeWork" };
  }
}

/** The title without the site's suffix (og:site_name carries it). */
const ogTitle = (/** @type {string} */ title) => title.replace(/ · ilyadays$/, "");

/** The generated head block, between <!-- seo --> and <!-- /seo -->. */
export function stoicHead(/** @type {string} */ page, /** @type {StoicLang} */ lang) {
  const entry = STOIC_PAGES[page], text = /** @type {StoicText} */ (entry.text[lang]), url = stoicUrl(page, lang);
  const image = stoicImage(page, lang), imageUrl = `${SITE_URL}${image.path}`, both = entry.langs.length > 1;
  const locale = (/** @type {string} */ l) => (l === "ru" ? "ru_RU" : "en_US");
  const meta = (/** @type {string} */ attr, /** @type {string} */ key, /** @type {string | number} */ value) => `<meta ${attr}="${key}" content="${escapeHtml(value)}">`;
  const json = JSON.stringify(stoicJsonLd(page, lang)).replace(/</g, "\\u003c");
  return [
    "<!-- seo -->",
    `<title>${escapeHtml(text.title)}</title>`,
    meta("name", "description", text.description),
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    ...(both ? [...entry.langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${escapeHtml(stoicUrl(page, l))}">`),
      `<link rel="alternate" hreflang="x-default" href="${escapeHtml(stoicUrl(page, "en"))}">`] : []),
    // The site's icons, as src/components/site/RootShell.tsx declares them.
    '<link rel="icon" href="/icons/icon-32.png" sizes="32x32" type="image/png">',
    '<link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png">',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    meta("property", "og:type", entry.ogType),
    meta("property", "og:site_name", SITE_NAME),
    meta("property", "og:url", url),
    meta("property", "og:title", ogTitle(text.title)),
    meta("property", "og:description", text.description),
    meta("property", "og:image", imageUrl),
    meta("property", "og:image:width", image.width),
    meta("property", "og:image:height", image.height),
    meta("property", "og:image:alt", text.imageAlt),
    meta("property", "og:locale", locale(lang)),
    ...(both ? entry.langs.filter((l) => l !== lang).map((l) => meta("property", "og:locale:alternate", locale(l))) : []),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", ogTitle(text.title)),
    meta("name", "twitter:description", text.description),
    meta("name", "twitter:image", imageUrl),
    meta("name", "twitter:image:alt", text.imageAlt),
    `<script type="application/ld+json">${json}</script>`,
    "<!-- /seo -->",
  ].join("\n") + "\n";
}

/**
 * @typedef {object} ConstitutionData  public/apps/stoic-constitution(.ru).json, the parts the index uses
 * @property {{ id: string, order: number, title: string, summary: string, sections: { article?: number }[] }[]} chapters
 * @property {{ number: number, chapter: string, title: string, statement: { t: string } }[]} articles
 */

/**
 * The Constitution's <noscript>: the note that the page needs JavaScript, then every chapter in order (h2 and summary) with
 * its articles, each a link the page opens at that article (?c=<chapter>#article-<n>, as the page's own Contents links).
 */
export function constitutionIndex(/** @type {ConstitutionData} */ data, /** @type {StoicLang} */ lang) {
  const ru = lang === "ru";
  const out = [
    "<noscript>",
    `<p class="wrap err">${ru
      ? "Этой странице нужен JavaScript, чтобы показать темы и статьи. Ниже — простой список статей."
      : "This page needs JavaScript to draw the topics and articles. Below is a plain index of the articles."}</p>`,
    '<div class="wrap">',
  ];
  for (const chapter of [...data.chapters].sort((a, b) => a.order - b.order)) {
    const place = new Map(chapter.sections.filter((s) => s.article).map((s, i) => [s.article, i]));
    const rank = (/** @type {number} */ n) => place.get(n) ?? Number.MAX_SAFE_INTEGER;
    const articles = data.articles.filter((a) => a.chapter === chapter.id).sort((a, b) => rank(a.number) - rank(b.number) || a.number - b.number);
    out.push(`<h2>${ru ? "Глава" : "Chapter"} ${chapter.order}. ${escapeHtml(chapter.title)}</h2>`, `<p>${escapeHtml(chapter.summary)}</p>`, "<ol>");
    for (const article of articles) {
      const href = `stoic-constitution.html?lang=${lang}&c=${chapter.id}#article-${article.number}`;
      out.push(`<li value="${article.number}"><a href="${escapeHtml(href)}">${escapeHtml(article.title)}</a><br>${escapeHtml(article.statement.t)}</li>`);
    }
    out.push("</ol>");
  }
  out.push("</div>", "</noscript>");
  return out.join("\n");
}

// The page's own head tags that the block replaces. Each is removed with the line break after it.
const OWN_TAGS = [
  /<title\b[^>]*>[\s\S]*?<\/title>\n?/gi,
  /<meta\s+name="description"[^>]*>\n?/gi,
  /<link\s+rel="(?:icon|shortcut icon|apple-touch-icon|canonical)"[^>]*>\n?/gi,
  /<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>\n?/gi,
  /<meta\s+(?:property="og:|name="twitter:)[^>]*>\n?/gi,
  /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\n?/gi,
];

/**
 * The page's HTML for one language: <html lang>, the head block in place of the page's own title, description and icon, and
 * (Constitution) the index in place of the <noscript>. Everything else is left byte for byte.
 * @param {string} html  the page as published in public/apps/
 * @param {string} page  a key of STOIC_PAGES
 * @param {StoicLang} lang
 * @param {ConstitutionData} [data]  the Constitution's index JSON in that language (required for the Constitution)
 */
export function localize(html, page, lang, data) {
  if (!isStoicRoute(lang, page)) throw new Error(`stoic-seo: no ${lang} version of "${page}"`);
  const end = html.search(/<\/head\s*>/i);
  if (end < 0) throw new Error(`stoic-seo: ${page} has no </head>`);
  let head = html.slice(0, end), body = html.slice(end);

  head = head.replace(/<html\b[^>]*>/i, (tag) => /\slang="[^"]*"/i.test(tag)
    ? tag.replace(/\slang="[^"]*"/i, ` lang="${lang}"`) : tag.replace(/^<html/i, `<html lang="${lang}"`));
  // A block from an earlier run is replaced where it stands.
  const earlier = head.search(/<!-- seo -->/);
  head = head.replace(/<!-- seo -->[\s\S]*?<!-- \/seo -->\n?/g, "");

  // The tags to drop, ignoring anything inside the head's own scripts and styles.
  const code = [...head.matchAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi)].map((m) => [/** @type {number} */ (m.index), /** @type {number} */ (m.index) + m[0].length]);
  const inCode = (/** @type {number} */ at) => code.some(([from, to]) => at > from && at < to);
  const drop = OWN_TAGS.flatMap((re) => [...head.matchAll(re)]).filter((m) => !inCode(/** @type {number} */ (m.index)))
    .map((m) => [/** @type {number} */ (m.index), /** @type {number} */ (m.index) + m[0].length]).sort((a, b) => a[0] - b[0]);
  let at = Math.min(earlier < 0 ? Infinity : earlier, drop.length ? drop[0][0] : Infinity);
  if (at === Infinity) {
    const anchor = head.match(/<meta\s+charset[^>]*>\n?/i) || head.match(/<head\b[^>]*>\n?/i);
    at = anchor ? /** @type {number} */ (anchor.index) + anchor[0].length : head.length;
  }
  for (const [from, to] of [...drop].reverse()) head = head.slice(0, from) + head.slice(to);
  head = head.slice(0, at) + stoicHead(page, lang) + head.slice(at);

  if (STOIC_PAGES[page].kind === "constitution") {
    if (!data) throw new Error("stoic-seo: the Constitution needs its index JSON");
    const index = constitutionIndex(data, lang);
    if (/<noscript>[\s\S]*?<\/noscript>/i.test(body)) body = body.replace(/<noscript>[\s\S]*?<\/noscript>/i, () => index);
    else body = body.replace(/<body\b[^>]*>\n?/i, (tag) => tag + index + "\n");
  }
  return head + body;
}
