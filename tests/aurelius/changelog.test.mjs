import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The changelog (public/apps/stoic-changelog.html): what changed in the Stoic Constitution and its pages, newest first, in
// English and Russian, switched like the method page. These tests keep the two languages in step, every link and number
// honest, and the page reachable from the Constitution and the method paper. They also hold the Constitution's downloads
// section, which replaced the footer's inline links on the same day.
const ROOT = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, ROOT), 'utf8');
const exists = (path) => fs.existsSync(new URL(path, ROOT));

const html = read('public/apps/stoic-changelog.html');
const EN_START = html.indexOf('<div class="en" lang="en">');
const RU_START = html.indexOf('<div class="ru" lang="ru">');
const MAIN_END = html.indexOf('</main>');
const blocks = {en: html.slice(EN_START, RU_START), ru: html.slice(RU_START, MAIN_END)};
const prefix = (lang) => (lang === 'ru' ? 'ru-' : '');
const text = (fragment) => fragment.replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();
const days = (block) => [...block.matchAll(/<section class="day" id="([^"]+)"[^>]*>\s*<h2 id="[^"]+"><time datetime="(\d{4}-\d\d-\d\d)">([^<]+)<\/time><\/h2>([\s\S]*?)<\/section>/g)]
  .map((m) => ({id: m[1], date: m[2], label: m[3], body: m[4]}));
const entries = (body) => [...body.matchAll(/<li class="entry" id="([^"]+)" data-kind="([^"]+)"><h3>([\s\S]*?)<\/h3>([\s\S]*?)<\/li>/g)]
  .map((m) => ({id: m[1], kinds: m[2].split(' '), title: text(m[3]), body: m[4]}));

test('the changelog is a Stoic page in English and Russian, with the shared header and one h1 per language', () => {
  assert.ok(EN_START > 0 && RU_START > EN_START && MAIN_END > RU_START, 'an English block, then a Russian block, inside <main>');
  assert.match(html, /<body>\n<script src="\/apps\/site-chrome\.js"><\/script>/);
  assert.ok(html.indexOf('href="/apps/site-chrome.css"') < html.indexOf('<style>'));
  assert.match(html, /\[data-lang=ru\] \.en,:root:not\(\[data-lang=ru\]\) \.ru\{display:none!important\}/, 'one language shows at a time');
  assert.match(html, /localStorage\.getItem\('stoic-constitution:lang'\)/, 'it follows the Constitution page’s language key');
  for (const [lang, block] of Object.entries(blocks)) assert.equal((block.match(/<h1[\s>]/g) || []).length, 1, `${lang}: one <h1>`);
});

