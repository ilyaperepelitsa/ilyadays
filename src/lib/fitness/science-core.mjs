// @ts-check
/**
 * Science topics on disk (stream 08, plans/fitness/08-science-content.md): content/fitness/science/<slug>.<lang>.md.
 * Node only (fs) — the pages read it at build time through science.ts; the tests call it directly. Works with
 * whatever topic files exist: other streams add topics by adding files.
 */
import fs from "node:fs";
import path from "node:path";
import { parseFrontMatter, renderMarkdown, wordCount } from "./markdown.mjs";

/** @typedef {import("./types").Lang} Lang */
/** @typedef {import("./markdown.mjs").Source} Source */
/** @typedef {import("./markdown.mjs").TocItem} TocItem */
/**
 * @typedef {{ slug: string, title: string, description: string, updated: string, order: number, minutes: number,
 *   sources: number }} TopicSummary
 */
/**
 * @typedef {{ slug: string, title: string, description: string, updated: string, order: number, minutes: number,
 *   html: string, toc: TocItem[], sources: Source[] }} Topic
 */

/** Topic slugs: the same rule the offline catalog and the sitemap use. */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FILE_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(en|ru)\.md$/;

/** The topics folder under a project root. @param {string} [root] */
export const scienceDir = (root = process.cwd()) => path.join(root, "content", "fitness", "science");

/** Reading time: about 220 words a minute in English, 180 in Russian (longer words). @param {number} words @param {Lang} lang */
export const readingMinutes = (words, lang) => Math.max(1, Math.round(words / (lang === "ru" ? 180 : 220)));

/**
 * Topic files in `dir`: slug → the languages it has. Files that do not match `<slug>.<en|ru>.md` are ignored; a
 * missing folder is an empty map.
 * @param {string} dir @returns {Map<string, Set<Lang>>}
 */
export function topicFiles(dir) {
  /** @type {Map<string, Set<Lang>>} */
  const out = new Map();
  /** @type {string[]} */
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names.sort()) {
    const m = FILE_RE.exec(name);
    if (!m) continue;
    const langs = out.get(m[1]) ?? new Set();
    langs.add(m[2] === "ru" ? "ru" : "en");
    out.set(m[1], langs);
  }
  return out;
}

/** @param {string} dir @param {Lang} lang @param {string} slug */
const fileOf = (dir, lang, slug) => path.join(dir, `${slug}.${lang}.md`);

/** @param {number} order */
const orderOf = (order) => (Number.isFinite(order) ? order : 0);

/**
 * Every topic that has a file in this language, by `order`, then slug.
 * @param {string} dir @param {Lang} lang @returns {TopicSummary[]}
 */
export function listTopicsIn(dir, lang) {
  /** @type {TopicSummary[]} */
  const out = [];
  for (const [slug, langs] of topicFiles(dir)) {
    if (!langs.has(lang)) continue;
    const { meta, body } = parseFrontMatter(fs.readFileSync(fileOf(dir, lang, slug), "utf8"));
    out.push({
      slug,
      title: meta.title || slug,
      description: meta.description,
      updated: meta.updated,
      order: orderOf(meta.order),
      minutes: readingMinutes(wordCount(body), lang),
      sources: meta.sources.length,
    });
  }
  return out.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

/**
 * One topic rendered to HTML, or null when the slug is not a valid slug or has no file in this language.
 * @param {string} dir @param {Lang} lang @param {string} slug @returns {Topic | null}
 */
export function readTopicIn(dir, lang, slug) {
  if (!SLUG_RE.test(slug) || (lang !== "en" && lang !== "ru")) return null;
  /** @type {string} */
  let text;
  try {
    text = fs.readFileSync(fileOf(dir, lang, slug), "utf8");
  } catch {
    return null;
  }
  const { meta, html, toc, body } = renderMarkdown(text, { lang });
  return {
    slug,
    title: meta.title || slug,
    description: meta.description,
    updated: meta.updated,
    order: orderOf(meta.order),
    minutes: readingMinutes(wordCount(body), lang),
    html,
    toc,
    sources: meta.sources,
  };
}
