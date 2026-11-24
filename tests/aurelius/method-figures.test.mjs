import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The eight figures of the method page (public/apps/stoic-method.html) are drawn by scripts/stoic-method-figures.py
// between <!-- figure:<id> --> markers, in English and Russian, with share images in public/apps/stoic-method/share/ and a
// gallery at public/apps/stoic-method/diagrams.html. These tests tie every number drawn to the published files: each is
// marked data-d="<key>" and must equal the value computed here from the record, the translations and diagram-data.json
// (data-f for a decimal; data-fact for a number the page's own text states, which must appear in that text).
const ROOT = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, ROOT), 'utf8');
const json = (path) => JSON.parse(read(path));
const exists = (path) => fs.existsSync(new URL(path, ROOT));

const FIGS = ['pipeline', 'embedding', 'dendrogram', 'fusion', 'sides', 'seneca', 'translation', 'checks'];
const LANGS = ['en', 'ru'];
const html = read('public/apps/stoic-method.html');
const RU_START = html.indexOf('<div class="ru" lang="ru">');
const MAIN_END = html.indexOf('</main>');
const blocks = {en: html.slice(html.indexOf('<div class="en" lang="en">'), RU_START), ru: html.slice(RU_START, MAIN_END)};
const gallery = read('public/apps/stoic-method/diagrams.html');
const data = json('public/apps/stoic-method/diagram-data.json');
const topics = json('content/aurelius/topics.json');

const text = (fragment) => fragment.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const figureOf = (block, id) => {
  const m = block.match(new RegExp(`<!-- figure:${id} -->([\\s\\S]*?)<!-- /figure:${id} -->`));
  return m ? m[1] : null;
};
const svgsOf = (fragment) => [...fragment.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);

// The published record, English and Russian.
const load = (lang) => {
  const index = json(lang === 'ru' ? 'public/apps/stoic-constitution.ru.json' : 'public/apps/stoic-constitution.json');
  const full = new Map();
  for (const chapter of new Set(index.articles.map((a) => a.chapter))) {
    for (const article of json(`public/apps/stoic-constitution/${lang === 'ru' ? 'ru/' : ''}${chapter}.json`).articles) full.set(article.number, article);
  }
  return {index, articles: index.articles.map((a) => full.get(a.number))};
};
const record = {en: load('en'), ru: load('ru')};
const stores = {
  marcus: json('content/aurelius/translation/project-v1.json'),
  seneca: json('content/aurelius/translation/seneca-v1.json'),
  ru: json('content/aurelius/translation/ru-v1.json'),
};