test('the same dates and the same entries in both languages, newest first', () => {
  const en = days(blocks.en), ru = days(blocks.ru);
  assert.ok(en.length >= 3, `${en.length} dates`);
  assert.deepEqual(ru.map((d) => d.date), en.map((d) => d.date), 'the Russian has the English dates');
  assert.deepEqual(en.map((d) => d.date), [...en.map((d) => d.date)].sort().reverse(), 'newest first, one section per date');
  const MONTHS = {en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']};
  for (const [lang, list] of Object.entries({en, ru})) {
    for (const day of list) {
      const [y, m, d] = day.date.split('-').map(Number);
      assert.equal(day.label, `${d} ${MONTHS[lang][m - 1]} ${y}`, `${lang}: ${day.date} is written as a date`);
      assert.equal(day.id, `${prefix(lang)}d-${day.date}`);
    }
  }
  for (let i = 0; i < en.length; i++) {
    const a = entries(en[i].body), b = entries(ru[i].body);
    assert.ok(a.length > 0, `${en[i].date}: entries`);
    assert.deepEqual(b.map((e) => e.id), a.map((e) => prefix('ru') + e.id), `${en[i].date}: the same entries in the same order`);
    for (const [lang, list] of [['en', a], ['ru', b]]) {
      for (const entry of list) {
        const paragraphs = [...entry.body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => text(m[1]));
        assert.equal(paragraphs.length, 1, `${lang} ${entry.id}: one paragraph`);
        // One to three sentences, plus at most a closing link ("How Seneca was added"), which has no full stop.
        const sentences = paragraphs[0].split(/(?<=[.!?»”])\s+(?=[A-ZА-ЯЁ«“<])/).filter((s) => /[.!?]["»”]?$/.test(s));
        assert.ok(sentences.length >= 1 && sentences.length <= 3, `${lang} ${entry.id}: ${sentences.length} sentences`);
        assert.ok(entry.title.length > 4 && entry.title.length < 90, `${lang} ${entry.id}: a short heading`);
      }
    }
  }
  // The contents list every date and every entry, in the page's order.
  for (const [lang, block] of Object.entries(blocks)) {
    const toc = block.slice(block.indexOf('<nav class="toc"'), block.indexOf('</nav>'));
    const listed = [...toc.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    const order = days(block).flatMap((d) => [d.id, ...entries(d.body).map((e) => e.id)]);
    assert.deepEqual(listed, order, `${lang}: the contents follow the page`);
  }
});

test('the reader text keeps to plain words: no milestone codes, schema numbers, file paths or agent names', () => {
  for (const [lang, block] of Object.entries(blocks)) {
    const words = text(block.replace(/<(?:script|style)[\s\S]*?<\/(?:script|style)>/g, ' '));
    for (const bad of [/\b[NWMRAT]\d{1,2}(?:\.\d)?\b/, /\bschema\b/i, /\.(?:json|py|md|mjs|tsx?)\b/, /\b(?:public|scripts|content|plan|apps)\//, /\b(?:lit|chk|rev|prev|lead|ru|w)-[a-z]?\d/]) {
      assert.ok(!bad.test(words), `${lang}: ${bad} in “${(words.match(bad) || [''])[0]}”`);
    }
  }
  const en = text(blocks.en);
  for (const us of [/\bcolor/i, /\bcenter\b/i, /\bbehavior/i, /\bfavorite/i, /\bcatalog\b/i, /\borganiz/i, /\banalyz/i]) assert.ok(!us.test(en), `British spelling: ${us}`);
  const ru = text(blocks.ru.replace(/<[^>]+lang="en"[^>]*>[\s\S]*?<\/[^>]+>/g, ' '));
  assert.ok(!/[“”"„]/.test(ru), 'Russian quotes are «ёлочки»');
  assert.ok((ru.match(/«/g) || []).length === (ru.match(/»/g) || []).length, 'every « is closed');
});

test('the English and the Russian state the same numbers', () => {
  // Years in a range ("1917–25") are written out in full in Russian; thousands take a comma in English only.
  const numbers = (block) => text(block.replace(/<nav class="toc"[\s\S]*?<\/nav>/, ' '))
    .replace(/\b(\d\d)(\d\d)–(\d\d)\b/g, '$1$2–$1$3')
    .match(/\d[\d,]*(?:\.\d+)?/g).map((n) => n.replace(/,/g, '')).sort();
  assert.deepEqual(numbers(blocks.ru), numbers(blocks.en));
});

test('the counts of the literary review are those of the finish log', () => {
  const log = read('plan/stoicism/36-finish-log.md');
  const review = log.slice(log.lastIndexOf('**Literary review'));
  const entry = days(blocks.en).flatMap((d) => entries(d.body)).find((e) => e.id === 'literary-review');
  assert.ok(entry, 'the literary review has an entry');
  const said = text(entry.body);
  for (const [count, where] of [['221', '161'], ['191', '130'], ['1,073', null], ['613', '387'], ['1,712', null]]) {
    assert.match(review, new RegExp(`${count} edits${where ? `\\s+in ${where}` : ''}`), `the log says ${count} edits${where ? ` in ${where}` : ''}`);
    assert.ok(said.includes(count) && (!where || said.includes(`${count} edits in ${where}`) || said.includes(`${count} in ${where}`)), `the changelog says ${count}`);
  }
});

test('every link on the changelog resolves, and stays in the reader’s language', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const index = JSON.parse(read('public/apps/stoic-constitution.json'));
  const method = read('public/apps/stoic-method.html');
  for (const [lang, block] of Object.entries(blocks)) {
    for (const m of block.matchAll(/\shref="([^"]+)"/g)) {
      const href = m[1].replace(/&amp;/g, '&');
      if (href.startsWith('#')) { assert.ok(ids.has(href.slice(1)), `${lang}: anchor ${href}`); continue; }
      assert.ok(!/^[a-z]+:/i.test(href), `${lang}: stays on the site: ${href}`);
      const [path, hash] = href.split('#'), file = path.split('?')[0];
      if (file === '/' || file === '/ru') continue;
      if (file.startsWith('/downloads/')) { assert.ok(exists(`public${file}`), `${lang}: ${href}`); continue; }
      assert.ok(exists(`public/apps/${file}`), `${lang}: ${href}`);
      const query = new URLSearchParams(path.split('?')[1] || '');
      // The two-language pages open in the reader's language; an English entry about the Russian may point to the Russian.
      if (/^stoic-(?:constitution|method)\.html$|^stoic-method\/diagrams\.html$/.test(file)) {
        assert.ok(lang === 'ru' ? query.get('lang') === 'ru' : ['en', 'ru'].includes(query.get('lang')), `${lang}: ${href} names its language`);
      }
      if (hash && file === 'stoic-constitution.html' && hash.startsWith('article-')) {
        assert.ok(index.articles.some((a) => `article-${a.number}` === hash), `${href}: no such article`);
      }
      if (hash && file === 'stoic-method.html') assert.ok(method.includes(`id="${hash}"`), `${href}: no such section`);
      if (query.get('c')) assert.ok(index.chapters.some((c) => c.id === query.get('c')), `${href}: no such chapter`);
    }
  }
  assert.ok(/href="\/"/.test(blocks.en) && /href="\/ru"/.test(blocks.ru), 'the home page in each language');
});

test('the Constitution and the method paper link to the changelog in both languages', () => {
  const page = read('public/apps/stoic-constitution.html');
  // Beside the method link in the bar, with its long and short labels.
  assert.match(page, /el\('a', 'to-changes'\)/);
  assert.match(page, /'Что изменилось' : 'What changed'/);
  assert.match(page, /'Изменения' : 'Changes'/);
  assert.match(page, /changes\.href = 'stoic-changelog\.html\?lang=' \+ \(RU \? 'ru' : 'en'\)/);
  assert.match(page, /jump\.append\(topics, tags, editor, method, changes\)/);
  // In the paragraph under the articles, in English and in its Russian words.
  const more = page.match(/<p class="sub more" id="more">([\s\S]*?)<\/p>/)[1];
  assert.match(more, /<a href="stoic-changelog\.html\?lang=en">/);
  assert.match(page.match(/\['#more',\s*'([^\n]*)', true\]/)[1], /<a href="stoic-changelog\.html\?lang=ru">/);
  // Near the top of the method paper, in each language's front matter.
  const method = read('public/apps/stoic-method.html');
  const fronts = [...method.matchAll(/<div class="front">([\s\S]*?)<div class="abstract"/g)].map((m) => m[1]);
  assert.equal(fronts.length, 2);
  assert.match(fronts[0], /<a href="stoic-changelog\.html\?lang=en">/);
  assert.match(fronts[1], /<a href="stoic-changelog\.html\?lang=ru">/);
});

test('the Constitution offers every translation as EPUB, Markdown and text, Russian first in Russian', () => {
  const page = read('public/apps/stoic-constitution.html');
  const books = ['marcus-meditations-project-v1', 'seneca-letters-selection-v1', 'marcus-meditations-ru-v1', 'seneca-letters-selection-ru-v1'];
  const links = (fragment) => [...fragment.matchAll(/<a class="get (epub|md|txt)" href="\/downloads\/([^"]+)\.(epub|md|txt)" download>/g)].map((m) => {
    assert.equal({epub: 'epub', md: 'md', txt: 'txt'}[m[1]], m[3], `${m[2]}: the ${m[1]} button gets the .${m[3]}`);
    return `${m[2]}.${m[3]}`;
  });
  const order = (list) => [...new Set(list.map((f) => f.replace(/\.\w+$/, '')))];
  const section = page.match(/<section id="downloads"[\s\S]*?<\/section>/)[0];
  const en = links(section);
  assert.deepEqual(en, books.flatMap((b) => [`${b}.epub`, `${b}.md`, `${b}.txt`]), 'English: each book, EPUB · Markdown · Text');
  for (const file of en) assert.ok(exists(`public/downloads/${file}`), `${file} is published`);
  assert.match(section, /CC0/);
  assert.equal((section.match(/<small>for e-readers<\/small>/g) || []).length, books.length);
  const ru = page.match(/\['#downloads', '([^\n]*)', true\]/);
  assert.ok(ru, 'the section has its Russian words');
  assert.deepEqual([...links(ru[1])].sort(), [...en].sort(), 'Russian: the same twelve files');
  assert.deepEqual(order(links(ru[1])), [books[2], books[3], books[0], books[1]], 'Russian: the Russian books first');
  assert.match(ru[1], /CC0/);
  assert.equal((ru[1].match(/<small>для электронных книг<\/small>/g) || []).length, books.length);
  // Each button names its book for a screen reader, and the footer no longer carries the links.
  assert.equal((section.match(/<span class="sr">, /g) || []).length, 12);
  assert.doesNotMatch(page.match(/<footer[\s\S]*?<\/footer>/)[0], /\/downloads\//);
  assert.doesNotMatch(page.match(/\['footer', '([^\n]*)'/)[1], /\/downloads\//);
});

// The page's pictures (24 Nov 2026, owner: "changelog should have good visuals"): each change carries a kind, named in words
// beside its colour; one card per date; the kinds above the log are a legend and a filter with honest counts; every image is
// published; and every line a picture quotes is word for word in the published texts.
const KINDS = {en: {articles: 'Articles', translations: 'Translations', reading: 'Reading', method: 'Method', site: 'Site'},
  ru: {articles: 'Статьи', translations: 'Переводы', reading: 'Чтение', method: 'Метод', site: 'Сайт'}};

test('every change has a kind, named beside its colour, the same in both languages', () => {
  const kindsOf = {};
  for (const [lang, block] of Object.entries(blocks)) {
    for (const day of days(block)) {
      for (const entry of entries(day.body)) {
        const id = entry.id.replace(/^ru-/, '');
        for (const k of entry.kinds) assert.ok(KINDS[lang][k], `${lang} ${id}: kind ${k}`);
        const shown = [...entry.body.match(/<span class="kinds">([\s\S]*?)<\/span><\/span>\n/)[1].matchAll(/<span class="k-([a-z]+)">[\s\S]*?<\/svg>([^<]+)/g)];
        assert.deepEqual(shown.map((m) => [m[1], m[2]]), entry.kinds.map((k) => [k, KINDS[lang][k]]), `${lang} ${id}: the kinds are named`);
        if (lang === 'en') kindsOf[id] = entry.kinds.join(' '); else assert.equal(entry.kinds.join(' '), kindsOf[id], `${id}: same kinds`);
      }
    }
    // The legend counts each kind's changes, and starts hidden until the script can filter.
    const bar = block.match(/<div class="kinds-bar"[^>]*hidden>([\s\S]*?)<\/div>/);
    assert.ok(bar, `${lang}: the kinds bar`);
    const counts = Object.fromEntries([...bar[1].matchAll(/data-kind="([a-z]+)"[^>]*>(?:<i[^>]*><\/i>)?[^<]*<span class="c">(\d+)<\/span>/g)].map((m) => [m[1], Number(m[2])]));
    const all = days(block).flatMap((d) => entries(d.body));
    for (const k of Object.keys(KINDS.en)) assert.equal(counts[k], all.filter((e) => e.kinds.includes(k)).length, `${lang}: ${k} count`);
  }
});

test('one card per date at the top, linking to its day, with its number of changes', () => {
  for (const [lang, block] of Object.entries(blocks)) {
    const cards = [...block.match(/<ol class="releases"[^>]*>([\s\S]*?)<\/ol>/)[1].matchAll(/<a href="#([^"]+)">([\s\S]*?)<\/a>/g)];
    const list = days(block);
    assert.deepEqual(cards.map((m) => m[1]), list.map((d) => d.id), `${lang}: a card for each date, newest first`);
    cards.forEach((m, i) => {
      const n = entries(list[i].body).length;
      assert.match(text(m[2]), new RegExp(`(?:^|\\s)${n} (?:changes?|изменени[еяй])(?!\\p{L})`, 'u'), `${lang} ${list[i].date}: ${n} changes`);
      assert.ok(m[2].includes(`<span class="yr">${list[i].date.slice(0, 4)}</span>`), `${lang} ${list[i].date}: the year`);
    });
  }
});

test('every picture on the changelog is published, sized, and described', () => {
  for (const [lang, block] of Object.entries(blocks)) {
    for (const m of block.matchAll(/<img ([^>]+)>/g)) {
      const src = m[1].match(/src="([^"]+)"/)[1];
      assert.ok(exists(src.startsWith('/') ? `public${src}` : `public/apps/${src}`), `${lang}: ${src}`);
      assert.match(m[1], /width="\d+" height="\d+"/, `${lang}: ${src} is sized`);
      assert.match(m[1], /alt="[^"]{10,}"/, `${lang}: ${src} is described`);
      assert.ok(src.includes(`-${lang}-`) || src.startsWith('/share/'), `${lang}: ${src} is in the reader's language`);
    }
    for (const m of block.matchAll(/srcset="([^"]+)"/g)) assert.ok(exists(`public/apps/${m[1]}`), `${lang}: ${m[1]}`);
  }
});

test('every line a picture quotes is word for word in the published texts', () => {
  const tr = JSON.parse(read('public/apps/stoic-translation.json')).passages;
  const seneca = JSON.parse(read('content/aurelius/translation/seneca-v1.json')).passages;
  const ru = JSON.parse(read('content/aurelius/translation/ru-v1.json')).passages;
  const statements = ['public/apps/stoic-constitution/c*.json', 'public/apps/stoic-constitution/ru/c*.json'].flatMap((glob) => {
    const dir = glob.slice(0, glob.lastIndexOf('/'));
    return fs.readdirSync(new URL(dir + '/', ROOT)).filter((f) => /^c\d\.json$/.test(f))
      .flatMap((f) => JSON.parse(read(`${dir}/${f}`)).articles.map((a) => a.statement.t));
  });
  const corpus = [...tr.flatMap((p) => [p.greek, p.english, p.casaubon]), ...seneca.flatMap((p) => [p.latin, p.english]), ...ru.map((p) => p.russian), ...statements]
    .filter((t) => typeof t === 'string');
  const found = (line) => corpus.some((t) => t.includes(line));
  let n = 0;
  for (const [lang, block] of Object.entries(blocks)) {
    for (const m of block.matchAll(/<span class="(?:txt|st)" lang="[a-z]+">([\s\S]*?)<\/span>/g)) {
      const line = m[1];
      // A changed word shows the new one underlined and the old struck out: the new reading is the published one.
      const now = text(line.replace(/<del>[\s\S]*?<\/del>\s*/g, '')).replace(/…$/, '');
      assert.ok(found(now), `${lang}: “${now}” is not in the published texts`);
      n++;
    }
    for (const m of block.matchAll(/<span class="st">([\s\S]*?)<\/span>/g)) { assert.ok(found(text(m[1])), `${lang}: ${text(m[1])}`); n++; }
  }
  assert.ok(n >= 16, `${n} quoted lines`);
});
