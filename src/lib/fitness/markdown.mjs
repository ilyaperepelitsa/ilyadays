// @ts-check
/**
 * Tiny markdown renderer for the fitness science pages (stream 08, plans/fitness/08-science-content.md).
 * No dependencies, no DOM, no fs: the topic loader (science-core.mjs) and the tests call it at build time.
 *
 * Supported: a front-matter block (title, description, updated, order, sources), `#`–`######` headings with unique
 * slug ids, paragraphs, **bold**, *italic* / _italic_, `code`, [links](http(s) or relative only), ordered and
 * unordered lists with one nested level, pipe tables with a header row, `>` callouts, `---` rules, fenced code, and
 * citation markers [n] / [n][m] / [n, m] / [n–m] → <sup class="fit-cite"><a href="#src-n">n</a></sup>.
 * Everything else is text: raw HTML, entities and odd link schemes are escaped, never interpreted.
 */

/** @typedef {import("./types").Lang} Lang */
/**
 * One numbered source from the front matter: "- [n] Title — Outlet, year. URL".
 * @typedef {{ n: number, text: string, title: string, outlet: string, year: string, url: string | null }} Source
 */
/** @typedef {{ title: string, description: string, updated: string, order: number, sources: Source[] }} TopicMeta */
/** @typedef {{ id: string, text: string, level: 2 | 3 }} TocItem */
/**
 * @typedef {{ lang: Lang, sources: Map<number, Source>, cites: Set<number>, used: Set<string>, toc: TocItem[],
 *   links: boolean }} Ctx
 */

/* ------------------------------------------------------------------ escaping and links */

/** @type {Record<string, string>} */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escape for attribute values (and anywhere else). @param {string} s */
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
/** Escape for text nodes. @param {string} s */
const escapeText = (s) => String(s).replace(/[&<>]/g, (c) => ESC[c]);

/**
 * A link target the page may use: http(s) URLs with a host, or site-relative paths (`/fitness/...`, `#id`, `x/y`).
 * Other schemes (javascript:, data:, mailto: …), protocol-relative `//host`, backslashes and whitespace or control
 * characters (browsers strip them, which can hide a scheme) are refused → null. For Russian pages a root-relative page
 * path without the `/ru` prefix gets it (files and anchors stay as they are).
 * @param {string} raw @param {Lang} [lang] @returns {string | null}
 */