// Every value a figure may draw, computed from the published files.
const expected = (() => {
  const {index, articles} = record.en;
  const sum = (f) => articles.reduce((n, a) => n + f(a), 0);
  const sen = (a) => a.voices.seneca;
  const pieces = (a) => new Set(sen(a).items.flatMap((it) => [...(it.piece ? [it.piece.id] : []), ...(it.support || []).map((s) => s.id)]));
  const amends = articles.flatMap((a) => sen(a).amend || []);
  const refs = new Set(articles.flatMap((a) => sen(a).passages.map((p) => p.ref)));
  const filled = (key) => articles.filter((a) => a.groups.find((g) => g.key === key).items.length > 0).length;
  const v = {
    passages: index.method.passage_count,
    dims: Number(index.method.input.match(/(\d+)-dimensional/)[1]),
    chapters: index.chapters.length,
    sections: index.chapters.reduce((n, c) => n + c.sections.length, 0),
    articles: index.articles.length,
    claims: sum((a) => a.claims.length),
    single: sum((a) => a.single.length),
    'seneca-items': sum((a) => sen(a).items.length),
    'seneca-backs': sum((a) => sen(a).counts.stronger),
    'seneca-adds': sum((a) => sen(a).counts.wider),
    'seneca-limits': sum((a) => sen(a).counts.qualified),
    'seneca-pieces': new Set(articles.flatMap((a) => [...pieces(a)])).size,
    letters: new Set([...refs].map((ref) => ref.match(/^Ep\. (\d+)\./)[1])).size,
    'seneca-corpus': index.authors[0].passages,
    'seneca-letters-all': index.authors[0].units,
    clauses: amends.length,
    'clauses-adds': amends.filter((c) => c.kind === 'adds').length,
    'clauses-limits': amends.filter((c) => c.kind === 'limits').length,
    'clauses-challenges': amends.filter((c) => c.kind === 'challenges').length,
    'quotes-marcus': sum((a) => a.claims.reduce((n, c) => n + c.support.length, 0) + a.single.length),
    'tr-marcus': stores.marcus.passages.length,
    'tr-seneca': stores.seneca.passages.length,
    'tr-letters': Object.keys(stores.seneca.letters).length,
    'tr-ru': stores.ru.passages.length,
    'notes-marcus': stores.marcus.passages.reduce((n, p) => n + p.notes.length, 0),
    'notes-seneca': stores.seneca.passages.reduce((n, p) => n + p.notes.length, 0),
    'qa-blocking': data.gates.blocking,
    'qa-warnings': data.gates.warnings,
    'a1-members': articles[0].members.length,
    'a1-sources': articles[0].sources.length,
    'a1-claims': articles[0].claims.length,
    'a1-single': articles[0].single.length,
  };
  v.revisions = v['tr-marcus'] + v['tr-seneca'] + v['tr-ru'];
  for (const key of ['why', 'action', 'practice', 'breaks', 'doubt']) v[`fill-${key}`] = filled(key);
  for (const c of index.chapters) {
    v[`chapter-passages:${c.id}`] = c.size;
    v[`chapter-sections:${c.id}`] = c.sections.length;
  }
  for (const [rule, n] of Object.entries(data.gates.warnings_by_rule)) v[`qa-rule:${rule}`] = n;
  // How each point of the second reader was settled: the decision's first words; "Found while settling" marks a fault
  // the settler found itself. Free form: the pilot's decisions written without one of the three words.
  for (const [name, key] of [['marcus', 'check'], ['seneca', 'check'], ['ru', 'decisions']]) {
    const tally = {accepted: 0, partly: 0, declined: 0, free: 0, found: 0};
    for (const p of stores[name].passages) {
      for (const x of p[key] || []) {
        const said = typeof x === 'string' ? x : x.decided;
        if (typeof x !== 'string' && x.note.startsWith('Found while settling')) tally.found += 1;
        tally[said.startsWith('Partly accepted') ? 'partly' : said.startsWith('Accepted') ? 'accepted' : said.startsWith('Declined') ? 'declined' : 'free'] += 1;
      }
    }
    for (const [kind, n] of Object.entries(tally)) v[`dec-${name}-${kind}`] = n;
    v[`dec-${name}-total`] = tally.accepted + tally.partly + tally.declined + tally.free;
  }
  return v;
})();

const marked = (fragment, attribute) => [...fragment.matchAll(new RegExp(`<tspan ${attribute}="([^"]+)">([^<]*)</tspan>`, 'g'))]
  .map((m) => ({key: m[1].replace(/&amp;/g, '&'), shown: m[2]}));
const integer = (shown) => Number(shown.replace(/\D/g, ''));

test('every figure is drawn in both languages: a wide and a phone drawing, each an accessible image with text as text', () => {
  for (const lang of LANGS) {
    for (const id of FIGS) {
      const fig = figureOf(blocks[lang], id);
      assert.ok(fig, `${lang}: markers for ${id}`);
      assert.match(fig, new RegExp(`<div class="dg" id="${lang === 'ru' ? 'ru-' : ''}dg-${id}">`), `${lang} ${id}: the figure's frame`);
      const svgs = svgsOf(fig);
      assert.equal(svgs.length, 2, `${lang} ${id}: two drawings`);
      assert.match(svgs[0], /class="dg-svg dg-wide"/);
      assert.match(svgs[1], /class="dg-svg dg-tall"/);
      for (const svg of svgs) {
        const [, labelled] = svg.match(/role="img" aria-labelledby="([^"]+)"/) || [];
        assert.ok(labelled, `${lang} ${id}: role="img" with a label`);
        const [t, d] = labelled.split(' ');
        const title = svg.match(new RegExp(`<title id="${t}">([^<]+)</title>`));
        const desc = svg.match(new RegExp(`<desc id="${d}">([^<]+)</desc>`));
        assert.ok(title && title[1].length > 10, `${lang} ${id}: <title>`);
        assert.ok(desc && desc[1].length > 40, `${lang} ${id}: <desc>`);
        if (lang === 'ru') assert.match(title[1] + desc[1], /[а-яё]/i, `${id}: the Russian drawing is in Russian`);
        assert.ok((svg.match(/<text /g) || []).length >= 10, `${lang} ${id}: labels are text`);
        assert.doesNotMatch(svg, /<image /, `${lang} ${id}: no raster inside`);
      }
    }
  }
});

