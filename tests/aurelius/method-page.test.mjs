import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The method page (public/apps/stoic-method.html) is a paper on how the Stoic Constitution was made, in English and Russian.
// Its figures are drawn by others between <!-- figure:<id> --> markers; the text is hand-written, so these tests tie it to the published record: every section in both languages, every link and
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
    ...settlement(),
    ...measured(),
    // the checks figure (Figure 8): every quote of Marcus, and the passage revisions of the three translations
    'quotes-marcus': sum((a) => a.claims.reduce((n, c) => n + c.support.length, 0) + a.single.length),
    revisions: ['project-v1', 'seneca-v1', 'ru-v1'].reduce((n, name) => n + json(`content/aurelius/translation/${name}.json`).passages.length, 0),
  };
})();

// Measurements quoted in the text: the clustering comparison, the similarity medians and Article 1's section.
function measured() {
  const {index, articles} = record.en;
  const f3 = (x) => x.toFixed(3);
  const out = {'silhouette-ward': f3(index.method.comparison.ward.cosine_silhouette), 'cmp-average-first': index.method.comparison.average.sizes[0]};
  for (const [m, c] of Object.entries(index.method.comparison)) {
    out[`cmp-${m}-sizes`] = c.sizes.join(', ');
    out[`cmp-${m}-largest`] = f3(c.largest_fraction);
    out[`cmp-${m}-silhouette`] = f3(c.cosine_silhouette);
  }
  const median = index.authors[0].median_similarity;
  Object.assign(out, {'median-marcus': f3(median.marcus_to_marcus), 'median-seneca': f3(median.seneca_to_seneca), 'median-across': f3(median.across)});
  const one = articles.find((a) => a.number === 1);
  const at = (ref) => one.map.refs.indexOf(ref);
  const pair = one.map.sim[at('9.7')][at('7.10')];
  Object.assign(out, {
    'a1-pair': f3(pair), 'a1-angle': Math.round(Math.acos(pair) * 180 / Math.PI),
    'a1-lowest': f3(one.map.lowest), 'a1-highest': f3(one.map.highest), 'a1-stress': f3(one.map.stress),
    'a1-closeness': f3(one.section_closeness), 'a1-closeness-new': f3(one.in_translation.closeness),
    'a1-stayed': one.in_translation.stayed, 'a1-of': one.in_translation.of,
  });
  out.schema = json('content/aurelius/constitution.json').schema_version;
  const prompt = read('apps/aurelius/prompts/constitution-article.md');
  out.rules = (prompt.slice(prompt.indexOf('## Rules learned from review')).match(/^\d+\. \*\*/gm) || []).length;
  return out;
}

// How the translations were settled, counted from the stored records: each point a second reader raised (or the settler
// found itself, “Found while settling”) carries a decision that opens with Accepted, Partly accepted or Declined.
function settlement() {
  const store = (name) => json(`content/aurelius/translation/${name}.json`);
  const kind = (decided) => (/^Partly accepted/.test(decided) ? 'partly' : /^Accepted/.test(decided) ? 'accepted' : /^Declined/.test(decided) ? 'declined' : 'free');
  const out = {};
  for (const [prefix, name] of [['greek', 'project-v1'], ['latin', 'seneca-v1']]) {
    const record = store(name);
    const points = record.passages.flatMap((p) => p.check);
    out[`${prefix}-settled`] = points.length;
    for (const k of ['accepted', 'partly', 'declined', 'free']) out[`${prefix}-${k}`] = points.filter((x) => kind(x.decided) === k).length;
    out[`${prefix}-found`] = points.filter((x) => x.note.startsWith('Found while settling')).length;
    out[`${prefix}-notes`] = record.passages.reduce((n, p) => n + p.notes.length, 0);
    // Notes that say they rest on memory: “(from memory, unchecked)” closing a note, or “From memory, unchecked:” opening a sentence.
    const marked = (x) => /from memory, unchecked/i.test(x.note);
    out[`${prefix}-memory`] = record.passages.flatMap((p) => p.notes).filter(marked).length;
    out[`${prefix}-memory-passages`] = record.passages.filter((p) => p.notes.some(marked)).length;
    out[`${prefix}-memory-bracket`] = record.passages.flatMap((p) => p.notes).filter((x) => x.note.includes('from memory, unchecked')).length;
    out[`${prefix}-memory-lead`] = record.passages.flatMap((p) => p.notes).filter((x) => x.note.includes('From memory, unchecked')).length;
  }
  out['seneca-translated'] = store('seneca-v1').passages.length;
  const ru = store('ru-v1');
  const decisions = ru.passages.flatMap((p) => p.decisions);
  out['ru-passages'] = ru.passages.length;
  out['ru-settled'] = decisions.length;
  for (const k of ['accepted', 'partly', 'declined']) out[`ru-${k}`] = decisions.filter((d) => kind(d) === k).length;
  return out;
}

