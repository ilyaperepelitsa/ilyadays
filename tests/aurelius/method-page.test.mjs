import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The method page (public/apps/stoic-method.html) explains how the Stoic Constitution was made, in English and Russian.
// It is hand-written, so these tests tie it to the published record: every section in both languages, every link and
// file it names present, every number marked data-n equal to the number computed here from the published JSON, and every
// example (data-quote, data-src) word for word what the record holds in that language.
const ROOT = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, ROOT), 'utf8');
const json = (path) => JSON.parse(read(path));
const exists = (path) => fs.existsSync(new URL(path, ROOT));

const html = read('public/apps/stoic-method.html');
const EN_START = html.indexOf('<div class="en" lang="en">');
const RU_START = html.indexOf('<div class="ru" lang="ru">');
const MAIN_END = html.indexOf('</main>');
const blocks = {en: html.slice(EN_START, RU_START), ru: html.slice(RU_START, MAIN_END)};

const text = (fragment) => fragment.replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();
// The inner HTML of every element that carries the attribute, with its value. Elements of this page that carry these
// attributes never nest an element of the same tag.
const marked = (block, attribute) => [...block.matchAll(new RegExp(`<(\\w+)[^>]*\\s${attribute}="([^"]+)"[^>]*>([\\s\\S]*?)</\\1>`, 'g'))]
  .map((m) => ({value: m[2], inner: m[3]}));

// The published record, English and Russian: the index and its chapter files joined.
const load = (lang) => {
  const index = json(lang === 'ru' ? 'public/apps/stoic-constitution.ru.json' : 'public/apps/stoic-constitution.json');
  const full = new Map();
  for (const chapter of new Set(index.articles.map((a) => a.chapter))) {
    const file = json(`public/apps/stoic-constitution/${lang === 'ru' ? 'ru/' : ''}${chapter}.json`);
    for (const article of file.articles) full.set(article.number, article);
  }
  return {index, articles: index.articles.map((a) => full.get(a.number))};
};
const record = {en: load('en'), ru: load('ru')};

// The numbers the page may quote, computed from the English record (the Russian has the same structure; checked below).
const expected = (() => {
  const {index, articles} = record.en;
  const sum = (f) => articles.reduce((n, a) => n + f(a), 0);
  const seneca = (a) => a.voices.seneca;
  const pieces = (a) => new Set(seneca(a).items.flatMap((it) => [...(it.piece ? [it.piece.id] : []), ...(it.support || []).map((s) => s.id)]));
  const amends = articles.flatMap((a) => seneca(a).amend || []);
  const refs = new Set(articles.flatMap((a) => seneca(a).passages.map((p) => p.ref)));
  const filled = (key) => articles.filter((a) => a.groups.find((g) => g.key === key).items.length > 0).length;
  const stayed = sum((a) => a.in_translation.stayed);
  return {
    passages: index.method.passage_count,
    dims: Number(index.method.input.match(/(\d+)-dimensional/)[1]),
    chapters: index.chapters.length,
    sections: index.chapters.reduce((n, c) => n + c.sections.length, 0),
    articles: index.articles.length,
    claims: sum((a) => a.claims.length),
    single: sum((a) => a.single.length),
    sources: index.articles.reduce((n, a) => n + a.counts.sources, 0),
    inferences: sum((a) => (a.statement.inferences || []).length + a.claims.reduce((n, c) => n + (c.inferences || []).length, 0)),
    unfused: articles.filter((a) => a.unfused).length,
    'seneca-items': sum((a) => seneca(a).items.length),
    'seneca-backs': sum((a) => seneca(a).counts.stronger),
    'seneca-adds': sum((a) => seneca(a).counts.wider),
    'seneca-limits': sum((a) => seneca(a).counts.qualified),
    'seneca-pieces': new Set(articles.flatMap((a) => [...pieces(a)])).size,
    'seneca-uses': sum((a) => pieces(a).size),
    'seneca-sections': refs.size,
    letters: new Set([...refs].map((ref) => ref.match(/^Ep\. (\d+)\./)[1])).size,
    'seneca-corpus': index.authors[0].passages,
    'seneca-letters-all': index.authors[0].units,
    clauses: amends.length,
    'clauses-adds': amends.filter((c) => c.kind === 'adds').length,
    'clauses-limits': amends.filter((c) => c.kind === 'limits').length,
    'clauses-challenges': amends.filter((c) => c.kind === 'challenges').length,
    'fill-why': filled('why'), 'fill-action': filled('action'), 'fill-practice': filled('practice'),
    'fill-breaks': filled('breaks'), 'fill-doubt': filled('doubt'),
    stayed, moved: sum((a) => a.in_translation.of) - stayed,
  };
})();