test('text in the figures is large enough to read at 1440 and 390 px', () => {
  // On a wide screen a 1200-unit drawing is about 720 px wide, so 20 units is 12 px; the phone drawing is 340 units in
  // about 330 px, so 13 units is 12.6 px. scripts/stoic-method-figures-check.py measures the same in the browser.
  for (const lang of LANGS) {
    for (const id of FIGS) {
      const [wide, phone] = svgsOf(figureOf(blocks[lang], id));
      for (const [svg, least] of [[wide, 20], [phone, 12.9]]) {
        const sizes = [...svg.matchAll(/<text [^>]*font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
        assert.ok(Math.min(...sizes) >= least, `${lang} ${id}: smallest text ${Math.min(...sizes)} units, at least ${least}`);
      }
    }
  }
});

const checkNumbers = (fragment, where) => {
  let count = 0;
  for (const {key, shown} of marked(fragment, 'data-d')) {
    assert.ok(key in expected, `${where}: unknown data-d="${key}"`);
    assert.equal(integer(shown), expected[key], `${where}: data-d="${key}" says ${shown}`);
    count += 1;
  }
  for (const {key, shown} of marked(fragment, 'data-f')) {
    assert.equal(key, 'trust', `${where}: unknown data-f="${key}"`);
    assert.equal(Number(shown.replace(',', '.')), Number(data.projection.trustworthiness.toFixed(2)), `${where}: trustworthiness`);
    count += 1;
  }
  return count;
};

test('every number drawn on the page is the published one, in both languages', () => {
  for (const lang of LANGS) {
    for (const id of FIGS) {
      const n = checkNumbers(figureOf(blocks[lang], id), `${lang} ${id}`);
      assert.ok(n >= 3, `${lang} ${id}: ${n} numbers marked`);
    }
    // A number the page's own text states (from the finish log, not the JSON) must be in that text.
    const prose = text(blocks[lang].replace(/<div class="dg"[\s\S]*?<\/div>\n<!-- \/figure/g, ''));
    for (const {key, shown} of marked(blocks[lang], 'data-fact')) {
      assert.equal(shown, key);
      assert.match(prose, new RegExp(`(^|[^\\d])${key}([^\\d]|$)`), `${lang}: the figures say ${key}; the text must too`);
    }
  }
  // The headline numbers are drawn.
  const drawn = new Set(marked(blocks.en, 'data-d').map((m) => m.key));
  for (const key of ['passages', 'dims', 'chapters', 'sections', 'articles', 'claims', 'single', 'seneca-items', 'seneca-backs',
    'seneca-adds', 'seneca-limits', 'clauses', 'fill-why', 'fill-doubt', 'dec-marcus-accepted', 'dec-ru-declined', 'qa-warnings']) {
    assert.ok(drawn.has(key), `the figures draw ${key}`);
  }
});

test('the share files exist for every figure and language, at LinkedIn sizes, and are linked from the page and the gallery', () => {
  const pngSize = (path) => {
    const b = fs.readFileSync(new URL(path, ROOT));
    assert.equal(b.toString('latin1', 1, 4), 'PNG', `${path} is a PNG`);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  for (const lang of LANGS) {
    for (const id of FIGS) {
      for (const [kind, w, h] of [['square', 1200, 1200], ['landscape', 1200, 627]]) {
        const base = `public/apps/stoic-method/share/${id}-${lang}-${kind}`;
        assert.ok(exists(`${base}.png`) && exists(`${base}.svg`), `${base}.png and .svg`);
        const [pw, ph] = pngSize(`${base}.png`);
        assert.ok(pw % w === 0 && pw / w === ph / h, `${base}.png is ${pw} × ${ph}, a multiple of ${w} × ${h}`);
        const svg = read(`${base}.svg`);
        assert.match(svg, new RegExp(`viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"`), `${base}.svg size`);
        assert.match(svg, /ilyadays\.com · (Stoic Constitution|Стоическая конституция)/, `${base}.svg carries the credit`);
        checkNumbers(svg, `${base}.svg`);
        const href = `stoic-method/share/${id}-${lang}-${kind}`;
        assert.ok(blocks[lang].includes(`href="${href}.png"`) && blocks[lang].includes(`href="${href}.svg"`), `${lang} page links ${href}`);
        assert.ok(gallery.includes(`"share/${id}-${lang}-${kind}.png"`) && gallery.includes(`"share/${id}-${lang}-${kind}.svg"`), `gallery links ${href}`);
      }
    }
    assert.ok(blocks[lang].includes(`href="stoic-method/diagrams.html${lang === 'ru' ? '?lang=ru' : ''}"`), `${lang}: the page links the gallery`);
  }
  // nothing in the share folder that the page does not offer
  const offered = new Set(FIGS.flatMap((id) => LANGS.flatMap((lang) => ['square', 'landscape'].flatMap((k) => ['png', 'svg'].map((e) => `${id}-${lang}-${k}.${e}`)))));
  for (const name of fs.readdirSync(new URL('public/apps/stoic-method/share/', ROOT))) assert.ok(offered.has(name), `unexpected share file ${name}`);
});

test('the gallery uses the site header and links back to each figure on the page', () => {
  assert.match(gallery, /<body>\n<script src="\/apps\/site-chrome\.js"><\/script>/);
  assert.ok(gallery.indexOf('href="/apps/site-chrome.css"') < gallery.indexOf('<style>'));
  for (const id of FIGS) {
    assert.ok(gallery.includes(`../stoic-method.html#fig-${id}"`), `gallery → #fig-${id}`);
    assert.ok(gallery.includes(`../stoic-method.html?lang=ru#ru-fig-${id}"`), `gallery → #ru-fig-${id}`);
    assert.match(html, new RegExp(`id="fig-${id}"`), `the page has #fig-${id}`);
    assert.match(html, new RegExp(`id="ru-fig-${id}"`), `the page has #ru-fig-${id}`);
  }
});

test('diagram-data.json holds references and numbers only, and agrees with topics.json', () => {
  const sectionOf = new Map(topics.chapters.flatMap((c) => c.sections.flatMap((s) => s.members.map((m) => [m.reference, s.id]))));
  const points = data.projection.points;
  assert.equal(points.length, expected.passages);
  for (const [ref, x, y, section] of points) {
    assert.equal(section, sectionOf.get(ref), `${ref}: its section`);
    assert.ok(Math.abs(x) <= 1 && Math.abs(y) <= 1, `${ref}: scaled into [-1, 1]`);
  }
  assert.ok(data.projection.trustworthiness > 0.5 && data.projection.trustworthiness <= 1);
  for (const c of topics.chapters) {
    const tree = data.tree.chapters[c.id];
    const members = c.sections.flatMap((s) => s.members.map((m) => m.reference));
    assert.deepEqual([...tree.leaves].sort(), [...members].sort(), `${c.id}: the tree's leaves`);
    assert.deepEqual([...tree.order].sort(), [...members].sort(), `${c.id}: the leaf order`);
    assert.equal(tree.linkage.length, members.length - 1, `${c.id}: one merge per join`);
  }
  assert.deepEqual(new Set(data.tree.top.flatMap((r) => r.slice(0, 2)).filter((x) => x.startsWith('c'))), new Set(topics.chapters.map((c) => c.id)));
  assert.equal(Object.values(data.gates.warnings_by_rule).reduce((a, b) => a + b, 0), data.gates.warnings);
  // No passage text: every string is a reference, an id, or a description under a describing key.
  const DESCRIBING = new Set(['about', 'method', 'vectors', 'rule', 'note', 'command', 'made_by']);
  const long = [];
  const walk = (x, key, parent) => {
    if (typeof x === 'string') { if (x.length > 40 && !DESCRIBING.has(key) && parent !== 'definitions' && !/^[0-9a-f]{64}$/.test(x)) long.push(`${key}: ${x.slice(0, 40)}`); }
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) walk(v, Array.isArray(x) ? key : k, key);
  };
  walk(data);
  assert.deepEqual(long, [], 'only descriptions are longer than an id');
  assert.ok(!read('public/apps/stoic-method/diagram-data.json').includes('.aurelius/'));
});

test('the validation numbers agree with the record and with each other', () => {
  const v = data.validation;
  const full = topics.chapters.flatMap((c) => json(`public/apps/stoic-constitution/${c.id}.json`).articles);
  assert.equal(full.length, expected.articles);
  const stayed = full.filter((a) => a.in_translation).reduce((n, a) => n + a.in_translation.stayed, 0);
  assert.equal(v.stay.published_mixed, stayed, 'the published stay count is the record\'s in_translation.stayed, summed');
  const seven = v.chapter_cut.by_k.find((row) => row.k === 7);
  const sizes = topics.comparison_at_chapter_cut.ward.sizes;
  assert.equal(seven.smallest, Math.min(...sizes));
  assert.equal(seven.largest, Math.max(...sizes));
  assert.equal(Math.round(seven.silhouette * 1000) / 1000, topics.comparison_at_chapter_cut.ward.cosine_silhouette);
  assert.equal(v.silhouette.chapters.silhouette, seven.silhouette);
  // The rule as the paper first stated it ("before a group of fewer than 20 passages appears") cannot give 7.
  assert.equal(v.chapter_cut.any_threshold_gives_7, !v.chapter_cut.rule_by_threshold.every((x) => x.k !== 7));
  for (const key of ['chapters', 'sections']) assert.ok(v.silhouette[key].silhouette > v.silhouette[key].shuffled_max, `${key}: above every shuffle`);
  assert.equal(v.stay.of, expected.passages);
  assert.equal(Object.keys(v.similarity.closeness_1634).length, v.similarity.sections);
  assert.equal(Object.keys(v.similarity.closeness_1634).filter((s) => v.similarity.closeness_new[s] < v.similarity.closeness_1634[s]).length, v.similarity.sections_lower_on_new);
});

const manifest = json('public/apps/stoic-method/figures/figures.json');

test('figures.json lists the figures in the paper’s order, and the page inlines each figure file exactly', () => {
  assert.deepEqual(manifest.figures.map((f) => f.id), FIGS);
  for (const [i, f] of manifest.figures.entries()) {
    assert.equal(f.number, i + 1, `${f.id}: number`);
    assert.ok(f.title.en && /[а-яё]/i.test(f.title.ru), `${f.id}: titles`);
    assert.ok(f.caption.en.startsWith(`Figure ${f.number}. `) && f.caption.ru.startsWith(`Рис. ${f.number}. `), `${f.id}: caption numbers`);
    assert.ok(f.sources.length > 0, `${f.id}: data sources`);
    for (const lang of LANGS) {
      // The paper numbers the figure the same way.
      const prefix = lang === 'ru' ? 'ru-' : '';
      const wrapper = html.match(new RegExp(`<figure class="fig" id="${prefix}fig-${f.id}">[\\s\\S]*?<figcaption><b>([^<]+)</b>`));
      assert.ok(wrapper, `${lang}: the page has the figure ${f.id}`);
      assert.equal(wrapper[1].trim(), lang === 'ru' ? `Рис. ${f.number}.` : `Figure ${f.number}.`, `${lang} ${f.id}: the page's number`);
      for (const kind of ['page', 'phone']) {
        const file = read(`public/apps/stoic-method/${f.files[lang][kind]}`).trim();
        assert.ok(figureOf(blocks[lang], f.id).includes(file), `${lang} ${f.id}: the page inlines ${f.files[lang][kind]}`);
        assert.match(file, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" class="dg-svg dg-(wide|tall)"/);
        // The file takes the page's colours where it is inline, and falls back to its own when it stands alone.
        for (const token of ['ink', 'muted', 'line', 'card', 'p1', 'e']) assert.match(file, new RegExp(`var\\(--${token},#[0-9a-f]{6}\\)`), `${f.id}: --${token}`);
        assert.match(file, /@media\(prefers-color-scheme:dark\)/, `${f.id}: a dark version`);
      }
    }
  }
});

// The dataviz palette checks (OKLab distance ×100 under Machado et al. 2009 colour-blindness simulation, severity 1),
// the same as the validator the colours were chosen with.
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
};
const linear = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
const oklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const simulate = (hex, kind) => {
  const c = linear(hex);
  return kind ? MACHADO[kind].map((row) => Math.max(0, Math.min(1, row[0] * c[0] + row[1] * c[1] + row[2] * c[2]))) : c;
};
const deltaE = (a, b, kind) => { const x = oklab(simulate(a, kind)), y = oklab(simulate(b, kind)); return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const luminance = (hex) => { const [r, g, b] = linear(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test('the figures’ colours pass the colour-blindness checks they were chosen with, light and dark', () => {
  const {palette} = manifest;
  for (const mode of ['light', 'dark']) {
    const band = mode === 'light' ? [0.43, 0.77] : [0.48, 0.67];
    const hexes = (group) => palette.groups[group].map((k) => palette[mode][k]);
    for (const [group, pairs] of [['chapters', 'adjacent'], ['effects', 'all']]) {
      const list = hexes(group);
      for (const hex of list) {
        const [L, a, b] = oklab(linear(hex));
        assert.ok(L >= band[0] && L <= band[1], `${mode} ${group} ${hex}: lightness ${L.toFixed(3)}`);
        assert.ok(Math.hypot(a, b) >= 0.1, `${mode} ${group} ${hex}: chroma`);
      }
      const pairList = pairs === 'all' ? list.flatMap((x, i) => list.slice(i + 1).map((y) => [x, y])) : list.slice(1).map((y, i) => [list[i], y]);
      for (const [x, y] of pairList) {
        assert.ok(Math.min(deltaE(x, y, 'protan'), deltaE(x, y, 'deutan')) >= 8, `${mode} ${group} ${x}/${y}: colour-blind separation`);
        assert.ok(deltaE(x, y) >= 15, `${mode} ${group} ${x}/${y}: separation for full colour vision`);
      }
    }
    // decisions: one hue, lighter to darker away from the surface, the step nearest the surface still visible
    const ramp = hexes('decisions_ordinal');
    const Ls = ramp.map((h) => oklab(linear(h))[0]);
    for (let i = 1; i < Ls.length; i++) assert.ok(Math.abs(Ls[i] - Ls[i - 1]) >= 0.06, `${mode} decisions: steps apart`);
    for (const surface of palette.surfaces[mode]) {
      const near = mode === 'light' ? ramp[0] : ramp[ramp.length - 1];
      assert.ok(contrast(near, surface) >= 2, `${mode} decisions: ${near} on ${surface}`);
      for (const hex of [...hexes('chapters'), ...hexes('effects')]) {
        // a hue below 3:1 must carry a visible label: every chapter and effect colour in these figures is named in text
        assert.ok(contrast(hex, surface) >= 2, `${mode} ${hex} on ${surface}`);
      }
    }
  }
});

test('every figure has an approved screenshot for each language, width and theme', () => {
  // made and compared by scripts/stoic-method-figures-check.py (--approve to replace them on purpose)
  const dir = 'tests/aurelius/e2e/method-figures/';
  for (const id of FIGS) for (const lang of LANGS) for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    assert.ok(exists(`${dir}${id}-${lang}-${width}-${theme}.png`), `baseline ${id}-${lang}-${width}-${theme}.png`);
  }
});