const SECTIONS = ['abstract', 'introduction', 'materials', 'methods', 'm-embedding', 'm-clustering', 'm-naming', 'm-fusion', 'm-sides',
  'm-seneca', 'm-translation', 'm-prompting', 'validation', 'results', 'limitations', 'conclusion', 'references',
  'appendix-a', 'appendix-b', 'appendix-c'];
const FIGURES = ['pipeline', 'embedding', 'dendrogram', 'fusion', 'sides', 'seneca', 'translation', 'checks'];
const prefix = (lang) => (lang === 'ru' ? 'ru-' : '');
// Numbered figures and tables of one language, in document order: {id, kind, number, body}.
const numbered = (lang, block) => {
  const words = lang === 'ru' ? {fig: 'Рис\\.', tab: 'Таблица'} : {fig: 'Figure', tab: 'Table'};
  return [...block.matchAll(/<figure class="(fig|tab)" id="([^"]+)">([\s\S]*?)<\/figure>/g)].map((m) => {
    const caption = m[3].match(new RegExp(`<figcaption><b>${words[m[1]]} (\\d+)\\.</b>`));
    return {kind: m[1], id: m[2], number: caption ? Number(caption[1]) : NaN, body: m[3]};
  });
};

test('the method page is a paper with the same numbered sections in both languages and a contents list for each', () => {
  assert.ok(EN_START > 0 && RU_START > EN_START && MAIN_END > RU_START, 'an English block, then a Russian block, inside <main>');
  for (const [lang, block] of Object.entries(blocks)) {
    const found = [...block.matchAll(/\sid="([^"]+)" data-sec="([^"]+)"/g)].map((m) => ({id: m[1], sec: m[2]}));
    assert.deepEqual(found.map((s) => s.sec), SECTIONS, `${lang}: the paper's sections in order`);
    for (const {id, sec} of found) assert.equal(id, prefix(lang) + sec, `${lang}: section id ${id}`);
    const toc = block.slice(block.indexOf('<nav class="toc"'), block.indexOf('</nav>', block.indexOf('<nav class="toc"')));
    assert.deepEqual([...toc.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]), found.map((s) => s.id), `${lang}: the contents list every section in order`);
    for (const {id} of found.filter((s) => !s.sec.startsWith('m') || s.sec !== 'methods')) {
      const at = block.indexOf(`id="${id}"`);
      assert.ok(text(block.slice(at, at + 4000)).length > 200, `${lang}: section ${id} has text`);
    }
    // Numbered headings: 1 Introduction … 7 Conclusion, and 3.1 … 3.8 under Methods.
    const numbers = [...block.matchAll(/<h[23][^>]*><span class="sn">([\d.]+)<\/span>/g)].map((m) => m[1]);
    for (const n of ['1', '2', '3', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '4', '5', '6', '7']) assert.ok(numbers.includes(n), `${lang}: heading ${n}`);
  }
  // The Russian block is in Russian.
  assert.ok((text(blocks.ru).match(/[а-яё]/gi) || []).length > 25000, 'the Russian block is written in Russian');
});

test('figures and tables are numbered in order, marked for the diagrams, and cross-referenced correctly in both languages', () => {
  const ids = {};
  for (const [lang, block] of Object.entries(blocks)) {
    const items = numbered(lang, block);
    for (const kind of ['fig', 'tab']) {
      const list = items.filter((i) => i.kind === kind);
      assert.deepEqual(list.map((i) => i.number), list.map((_, n) => n + 1), `${lang}: ${kind} numbers run 1, 2, 3 … in order`);
      for (const i of list) assert.ok(i.id.startsWith(`${prefix(lang)}${kind}-`), `${lang}: ${i.id}`);
    }
    const figures = items.filter((i) => i.kind === 'fig');
    const figIds = figures.map((i) => i.id.slice(prefix(lang).length + 4));
    for (const id of FIGURES) assert.ok(figIds.includes(id), `${lang}: Figure “${id}” is present`);
    for (const f of figures) {
      const id = f.id.slice(prefix(lang).length + 4);
      assert.match(f.body, new RegExp(`<!-- figure:${id} -->[\\s\\S]*<!-- /figure:${id} -->`), `${lang}: markers for ${id}`);
    }
    ids[lang] = items.map((i) => i.id.slice(prefix(lang).length));
    assert.ok(items.filter((i) => i.kind === 'tab').length >= 12, `${lang}: tables`);
    // Every cross-reference names the number of the figure or table it points to.
    const byId = new Map(items.map((i) => [i.id, i.number]));
    const xrefs = [...block.matchAll(/<a class="xref" href="#([^"]+)">([^<]+)<\/a>/g)];
    assert.ok(xrefs.length >= 20, `${lang}: ${xrefs.length} cross-references`);
    for (const [, target, label] of xrefs) {
      assert.ok(byId.has(target), `${lang}: cross-reference to ${target}`);
      assert.equal(Number(label.replace(/\D/g, '')), byId.get(target), `${lang}: “${label}” points to ${target}`);
    }
    for (const i of items) assert.ok(xrefs.some((x) => x[1] === i.id) || i.id.endsWith('tab-files') || i.id.endsWith('tab-glossary'), `${lang}: ${i.id} is referred to in the text`);
  }
  assert.deepEqual(ids.ru, ids.en, 'the same figures and tables in both languages');
});