export function safeHref(raw, lang = "en") {
  const href = String(raw).trim();
  if (!href || /[\s\u0000-\u001f\u007f\\]/.test(href)) return null;
  if (/^https?:\/\/[^/?#]/i.test(href)) return href;
  if (href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  if (lang === "ru" && href.startsWith("/") && !/^\/ru(?:[/?#]|$)/.test(href)) {
    const path = href.split(/[?#]/)[0];
    const last = path.slice(path.lastIndexOf("/") + 1);
    if (!last.includes(".")) return href === "/" ? "/ru" : `/ru${href}`;
  }
  return href;
}

/* ------------------------------------------------------------------ inline */

const PUNCT = new Set("\\`*_{}[]()#+-.!|>~<\"'&$%,:;=?@^".split(""));
const SPACE = /\s/;
const ALNUM = /[\p{L}\p{N}]/u;

/** One citation group: "[n]", "[n, m]", "[n–m]" (ranges up to 20 numbers), not followed by "(" (that is a link). */
const CITE_AT = /\[(\d{1,3}(?:\s*[–-]\s*\d{1,3})?(?:\s*[,;]\s*\d{1,3}(?:\s*[–-]\s*\d{1,3})?)*)\](?!\()/y;
const CITE_ALL = /\[\d{1,3}(?:\s*[–-]\s*\d{1,3})?(?:\s*[,;]\s*\d{1,3}(?:\s*[–-]\s*\d{1,3})?)*\](?!\()/g;

/** "2, 5–7" → [2, 5, 6, 7]. @param {string} list */
function citeNumbers(list) {
  /** @type {number[]} */
  const out = [];
  for (const part of list.split(/[,;]/)) {
    const [a, b] = part.split(/[–-]/).map((x) => Number(x.trim()));
    if (b === undefined) out.push(a);
    else if (b >= a && b - a < 20) for (let n = a; n <= b; n++) out.push(n);
    else out.push(a, b);
  }
  return out;
}

/** Adjacent citation groups starting at `i` ("[2][5]" counts as one). @param {string} src @param {number} i */
function citationAt(src, i) {
  /** @type {number[]} */
  const ids = [];
  let end = i;
  for (;;) {
    CITE_AT.lastIndex = end;
    const m = CITE_AT.exec(src);
    if (!m) break;
    ids.push(...citeNumbers(m[1]));
    end = CITE_AT.lastIndex;
  }
  return ids.length ? { ids: [...new Set(ids)], end } : null;
}

/** @param {number[]} ids @param {Ctx} ctx */
function citeHtml(ids, ctx) {
  const label = ctx.lang === "ru" ? "Источник" : "Source";
  const links = ids.map((n) => {
    ctx.cites.add(n);
    const s = ctx.sources.get(n);
    const title = s ? ` title="${escapeHtml(s.year ? `${s.title} (${s.year})` : s.title || s.text)}"` : "";
    return `<a href="#src-${n}" aria-label="${label} ${n}"${title}>${n}</a>`;
  });
  return `<sup class="fit-cite">${links.join(", ")}</sup>`;
}

/** A code span opening at `i`: a run of n backticks closed by a run of exactly n. @param {string} src @param {number} i */
function codeSpanAt(src, i) {
  let n = 0;
  while (src[i + n] === "`") n++;
  let j = i + n;
  while (j < src.length) {
    if (src[j] !== "`") {
      j++;
      continue;
    }
    let r = 0;
    while (src[j + r] === "`") r++;
    if (r === n) {
      let code = src.slice(i + n, j).replace(/\n/g, " ");
      if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim()) code = code.slice(1, -1);
      return { code, end: j + r };
    }
    j += r;
  }
  return null;
}

/** Index of the "]" closing the "[" at `i` (nested brackets, escapes and code spans respected), or -1. @param {string} src @param {number} i */
function closingBracket(src, i) {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") j++;
    else if (c === "`") {
      const span = codeSpanAt(src, j);
      if (span) j = span.end - 1;
    } else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return j;
  }
  return -1;
}

/** Backslash escapes, which (as in CommonMark) only exist before ASCII punctuation. @param {string} s */
const unescapePunct = (s) => s.replace(/\\([!-/:-@[-`{-~])/g, "$1");

/**
 * `[text](destination "optional title")` at `i`. Destinations may hold balanced parentheses or use `<…>`.
 * @param {string} src @param {number} i @returns {{ text: string, dest: string, title: string, end: number } | null}
 */
function linkAt(src, i) {
  const close = closingBracket(src, i);
  if (close < 0 || src[close + 1] !== "(") return null;
  const text = src.slice(i + 1, close);
  if (!text.trim()) return null;
  let j = close + 2;
  while (src[j] === " ") j++;
  let dest = "";
  if (src[j] === "<") {
    const end = src.indexOf(">", j);
    if (end < 0) return null;
    dest = src.slice(j + 1, end);
    j = end + 1;
  } else {
    let depth = 0;
    const start = j;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "\\") j++;
      else if (SPACE.test(c)) break;
      else if (c === "(") depth++;
      else if (c === ")") {
        if (depth === 0) break;
        depth--;
      }
    }
    dest = unescapePunct(src.slice(start, j));
  }
  let title = "";
  while (src[j] === " ") j++;
  const q = src[j];
  if (q === '"' || q === "'") {
    let end = j + 1;
    while (end < src.length && src[end] !== q) end += src[end] === "\\" ? 2 : 1;
    if (end >= src.length) return null;
    title = unescapePunct(src.slice(j + 1, end));
    j = end + 1;
    while (src[j] === " ") j++;
  }
  if (src[j] !== ")") return null;
  return { text, dest, title, end: j + 1 };
}

/**
 * `*em*`, `**strong**`, `***both***` (or with `_`) opening at `i`. An opener is followed by a non-space; a closer is
 * the same-length run preceded by a non-space. `_` never opens or closes inside a word, so snake_case stays text.
 * @param {string} src @param {number} i @returns {{ n: number, inner: string, end: number } | null}
 */
function emphasisAt(src, i) {
  const ch = src[i];
  let n = 0;
  while (src[i + n] === ch) n++;
  if (n > 3) return null;
  const after = src[i + n];
  if (after === undefined || SPACE.test(after)) return null;
  if (ch === "_" && i > 0 && ALNUM.test(src[i - 1])) return null;
  let j = i + n;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === "`") {
      const span = codeSpanAt(src, j);
      j = span ? span.end : j + 1;
      continue;
    }
    if (c !== ch) {
      j++;
      continue;
    }
    let r = 0;
    while (src[j + r] === ch) r++;
    const prev = src[j - 1];
    const next = src[j + r];
    const closes = r === n && !SPACE.test(prev) && !(ch === "_" && next !== undefined && ALNUM.test(next));
    if (closes && j > i + n) return { n, inner: src.slice(i + n, j), end: j + r };
    j += r;
  }
  return null;
}

/**
 * Inline markdown → HTML. @param {string} src @param {Ctx} ctx @returns {string}
 */
function inline(src, ctx) {
  let out = "";
  let text = "";
  const flush = () => {
    if (text) out += escapeText(text);
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length && PUNCT.has(src[i + 1])) {
      text += src[i + 1];
      i += 2;
      continue;
    }
    if (c === "`") {
      const span = codeSpanAt(src, i);
      if (span) {
        flush();
        out += `<code>${escapeText(span.code)}</code>`;
        i = span.end;
        continue;
      }
      let j = i;
      while (src[j] === "`") j++;
      text += src.slice(i, j);
      i = j;
      continue;
    }
    if (c === "[") {
      const cite = citationAt(src, i);
      if (cite) {
        flush();
        out += citeHtml(cite.ids, ctx);
        i = cite.end;
        continue;
      }
      const link = ctx.links ? linkAt(src, i) : null;
      if (link) {
        flush();
        const label = inline(link.text, { ...ctx, links: false });
        const href = safeHref(link.dest, ctx.lang);
        if (!href) out += label;
        else {
          const external = /^https?:/i.test(href) ? ' rel="noopener noreferrer" target="_blank"' : "";
          const title = link.title ? ` title="${escapeHtml(link.title)}"` : "";
          out += `<a href="${escapeHtml(href)}"${title}${external}>${label}</a>`;
        }
        i = link.end;
        continue;
      }
    }
    if (c === "*" || c === "_") {
      const em = emphasisAt(src, i);
      if (em) {
        flush();
        const inner = inline(em.inner, ctx);
        out += em.n === 1 ? `<em>${inner}</em>` : em.n === 2 ? `<strong>${inner}</strong>` : `<strong><em>${inner}</em></strong>`;
        i = em.end;
        continue;
      }
      let j = i;
      while (src[j] === c) j++;
      text += src.slice(i, j);
      i = j;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ plain text, slugs, counts */

/** @type {Record<string, string>} */
const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** @param {Lang} [lang] @returns {Ctx} */
const scratchCtx = (lang = "en") => ({ lang, sources: new Map(), cites: new Set(), used: new Set(), toc: [], links: true });

/**
 * Inline markdown → plain text: formatting, link targets and citation markers removed.
 * @param {string} md
 */
export function plainText(md) {
  return inline(String(md).replace(CITE_ALL, ""), scratchCtx())
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e])
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heading text → id: lower case, runs of anything but letters and digits → "-" (Cyrillic stays Cyrillic).
 * @param {string} text
 */
export function slugify(text) {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
}

/** Ids the article page uses itself; a heading never takes them. @param {string} id */
const reserved = (id) => /^src-\d+$/.test(id) || id === "sources" || id === "contents";

/** @param {string} base @param {Set<string>} used */
function uniqueId(base, used) {
  let id = base;
  for (let k = 2; used.has(id) || reserved(id); k++) id = `${base}-${k}`;
  used.add(id);
  return id;
}

/**
 * Words in a markdown body: whitespace-separated tokens that contain a letter or a digit, after citation markers and
 * link targets are removed (table rules, list markers and lone symbols do not count).
 * @param {string} body
 */
export function wordCount(body) {
  return String(body)
    .replace(CITE_ALL, " ")
    .replace(/\]\((?:[^()\s]|\([^()\s]*\))*\)/g, "] ")
    .split(/\s+/)
    .filter((w) => ALNUM.test(w)).length;
}

/* ------------------------------------------------------------------ blocks */

const BLANK = /^\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})[^`]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*)|[ \t]*$)/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

/** @param {string} line */
const isBlank = (line) => BLANK.test(line);
/** @param {string} line */
const indentOf = (line) => line.length - line.trimStart().length;

/** @param {string} line @returns {{ indent: number, ordered: boolean, start: number, content: string } | null} */
function listItem(line) {
  if (RULE.test(line)) return null;
  const m = ITEM.exec(line);
  if (!m) return null;
  const ordered = /\d/.test(m[2]);
  return { indent: m[1].length, ordered, start: ordered ? Number.parseInt(m[2], 10) : 1, content: (m[3] ?? "").trim() };
}

/**
 * Cells of a table row: leading/trailing pipes dropped, split on pipes that are not escaped (`\|` stays a pipe).
 * @param {string} line
 */
function cells(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  /** @type {string[]} */
  const out = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "\\|";
      i++;
    } else if (s[i] === "|") {
      out.push(cur.trim());
      cur = "";
    } else cur += s[i];
  }
  out.push(cur.trim());
  return out;
}

/** A table starts here: a row with a pipe followed by an alignment row with the same number of cells. @param {string[]} lines @param {number} i */
function tableAt(lines, i) {
  const head = lines[i];
  const rule = lines[i + 1];
  if (!head.includes("|") || rule === undefined || !TABLE_RULE.test(rule) || !rule.includes("-")) return false;
  if (!rule.includes("|") && !head.trim().startsWith("|")) return false;
  return cells(head).length === cells(rule).length;
}

/** Does this line start a block other than a paragraph? @param {string[]} lines @param {number} i */
function startsBlock(lines, i) {
  const line = lines[i];
  if (FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || tableAt(lines, i)) return true;
  const item = listItem(line);
  // a list interrupts a paragraph only with a bullet or "1." (so "2026. was…" inside a paragraph stays text)
  return Boolean(item && item.content && (!item.ordered || item.start === 1));
}

/** @param {string[]} lines @param {number} i @param {Ctx} ctx */
function table(lines, i, ctx) {
  const head = cells(lines[i]);
  const align = cells(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "c" : c.endsWith(":") ? "r" : ""));
  const cls = (/** @type {number} */ k) => (align[k] ? ` class="al-${align[k]}"` : "");
  /** @type {string[][]} */
  const rows = [];
  let j = i + 2;
  while (j < lines.length && !isBlank(lines[j]) && lines[j].includes("|")) {
    const row = cells(lines[j]);
    rows.push(head.map((_, k) => row[k] ?? ""));
    j++;
  }
  const label = `${ctx.lang === "ru" ? "Таблица" : "Table"}: ${head.map(plainText).filter(Boolean).join(", ")}`;
  const thead = `<tr>${head.map((h, k) => `<th scope="col"${cls(k)}>${inline(h, ctx)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((c, k) => `<td${cls(k)}>${inline(c, ctx)}</td>`).join("")}</tr>`).join("");
  return {
    html: `<div class="fit-table" role="region" tabindex="0" aria-label="${escapeHtml(label)}"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`,
    end: j,
  };
}

/**
 * A list with at most one nested level (deeper items join the nested list). Blank lines between items keep the list
 * going; continuation lines join the current item.
 * @param {string[]} lines @param {number} i @param {Ctx} ctx
 */
function list(lines, i, ctx) {
  const first = /** @type {NonNullable<ReturnType<typeof listItem>>} */ (listItem(lines[i]));
  const base = first.indent;
  /** @typedef {{ text: string[], kids: { ordered: boolean, start: number, items: string[][] } | null }} Item */
  /** @type {Item[]} */
  const items = [];
  let j = i;
  while (j < lines.length) {
    const line = lines[j];
    if (isBlank(line)) {
      let k = j + 1;
      while (k < lines.length && isBlank(lines[k])) k++;
      const next = k < lines.length ? listItem(lines[k]) : null;
      const sameList = next && (next.indent >= base + 2 || next.ordered === first.ordered);
      const continues = !next && k < lines.length && indentOf(lines[k]) >= base + 2 && items.length > 0;
      if (sameList || continues) {
        j = k;
        continue;
      }
      break;
    }
    const item = listItem(line);
    if (item && item.indent < base + 2) {
      if (item.ordered !== first.ordered) break;
      items.push({ text: [item.content], kids: null });
      j++;
      continue;
    }
    const cur = items[items.length - 1];
    if (item && cur) {
      cur.kids ??= { ordered: item.ordered, start: item.start, items: [] };
      cur.kids.items.push([item.content]);
      j++;
      continue;
    }
    if (cur && (indentOf(line) >= base + 2 || !startsBlock(lines, j))) {
      const kids = cur.kids?.items;
      if (kids && kids.length && indentOf(line) >= base + 4) kids[kids.length - 1].push(line.trim());
      else cur.text.push(line.trim());
      j++;
      continue;
    }
    break;
  }
  /** @param {boolean} ordered @param {number} start */
  const open = (ordered, start) => (ordered ? (start !== 1 ? `<ol start="${start}">` : "<ol>") : "<ul>");
  const body = items.map((it) => {
    const kids = it.kids
      ? `${open(it.kids.ordered, it.kids.start)}${it.kids.items.map((k) => `<li>${inline(k.join("\n"), ctx)}</li>`).join("")}${it.kids.ordered ? "</ol>" : "</ul>"}`
      : "";
    return `<li>${inline(it.text.join("\n"), ctx)}${kids}</li>`;
  }).join("");
  return { html: `${open(first.ordered, first.start)}${body}${first.ordered ? "</ol>" : "</ul>"}`, end: j };
}

/** Block-level markdown → HTML. @param {string[]} lines @param {Ctx} ctx */
function blocks(lines, ctx) {
  /** @type {string[]} */
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const mark = fence[1];
      /** @type {string[]} */
      const code = [];
      i++;
      while (i < lines.length && !(lines[i].trim().startsWith(mark) && /^[`~]+$/.test(lines[i].trim()))) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeText(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const raw = (heading[2] ?? "").trim();
      const text = plainText(raw);
      const id = uniqueId(slugify(text), ctx.used);
      if (level === 2 || level === 3) ctx.toc.push({ id, text, level });
      out.push(`<h${level} id="${escapeHtml(id)}">${inline(raw, ctx)}</h${level}>`);
      i++;
      continue;
    }
    if (RULE.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      /** @type {string[]} */
      const inner = [];
      while (i < lines.length && !isBlank(lines[i]) && (QUOTE.test(lines[i]) || !startsBlock(lines, i))) {
        inner.push(lines[i].replace(/^ {0,3}> ?/, ""));
        i++;
      }
      out.push(`<div class="fit-callout" role="note">${blocks(inner, ctx)}</div>`);
      continue;
    }
    if (tableAt(lines, i)) {
      const t = table(lines, i, ctx);
      out.push(t.html);
      i = t.end;
      continue;
    }
    if (listItem(line)) {
      const l = list(lines, i, ctx);
      out.push(l.html);
      i = l.end;
      continue;
    }
    /** @type {string[]} */
    const para = [line.trim()];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join("\n"), ctx)}</p>`);
  }
  return out.join("\n");
}

/**
 * Body markdown (no front matter) → `{ html, toc, cites }`. `cites` lists every source number the body cites.
 * @param {string} body @param {{ lang?: Lang, sources?: Source[] }} [opts]
 * @returns {{ html: string, toc: TocItem[], cites: number[] }}
 */
export function renderBody(body, { lang = "en", sources = [] } = {}) {
  /** @type {Ctx} */
  const ctx = { lang, sources: new Map(sources.map((s) => [s.n, s])), cites: new Set(), used: new Set(), toc: [], links: true };
  const lines = String(body).replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const html = blocks(lines, ctx);
  return { html, toc: ctx.toc, cites: [...ctx.cites].sort((a, b) => a - b) };
}

/* ------------------------------------------------------------------ front matter */

/**
 * "[n] Title — Outlet, year. URL" → Source. The last " — " splits title from outlet (titles may contain dashes); the
 * URL is the last token when it is http(s). Null when the line has no "[n]".
 * @param {string} line @returns {Source | null}
 */
export function parseSource(line) {
  const m = /^\[(\d+)\]\s+(.+)$/.exec(String(line).trim());
  if (!m) return null;
  let rest = m[2].trim();
  let url = null;
  const u = /(?:^|\s)(https?:\/\/\S+)$/.exec(rest);
  if (u) {
    url = u[1];
    rest = rest.slice(0, u.index).trim();
  }
  let title = rest.replace(/\.$/, "");
  let outlet = "";
  let year = "";
  const dash = rest.lastIndexOf(" — ");
  if (dash > 0) {
    title = rest.slice(0, dash).trim();
    const tail = rest.slice(dash + 3).trim().replace(/\.$/, "");
    const y = /^(.*?)[,\s]+(\d{4}[a-z]?)$/.exec(tail);
    if (y) {
      outlet = y[1].trim();
      year = y[2];
    } else outlet = tail;
  }
  return { n: Number(m[1]), text: rest, title, outlet, year, url };
}

/** @param {string} v */
const unquote = (v) => (/^(["']).*\1$/.test(v) ? v.slice(1, -1) : v);

/**
 * Split a topic file into its front matter and body. Problems (missing keys, bad dates, sources out of sequence)
 * are listed in `errors`; the page still renders.
 * @param {string} text @returns {{ meta: TopicMeta, body: string, errors: string[] }}
 */
export function parseFrontMatter(text) {
  const src = String(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  /** @type {TopicMeta} */
  const meta = { title: "", description: "", updated: "", order: 0, sources: [] };
  /** @type {string[]} */
  const errors = [];
  const fm = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
  if (!fm) return { meta, body: src, errors: ["no front matter"] };
  let key = "";
  let order = "";
  for (const raw of fm[1].split("\n")) {
    if (isBlank(raw)) continue;
    const item = /^\s*-\s+(.*)$/.exec(raw);
    if (item) {
      const s = key === "sources" ? parseSource(item[1]) : null;
      if (s) meta.sources.push(s);
      else errors.push(`unexpected list item: ${item[1].slice(0, 60)}`);
      continue;
    }
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/.exec(raw);
    if (!kv) {
      errors.push(`unreadable line: ${raw.slice(0, 60)}`);
      continue;
    }
    key = kv[1];
    const value = unquote(kv[2]);
    if (key === "title") meta.title = value;
    else if (key === "description") meta.description = value;
    else if (key === "updated") meta.updated = value;
    else if (key === "order") order = value;
    else if (key === "sources") {
      if (value) errors.push("sources must be a list of lines");
    } else errors.push(`unknown key: ${key}`);
  }
  meta.order = order === "" ? 0 : Number(order);
  if (!meta.title) errors.push("missing title");
  if (!meta.description) errors.push("missing description");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.updated) || Number.isNaN(Date.parse(meta.updated))) errors.push("updated must be YYYY-MM-DD");
  if (!Number.isInteger(meta.order) || order === "") errors.push("order must be an integer");
  meta.sources.forEach((s, k) => {
    if (s.n !== k + 1) errors.push(`source [${s.n}] is out of sequence (expected [${k + 1}])`);
  });
  return { meta, body: src.slice(fm[0].length), errors };
}

/**
 * A whole topic file → `{ meta, html, toc, errors }`. `errors` adds citations that have no source to the front-matter
 * problems.
 * @param {string} text @param {{ lang?: Lang }} [opts]
 * @returns {{ meta: TopicMeta, html: string, toc: TocItem[], errors: string[], body: string }}
 */
export function renderMarkdown(text, { lang = "en" } = {}) {
  const { meta, body, errors } = parseFrontMatter(text);
  const { html, toc, cites } = renderBody(body, { lang, sources: meta.sources });
  const known = new Set(meta.sources.map((s) => s.n));
  for (const n of cites) if (!known.has(n)) errors.push(`citation [${n}] has no source`);
  return { meta, html, toc, errors, body };
}