test('the method page has both languages, with the same sections in the same order and a contents list for each', () => {
  assert.ok(EN_START > 0 && RU_START > EN_START && MAIN_END > RU_START, 'an English block, then a Russian block, inside <main>');
  const sections = {};
  for (const [lang, block] of Object.entries(blocks)) {
    const found = [...block.matchAll(/<section class="step" id="([^"]+)" data-step="([^"]+)"/g)].map((m) => ({id: m[1], step: m[2]}));
    assert.ok(found.length >= 12, `${lang}: ${found.length} sections`);
    for (const {id, step} of found) assert.equal(id, lang === 'ru' ? `ru-${step}` : step, `${lang}: section id ${id}`);
    sections[lang] = found.map((s) => s.step);
    const toc = block.slice(block.indexOf('<nav class="toc"'), block.indexOf('</nav>', block.indexOf('<nav class="toc"')));
    assert.deepEqual([...toc.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]), found.map((s) => s.id), `${lang}: the contents list every section in order`);
    for (const {id} of found) {
      const body = block.slice(block.indexOf(`id="${id}"`), block.indexOf('</section>', block.indexOf(`id="${id}"`)));
      assert.ok(text(body).length > 200, `${lang}: section ${id} has text`);
    }
  }
  assert.deepEqual(sections.ru, sections.en, 'the Russian has every English section, in the same order');
  for (const step of ['sources', 'vectors', 'clusters', 'names', 'fusion', 'sides', 'prompt', 'checks', 'seneca', 'translation', 'review', 'open']) {
    assert.ok(sections.en.includes(step), `the page explains ${step}`);
  }
  // The Russian block is in Russian: no long English sentence outside quotations, code and file names.
  assert.ok((text(blocks.ru).match(/[а-яё]/gi) || []).length > 20000, 'the Russian block is written in Russian');
});

test('the method page uses the shared site header and follows the Constitution page’s language key', () => {
  assert.match(html, /<body[^>]*>\n<script src="\/apps\/site-chrome\.js"><\/script>/);
  assert.ok(html.indexOf('href="/apps/site-chrome.css"') < html.indexOf('<style>'));
  assert.match(html, /stoic-constitution:lang/, 'the stored choice of the Stoic pages');
  assert.match(html, /\[data-lang=ru\] \.en,:root:not\(\[data-lang=ru\]\) \.ru\{display:none!important\}/, 'one language shows at a time');
});

test('every link on the method page resolves', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) assert.ok(ids.has(m[1]), `aria-labelledby ${m[1]}`);
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.ok(hrefs.length > 80, `${hrefs.length} links`);
  const github = 'https://github.com/ilyaperepelitsa/ilyadays/blob/main/';
  for (const href of hrefs) {
    if (href === 'data:,') continue;   // the empty favicon
    if (href.startsWith('#')) { assert.ok(ids.has(href.slice(1)), `anchor ${href}`); continue; }
    if (href.startsWith(github)) { assert.ok(exists(href.slice(github.length)), `GitHub link to a file that is not in the repository: ${href}`); continue; }
    assert.ok(!/^[a-z]+:/i.test(href), `only GitHub links leave the site: ${href}`);
    const path = href.split(/[?#]/)[0];
    if (path === '/' || path === '') continue;
    const file = path.startsWith('/') ? `public${path}` : `public/apps/${path}`;
    assert.ok(exists(file), `${href} → ${file}`);
    const hash = href.split('#')[1];
    if (hash && path.endsWith('stoic-constitution.html')) {
      const n = Number((hash.match(/^article-(\d+)$/) || [])[1]);
      assert.ok(record.en.index.articles.some((a) => a.number === n), `${href}: no such article`);
    }
  }
  assert.ok(!html.includes('.aurelius/'), 'nothing points into the private folder');
});