test('the references are real works, each cited, and every citation resolves', () => {
  for (const [lang, block] of Object.entries(blocks)) {
    const refs = [...block.matchAll(/<li id="((?:ru-)?ref-[^"]+)">\[(\d+)\]/g)].map((m) => ({id: m[1], n: Number(m[2])}));
    assert.deepEqual(refs.map((r) => r.n), refs.map((_, i) => i + 1), `${lang}: references numbered in order`);
    for (const key of ['casaubon', 'leopold', 'gummere', 'latin', 'ward', 'rousseeuw', 'openai', 'kruskal', 'scipy', 'sklearn']) {
      assert.ok(refs.some((r) => r.id === `${prefix(lang)}ref-${key}`), `${lang}: reference ${key}`);
    }
    const cites = [...block.matchAll(/<a class="cite" href="#([^"]+)">\[(\d+)\]<\/a>/g)];
    for (const [, target, n] of cites) {
      const ref = refs.find((r) => r.id === target);
      assert.ok(ref, `${lang}: citation of ${target}`);
      assert.equal(Number(n), ref.n, `${lang}: [${n}] → ${target}`);
    }
    for (const r of refs) assert.ok(cites.some((c) => c[1] === r.id), `${lang}: ${r.id} is cited`);
  }
  assert.match(html, /doi\.org\/10\.1080\/01621459\.1963\.10500845/, 'Ward 1963');
  assert.match(html, /doi\.org\/10\.1016\/0377-0427\(87\)90125-7/, 'Rousseeuw 1987');
});

test('the method page uses the shared site header and follows the Constitution page’s language key', () => {
  assert.match(html, /<body[^>]*>\n<script src="\/apps\/site-chrome\.js"><\/script>/);
  assert.ok(html.indexOf('href="/apps/site-chrome.css"') < html.indexOf('<style>'));
  assert.match(html, /stoic-constitution:lang/, 'the stored choice of the Stoic pages');
  assert.match(html, /\[data-lang=ru\] \.en,:root:not\(\[data-lang=ru\]\) \.ru\{display:none!important\}/, 'one language shows at a time');
});

const REFERENCE_HOSTS = ['www.gutenberg.org', 'www.perseus.tufts.edu', 'en.wikisource.org', 'www.thelatinlibrary.com', 'doi.org',
  'platform.openai.com', 'docs.anthropic.com', 'creativecommons.org', 'www.jmlr.org'];
test('every link on the method page resolves', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) for (const id of m[1].split(/\s+/)) assert.ok(ids.has(id), `aria reference to a missing id: ${id} (in “${m[1]}”)`);
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.ok(hrefs.length > 80, `${hrefs.length} links`);
  const github = 'https://github.com/ilyaperepelitsa/ilyadays/blob/main/';
  for (const href of hrefs) {
    if (href === 'data:,') continue;   // the empty favicon
    if (href.startsWith('#')) { assert.ok(ids.has(href.slice(1)), `anchor ${href}`); continue; }
    if (href.startsWith(github)) { assert.ok(exists(href.slice(github.length)), `GitHub link to a file that is not in the repository: ${href}`); continue; }
    if (/^https:/.test(href)) {
      // The references link to their sources; nothing else leaves the site.
      const host = new URL(href).hostname;
      assert.ok(REFERENCE_HOSTS.includes(host), `only GitHub and the references' sources leave the site: ${href}`);
      continue;
    }
    assert.ok(!/^[a-z]+:/i.test(href), `unexpected link: ${href}`);
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
      assert.equal(text(inner).replace(/\D/g, ''), String(expected[value]).replace(/\D/g, ''), `${lang}: data-n="${value}" says ${text(inner)}`);
    }
    for (const key of ['passages', 'chapters', 'sections', 'articles', 'claims', 'single', 'seneca-pieces', 'seneca-items', 'seneca-sections', 'letters', 'clauses']) {
      assert.ok(marks.some((m) => m.value === key), `${lang}: the page states ${key}`);
    }
  }
  // The Russian record has the same shape, so the same numbers hold for it.
  assert.equal(record.ru.articles.length, expected.articles);
  assert.equal(record.ru.articles.reduce((n, a) => n + a.claims.length, 0), expected.claims);
  assert.equal(record.ru.articles.reduce((n, a) => n + a.voices.seneca.items.length, 0), expected['seneca-items']);
  // The Seneca table has one row per article.
  for (const [lang, block] of Object.entries(blocks)) {
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

test('every number quoted from a project file is what that file says', () => {
  for (const [lang, block] of Object.entries(blocks)) {
    const quoted = [...block.matchAll(/<span data-num="([^"]+)" data-ctx="([^"]+)">([^<]+)<\/span>/g)];
    assert.ok(quoted.length >= 30, `${lang}: ${quoted.length} numbers quoted from files`);
    assert.equal(quoted.length, (block.match(/data-num=/g) || []).length, `${lang}: every data-num has its context`);
    for (const [, path, ctx, shown] of quoted) {
      assert.ok(exists(path), `${lang}: ${path}`);
      assert.ok(ctx.includes('{n}'), `${lang}: context “${ctx}” names where the number stands`);
      let n = shown.trim().replace(/^(\d{1,3})(?:[  ](\d{3}))+$/, (m) => m.replace(/[  ]/g, ','));
      if (lang === 'ru') n = n.replace(/^(\d+),(\d+)$/, (m, a, b) => (b.length === 3 && a !== '0' ? m : `${a}.${b}`));
      const said = ctx.replace(/&quot;/g, '"').replace('{n}', n);
      assert.ok(read(path).includes(said), `${lang}: ${path} does not say “${said}”`);
    }
  }
});

test('no number on the method page is left untagged', () => {
  // Quantities must carry data-n (computed from the published JSON) or data-num (quoted from a file). What is left out:
  // references to passages, sections, articles, claims, rules, figures and tables; years and dates; the drawings; code,
  // links, the bibliography and the file map; the example sentences and quotes, which other tests compare word for word.
  const LABEL = String.raw`(?:Articles?|articles?|claims?|Claims?|rules?|Rule|Sections?|sections?|chapter|Chapter|Figure|Table|Letters?|Ep\.|Appendix|Version|version|Gutenberg|Статьи|статьи|статей|статья|статье|статьях|Статья|утверждени[еияю]|Утверждени[еияю]|утверждением|правил[оа]?|Правило|статью|раздел|разделы|разделе|разделах|глава|Глава|рис\.|Рис\.|табл\.|Таблица|письме|письмо|версия|Версия|приложение)`;
  for (const [lang, block] of Object.entries(blocks)) {
    let t = block
      .replace(/<!-- figure:(\w+) -->[\s\S]*?<!-- \/figure:\1 -->/g, ' ')
      .replace(/<nav class="toc"[\s\S]*?<\/nav>/g, ' ')
      .replace(/<section id="(?:ru-)?(?:references|appendix-b)"[\s\S]*?<\/section>/g, ' ')
      .replace(/<tr><td><a href="stoic-constitution[\s\S]*?<\/tr>/g, ' ')
      .replace(/<span data-(?:n|num)="[^"]*"[^>]*>[^<]*<\/span>/g, ' ')
      .replace(/<(code|a)\b[^>]*>[\s\S]*?<\/\1>/g, ' ')
      .replace(/<span class="(?:sn|chip)"[^>]*>[^<]*<\/span>/g, ' ')
      .replace(/<td class="q"[\s\S]*?<\/td>/g, ' ')
      .replace(/<p class="ex"[\s\S]*?<\/p>/g, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
    t = t.replace(new RegExp(`${LABEL}\\s+\\d+(?:[.,]\\d+)?[a-z]?(?:(?:,\\s*|\\s+(?:and|и)\\s+|–)\\d+(?:\\.\\d+)?[a-z]?)*`, 'g'), ' ')
      .replace(/\b[1-9]\d*\.\d+[a-z]?\b(?:–\d+)?/g, ' ')
      .replace(/\b(1[5-9]\d\d|20[0-4]\d)\b(?:–\d+)?/g, ' ')
      .replace(/\b\d{1,2}(?:–\d{1,2})?\s+(?:November|Nov|ноября|December|декабря)/g, ' ')
      .replace(/\b\d+(?:-й|th|st|nd|rd)\b/g, ' ');
    const left = [...t.matchAll(/(?<![\w.,])\d[\d,  ]*(?:[.,]\d+)?/g)].map((m) => `${m[0].trim()} ‹${t.slice(Math.max(0, m.index - 40), m.index + 20).replace(/\s+/g, ' ')}›`);
    assert.deepEqual(left, [], `${lang}: untagged numbers`);
  }
});

test('the Seneca table gives each article’s published counts', () => {
  for (const [lang, block] of Object.entries(blocks)) {
    const rows = [...block.matchAll(/<tr><td><a href="stoic-constitution\.html\?[^"]*#article-(\d+)">\1<\/a><\/td><td>[^<]*<\/td><td>(\d+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td><\/tr>/g)];
    assert.equal(rows.length, expected.articles, `${lang}: one row per article`);
    for (const [, n, backs, adds, limits] of rows) {
      const c = record[lang].index.articles.find((a) => a.number === Number(n)).voices.seneca.counts;
      assert.deepEqual([Number(backs), Number(adds), Number(limits)], [c.stronger, c.wider, c.qualified], `${lang}: Article ${n}`);
    }
  }
});

test('the abstract is at most 200 words, and the Russian has no untranslated English', () => {
  for (const id of ['abstract', 'ru-abstract']) {
    const at = html.indexOf(`id="${id}"`);
    const body = html.slice(html.indexOf('<p>', at), html.indexOf('</p>', at));
    const words = text(body).split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
    assert.ok(words <= 200 && words > 120, `${id}: ${words} words`);
  }
  // English inside the Russian is allowed only where it is marked lang="en" (quoted words of the owner, names of sources),
  // in code, links, the bibliography and the file map.
  const ru = blocks.ru
    .replace(/<section id="ru-(?:references|appendix-b)"[\s\S]*?<\/section>/g, ' ')
    .replace(/<(code|a)\b[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<(\w+)[^>]*\blang="en"[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const english = [...ru.matchAll(/[A-Za-z][A-Za-z’'.,?-]*(?:\s+[A-Za-z][A-Za-z’'.,?-]*){2,}/g)].map((m) => m[0]);
    // language codes (GR · LA · EN · RU in a drawing) are not English words
  english.splice(0, english.length, ...english.filter((s) => !s.split(/\s+/).every((w) => /^[A-Z]{2,3}$/.test(w))));
  assert.deepEqual(english, [], 'English runs of three or more words in the Russian');
});

test('the open questions are the decisions waiting on the owner, one for one', () => {
  const plan = read('plan/stoicism/37-owner-points.md');
  const waiting = plan.slice(plan.indexOf('## Decisions waiting on you'), plan.indexOf('\n## ', plan.indexOf('## Decisions waiting on you') + 5));
  const points = waiting.match(/^\d+\. \*\*/gm) || [];
  assert.ok(points.length >= 5, `${points.length} decisions in 37-owner-points.md`);
  for (const [lang, block] of Object.entries(blocks)) {
    const limits = block.slice(block.indexOf('data-sec="limitations"'), block.indexOf('data-sec="conclusion"'));
    const listed = [...limits.matchAll(/data-owner-point="(\d+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(listed, points.map((_, i) => i + 1), `${lang}: section 6 lists each decision of 37-owner-points.md in order`);
  }
});

test('each method, the validation and the results name the files that do them', () => {
  const sections = ['m-embedding', 'm-clustering', 'm-naming', 'm-fusion', 'm-sides', 'm-seneca', 'm-translation', 'm-prompting', 'validation', 'results'];
  for (const [lang, block] of Object.entries(blocks)) {
    for (const id of sections) {
      const at = block.indexOf(`<section id="${lang === 'ru' ? 'ru-' : ''}${id}"`);
      const body = block.slice(at, block.indexOf('</section>', at));
      const code = body.match(/<p class="code" data-code>([\s\S]*?)<\/p>/);
      assert.ok(code, `${lang} ${id}: no line naming its code and data`);
      const files = [...code[1].matchAll(/blob\/main\/([^"]+)"/g)].map((m) => m[1]);
      assert.ok(files.length >= 1, `${lang} ${id}: no files`);
      for (const f of files) assert.ok(exists(f), `${lang} ${id}: ${f} does not exist`);
    }
  }
});