test('the Constitution page and the book reader link to the method page', () => {
  assert.match(read('public/apps/stoic-constitution.html'), /<a href="stoic-method\.html">/);
  assert.match(read('public/apps/stoic-constitution.html'), /<a href="stoic-method\.html\?lang=ru">/, 'and in its Russian words');
  assert.match(read('src/components/aurelius/BookReader.tsx'), /\/apps\/stoic-method\.html\?lang=\$\{lang\}/);
});

test('every number marked on the method page is the published one, in both languages', () => {
  for (const [lang, block] of Object.entries(blocks)) {
    const marks = marked(block, 'data-n');
    assert.ok(marks.length > 40, `${lang}: ${marks.length} marked numbers`);
    for (const {value, inner} of marks) {
      assert.ok(value in expected, `${lang}: unknown data-n="${value}"`);
      assert.equal(Number(text(inner).replace(/\D/g, '')), expected[value], `${lang}: data-n="${value}" says ${text(inner)}`);
    }
    for (const key of ['passages', 'chapters', 'sections', 'articles', 'claims', 'single', 'seneca-pieces', 'seneca-items', 'seneca-sections', 'letters', 'clauses']) {
      assert.ok(marks.some((m) => m.value === key), `${lang}: the page states ${key}`);
    }
  }
  // The Russian record has the same shape, so the same numbers hold for it.
  assert.equal(record.ru.articles.length, expected.articles);
  assert.equal(record.ru.articles.reduce((n, a) => n + a.claims.length, 0), expected.claims);
  assert.equal(record.ru.articles.reduce((n, a) => n + a.voices.seneca.items.length, 0), expected['seneca-items']);
  // The chapter diagram has one division per section, and the Seneca table one row per article.
  for (const [lang, block] of Object.entries(blocks)) {
    const bars = block.slice(block.indexOf('<svg class="bars"'), block.indexOf('</svg>', block.indexOf('<svg class="bars"')));
    assert.equal((bars.match(/<rect /g) || []).length, expected.sections, `${lang}: sections drawn`);
    const titles = record[lang].index.chapters.map((c) => c.title);
    for (const title of titles) assert.ok(text(bars).includes(text(title)), `${lang}: chapter “${title}” in the diagram`);
    assert.equal((block.match(/<tr><td><a href="stoic-constitution\.html\?[^"]*#article-\d+">/g) || []).length, expected.articles, `${lang}: Seneca table rows`);
  }
});

test('the examples on the method page are the published words, in each language', () => {
  const quoteOf = (article, id) => {
    for (const claim of article.claims) for (const s of claim.support) if (s.id === id) return s.quote;
    for (const s of article.single) if (s.id === id) return s.quote;
    for (const it of article.voices.seneca.items) {
      if (it.piece && it.piece.id === id) return it.piece.quote;
      for (const s of it.support || []) if (s.id === id) return s.quote;
    }
    return undefined;
  };
  for (const [lang, block] of Object.entries(blocks)) {
    const byNumber = new Map(record[lang].articles.map((a) => [a.number, a]));
    const quotes = marked(block, 'data-quote');
    assert.ok(quotes.length >= 7, `${lang}: ${quotes.length} quotes`);
    for (const {value, inner} of quotes) {
      const [number, id] = value.split(':');
      assert.equal(text(inner), quoteOf(byNumber.get(Number(number)), id), `${lang}: quote ${value}`);
    }
    const sources = marked(block, 'data-src');
    assert.ok(sources.length >= 5, `${lang}: ${sources.length} example sentences`);
    for (const {value, inner} of sources) {
      const [number, part] = value.split(':');
      const article = byNumber.get(Number(number));
      const shown = text(inner.replace(/<span class="tag">[\s\S]*?<\/span>/g, ''));
      if (part === 'statement') assert.equal(shown, article.statement.t, `${lang}: statement of ${number}`);
      else if (part === 'amend') {
        const clause = article.voices.seneca.amend.find((c) => c.target === 'statement');
        assert.equal(shown, article.statement.t.replace(/\.$/, '') + clause.t, `${lang}: Seneca’s clause on the statement of ${number}`);
      } else assert.equal(shown, article.claims.find((c) => c.id === part).t, `${lang}: claim ${part} of ${number}`);
    }
  }
});
