import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

// The first constitution articles are published as a static record. It must stay tied to the
// published Casaubon map (immutable revisions and text hashes) and to the topic hierarchy.
const read = (path) => JSON.parse(fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
// The page's index lists every article as a stub; the full articles sit in one file per chapter. Join them.
// STOIC_RECORD_DIR points the tests at another copy of the published files (used by scripts/aurelius-constitution-fixtures.py).
const RECORD_DIR = process.env.STOIC_RECORD_DIR ? new URL(`file://${process.env.STOIC_RECORD_DIR.replace(/\/?$/, '/')}`) : new URL('../../public/apps/', import.meta.url);
const published = (name) => JSON.parse(fs.readFileSync(new URL(name, RECORD_DIR), 'utf8'));
const chapterFiles = new Map();
const load = () => {
  const index = published('stoic-constitution.json');
  const full = new Map();
  for (const chapter of [...new Set(index.articles.map((stub) => stub.chapter))]) {
    chapterFiles.set(chapter, published(`stoic-constitution/${chapter}.json`));
    for (const article of chapterFiles.get(chapter).articles) full.set(article.number, article);
  }
  return {...index, stubs: index.articles, articles: index.articles.map((stub) => full.get(stub.number))};
};
const record = load();
const topics = read('content/aurelius/topics.json');
const map = read('content/aurelius/backup-map.json');
const points = new Map(map.points.map((point) => [point.revision_id, point]));
const escape = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const occurrences = (text, quote) => [...text.matchAll(new RegExp(quote.split(/\s+/).map(escape).join('\\s+'), 'gu'))].length;
const refOf = (id) => id.replace(/[a-z]+$/, '');

test('the topic hierarchy places every passage of the published map in exactly one section', () => {
  const members = topics.chapters.flatMap((chapter) => chapter.sections.flatMap((section) => section.members));
  assert.equal(members.length, map.points.length);
  assert.equal(new Set(members.map((member) => member.revision_id)).size, map.points.length);
  for (const member of members) assert.ok(points.has(member.revision_id), `${member.reference} is a published revision`);
  assert.equal(topics.source_vector_hash, map.vector_hash);
  assert.equal(topics.corpus_hash, map.corpus_hash);
  for (const chapter of topics.chapters) assert.equal(chapter.size, chapter.sections.reduce((sum, section) => sum + section.size, 0));
});

test('the index is small and lists every article; each chapter file holds exactly that chapter\'s articles', () => {
  const size = fs.statSync(new URL('stoic-constitution.json', RECORD_DIR)).size;
  assert.ok(size < 60 * 1024, `index is ${size} bytes`);
  const chapterOf = new Map(topics.chapters.flatMap((chapter) => chapter.sections.map((section) => [section.id, chapter.id])));
  for (const [index, stub] of record.stubs.entries()) {
    const article = record.articles[index];
    assert.ok(article, `article ${stub.number} is in its chapter file`);
    assert.equal(stub.chapter, chapterOf.get(stub.section));
    assert.equal(stub.title, article.title);
    assert.equal(stub.statement.t, article.statement.t);
    assert.deepEqual(stub.counts, {claims: article.claims.length, single: article.single.length, sources: article.sources.length, section_size: article.section_size});
    for (const [key, voice] of Object.entries(article.voices)) assert.deepEqual(stub.voices[key].counts, voice.counts);
  }
  // Each chapter file holds exactly its chapter's articles, in the index's order, once each.
  for (const [chapter, file] of chapterFiles) {
    const expected = record.stubs.filter((stub) => stub.chapter === chapter).map((stub) => stub.number);
    assert.deepEqual(file.articles.map((article) => article.number), expected, `chapter file ${chapter}.json must hold articles ${expected.join(', ')} in order, once each`);
  }
  const files = fs.readdirSync(new URL('stoic-constitution/', RECORD_DIR)).filter((name) => name.endsWith('.json')).sort();
  assert.deepEqual(files, [...new Set(record.stubs.map((stub) => stub.chapter))].map((id) => id + '.json').sort());
});

test('the topic artifact carries references and numbers only', () => {
  assert.equal(topics.share_mode, 'references_and_numbers_only');
  assert.ok(!JSON.stringify(topics).includes('"text"'));
});

test('every chapter and section has a name, and every chapter with an article was named from a full reading', () => {
  assert.equal(record.chapters.length, topics.chapters.length);
  assert.deepEqual(record.chapters.map((chapter) => chapter.order), record.chapters.map((_, index) => index + 1));
  for (const chapter of record.chapters) {
    assert.ok(chapter.title && chapter.summary);
    for (const section of chapter.sections) assert.ok(section.title, `${section.id} is named`);
  }
  const written = new Set(record.articles.map((article) => article.section.split('.')[0]));
  for (const chapter of record.chapters) {
    if (written.has(chapter.id)) assert.equal(chapter.read, 'full', `${chapter.id} has articles, so it was read in full`);
    else assert.ok(['full', 'central'].includes(chapter.read), chapter.id);
  }
});

test('articles are numbered without gaps, each from its own section, in chapter order then section order', () => {
  assert.deepEqual(record.articles.map((article) => article.number), record.articles.map((_, index) => index + 1));
  assert.equal(new Set(record.articles.map((article) => article.section)).size, record.articles.length);
  const order = [...record.chapters].sort((a, b) => a.order - b.order)
    .flatMap((chapter) => topics.chapters.find((item) => item.id === chapter.id).sections.map((section) => section.id));
  const positions = record.articles.map((article) => order.indexOf(article.section));
  assert.ok(positions.every((position) => position >= 0), 'every article section is in the hierarchy');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'articles follow chapter order, then section order');
  for (const article of record.articles) {
    const section = topics.chapters.flatMap((chapter) => chapter.sections).find((item) => item.id === article.section);
    assert.deepEqual(article.members.map((member) => member.revision), section.members.map((member) => member.revision_id));
  }
});

const piecesOf = (article) => [...article.claims.flatMap((claim) => claim.support), ...article.single];

test('quoted passages are the immutable published text, and every quote is one exact span', () => {
  for (const article of record.articles) {
    // An article anchored in the project's translation quotes that English; member.text stays the immutable 1634 text.
    const texts = new Map(article.members.map((member) => [member.ref, article.edition ? member.english : member.text]));
    if (article.edition) for (const member of article.members) assert.ok(member.english && member.greek && member.standard && member.translation, `article ${article.number}: ${member.ref} is translated`);
    for (const member of article.members) {
      assert.equal(crypto.createHash('sha256').update(member.text).digest('hex'), points.get(member.revision).text_hash, `${member.ref} text matches its hash`);
      assert.equal(points.get(member.revision).reference, member.ref);
    }
    const ids = new Set();
    for (const piece of piecesOf(article)) {
      const text = texts.get(piece.ref);
      assert.ok(text && !ids.has(piece.id), `article ${article.number} ${piece.id}`);
      ids.add(piece.id);
      assert.equal(occurrences(text, piece.quote), 1, `article ${article.number} ${piece.id} is unambiguous`);
      assert.equal(text.slice(piece.at, piece.at + piece.quote.length), piece.quote);
      assert.equal(Array.from(text).slice(piece.start, piece.end).join(''), piece.quote);
      assert.equal(refOf(piece.id), piece.ref);
    }
  }
});

test('a fused claim rests on at least two passages, says what they share, and each quote names the words it backs', () => {
  for (const article of record.articles) {
    // An article whose section shares no claim says so in `unfused` and has none (Article 29); every other one fuses.
    if (article.unfused) { assert.ok(article.claims.length === 0 && article.unfused.reason.length >= 40, `article ${article.number}: unfused`); continue; }
    const least = article.section_size >= 8 ? 3 : 1;
    assert.ok(article.claims.length >= least, `article ${article.number} fuses at least ${least} claim(s) from a section of ${article.section_size}`);
    for (const claim of article.claims) {
      const where = `article ${article.number} claim ${claim.number}`;
      assert.deepEqual(claim.passages, [...new Set(claim.support.map((piece) => piece.ref))], where);
      assert.ok(claim.passages.length >= 2, `${where} is fused from more than one passage`);
      assert.ok(claim.role && claim.t && claim.shared, where);
      assert.ok(claim.closeness > 0 && claim.closeness < 1, where);
      for (const piece of claim.support) {
        assert.ok(piece.gives?.length || piece.note, `${where} ${piece.id} says what it contributes`);
        for (const words of piece.gives ?? []) assert.ok(claim.t.toLowerCase().includes(words.toLowerCase()), `${where} ${piece.id}: “${words}” is in the claim`);
      }
    }
  }
});

test('what only one passage says is kept apart with the reason, and never counted as fused', () => {
  for (const article of record.articles) {
    for (const item of article.single) assert.ok(item.label && item.t && item.why.length > 20, `article ${article.number} ${item.id}`);
  }
});

// What is wrong with an article's statement, as a list of sentences; empty when it is sound.
// Russian runs about a third longer than English, so the Russian edition passes a longer limit.
const statementProblems = (article, longest = 140) => {
  const where = `article ${article.number}`, problems = [];
  const ids = new Map([...article.claims.flatMap((claim) => claim.support), ...article.single].map((piece) => [piece.id, piece]));
  const { statement } = article;
  if (!(statement.t.length > 30 && statement.t.length < longest && statement.kind && statement.form)) problems.push(`${where}: statement length (${statement.t.length}, under ${longest}), kind or form`);
  if (statement.parts.length < 2) problems.push(`${where}: the statement is traced in parts`);
  for (const part of statement.parts) {
    if (!statement.t.toLowerCase().includes(part.words.toLowerCase())) problems.push(`${where}: “${part.words}” is not in the statement`);
    if (JSON.stringify(part.refs) !== JSON.stringify([...new Set(part.ids.map((id) => ids.get(id).ref))])) problems.push(`${where}: “${part.words}” refs do not match its ids`);
    // A section of fewer than five passages may have parts resting on one passage, but not all of them.
    if (!part.ids.length || !part.refs.length) problems.push(`${where}: “${part.words}” has no witness: every part needs at least one quoted piece`);
    else if (article.section_size >= 5 && part.refs.length < 2 && !article.unfused) problems.push(`${where}: “${part.words}” rests on fewer than two passages`);
  }
  if (!article.unfused && !statement.parts.some((part) => part.refs.length >= 2)) problems.push(`${where}: no part rests on two passages`);
  return problems;
};

test('each article makes one short statement whose parts each rest on quoted pieces from two or more passages', () => {
  for (const article of record.articles) {
    assert.deepEqual(statementProblems(article), []);
    assert.ok(article.decisions.length && article.limit);
  }
});

test('in a small section every statement part still needs a witness (synthetic four-passage case)', () => {
  const small = structuredClone(record.articles.find((article) => article.number === 6));
  small.section_size = 4;
  small.statement.parts[0].ids = [];
  small.statement.parts[0].refs = [];
  assert.ok(statementProblems(small).some((problem) => problem.includes('witness')), `the rule accepted a part with no witness: ${JSON.stringify(statementProblems(small))}`);
});

test('subarticles sit under the same five labels in every article, each claim and single item under exactly one', () => {
  const keys = ['why', 'action', 'practice', 'breaks', 'doubt'];
  assert.deepEqual(record.labels.map((label) => label.key), keys);
  for (const article of record.articles) {
    const where = `article ${article.number}`;
    assert.deepEqual(article.groups.map((group) => group.key), keys, where);
    const placed = article.groups.flatMap((group) => group.items);
    assert.deepEqual([...placed].sort(), [...article.claims.map((claim) => claim.id), ...article.single.map((item) => item.id)].sort(), where);
    for (const group of article.groups) {
      assert.ok(group.name && group.asks, where);
      assert.equal(Boolean(group.empty), group.items.length === 0, `${where} ${group.key}: an empty label says why it is empty`);
    }
    // Claims are numbered in the order they are read.
    assert.deepEqual(article.groups.flatMap((group) => group.claims).map((id) => article.claims.find((claim) => claim.id === id).number),
      article.claims.map((_, index) => index + 1), where);
  }
});

// Claim components (runs of words backed by the same passages) per article, and how many rest on two or more passages.
const sharedOf = (article) => {
  let components = 0, shared = 0;
  for (const claim of article.claims) {
    const cover = Array.from(claim.t, () => new Set());
    for (const piece of claim.support) {
      for (const words of piece.gives ?? []) {
        const at = claim.t.toLowerCase().indexOf(words.toLowerCase());
        for (let i = at; i < at + words.length; i += 1) cover[i].add(piece.ref);
      }
    }
    const keys = cover.map((refs) => [...refs].sort().join('|'));
    keys.forEach((key, i) => { if (key && key !== keys[i - 1]) { components += 1; if (key.includes('|')) shared += 1; } });
  }
  return {shared, components};
};
// Until milestone N3 a named list exempted the articles then below the bar (1, 4 and 5). The audit of 23 Nov 2026 brought
// every article above it, so there is no list any more: an article below the bar fails.
test('each article has enough claim components resting on more than one passage', () => {
  for (const article of record.articles.filter((item) => !item.unfused)) {
    const {shared, components} = sharedOf(article);
    const meets = article.section_size >= 8 ? shared * 3 >= components : shared >= 1;
    const bar = article.section_size >= 8 ? 'a third' : 'one (small section)';
    assert.ok(meets, `article ${article.number}: ${shared} of ${components} claim components rest on more than one passage; the bar is ${bar}`);
  }
});

test('every quoted piece carries its own one-sentence conclusion', () => {
  for (const article of record.articles) {
    for (const piece of [...article.claims.flatMap((claim) => claim.support), ...article.single]) {
      assert.ok(typeof piece.follows === 'string' && piece.follows.length > 20 && piece.follows.length < 170 && /\.$/.test(piece.follows), `article ${article.number} ${piece.id}`);
      assert.ok(!/\b(thou|thee|thy|doth|hath)\b/i.test(piece.follows), `article ${article.number} ${piece.id}: the conclusion is in plain modern English`);
    }
  }
});

test('each source passage has one of five colours, and passages that meet in a sentence never share one', () => {
  for (const article of record.articles) {
    const where = `article ${article.number}`;
    assert.deepEqual(Object.keys(article.colors).sort(), [...article.sources].sort(), where);
    for (const slot of Object.values(article.colors)) assert.ok(Number.isInteger(slot) && slot >= 1 && slot <= 5, where);
    for (const group of [...article.claims.map((claim) => claim.passages), ...article.statement.parts.map((part) => part.refs)]) {
      assert.equal(new Set(group.map((ref) => article.colors[ref])).size, group.length, `${where}: ${group.join(', ')} have distinct colours`);
    }
    // Anywhere in the statement, passages differ in colour whenever five colours are enough to keep them all apart.
    const lead = [...new Set(article.statement.parts.flatMap((part) => part.refs))];
    if (lead.length <= 5) assert.equal(new Set(lead.map((ref) => article.colors[ref])).size, lead.length, `${where}: the statement's passages ${lead.join(', ')} share a colour although five colours would keep them apart`);
  }
});

test('the vector map covers the whole section, reports its distortion, and carries the exact similarities', () => {
  for (const article of record.articles) {
    const where = `article ${article.number}`;
    const { refs, points, sim, stress, lowest, highest } = article.map;
    assert.deepEqual(refs, article.members.map((member) => member.ref), where);
    assert.equal(points.length, refs.length, where);
    assert.ok(points.every(([x, y]) => Math.abs(x) <= 1 && Math.abs(y) <= 1), where);
    // Three points always fit a flat map exactly, so a section of three or fewer passages has no distortion to report.
    assert.ok((refs.length <= 3 ? stress >= 0 : stress > 0) && stress < 0.4, `${where}: stress ${stress}`);
    const off = [];
    sim.forEach((line, i) => line.forEach((value, j) => {
      assert.equal(value, sim[j][i], `${where}: similarity is symmetric`);
      if (i === j) assert.equal(value, 1, where); else off.push(value);
    }));
    assert.equal(Math.min(...off), lowest, where);
    assert.equal(Math.max(...off), highest, where);
    const { around } = article.map;
    assert.equal(around.near.length, 4, where);
    assert.ok(around.near.every((item, i) => item.id !== article.section && item.title && (i === 0 || item.similarity <= around.near[i - 1].similarity)), where);
    assert.equal(around.near[0].similarity, around.highest, where);
    assert.ok(around.lowest < around.near[3].similarity && around.outside.length === 3 && around.outside_closer >= 0, where);
  }
});

test('Seneca is added as stronger, wider or qualified items, each resting on one exact span of his letters', () => {
  assert.deepEqual(record.effects.map((effect) => effect.key), ['stronger', 'wider', 'qualified']);
  assert.deepEqual(record.authors.map((author) => [author.key, author.units, author.reference_prefix]), [['seneca', 124, 'Ep.']]);
  assert.ok(record.authors.every((author) => author.mark && author.line && author.author_gap > 0), 'each added author has its own mark and line');
  for (const article of record.articles.filter((item) => item.voices?.seneca)) {
    const where = `article ${article.number}`;
    assert.deepEqual(Object.keys(article.voices), ['seneca'], where);
    const { seneca } = article.voices;
    assert.ok(seneca.becomes.length > 60 && seneca.statement.length > 30, where);
    const texts = new Map(seneca.passages.map((passage) => [passage.ref, passage.text]));
    const claims = new Map(article.claims.map((claim) => [claim.id, claim]));
    const labels = record.labels.map((label) => label.key);
    const seen = new Set();
    const check = (piece, sentence) => {
      assert.ok(typeof piece.context === 'string' && piece.context.length >= 20 && piece.context.length <= 200,
        `${where} ${piece.id}: every added piece carries its context sentence`);
      assert.match(piece.ref, /^Ep\. \d+\.\d+$/, `${where} ${piece.id}`);
      assert.equal(piece.author, 'seneca', `${where} ${piece.id}`);
      assert.ok(!seen.has(piece.id), `${where} ${piece.id} is used once`);
      seen.add(piece.id);
      assert.equal(occurrences(texts.get(piece.ref), piece.quote), 1, `${where} ${piece.id} is one exact span`);
      assert.equal(texts.get(piece.ref).slice(piece.at, piece.at + piece.quote.length), piece.quote, `${where} ${piece.id}`);
      assert.ok(piece.follows.length > 20 && !/\b(thou|thee|thy)\b/i.test(piece.follows), `${where} ${piece.id} has a plain conclusion`);
      for (const words of piece.gives ?? []) assert.ok(sentence.toLowerCase().includes(words.toLowerCase()), `${where} ${piece.id}: “${words}”`);
    };
    for (const item of seneca.items) {
      if (item.effect === 'stronger') {
        assert.ok(item.piece.gives.length, `${where} ${item.piece.id} names the words it backs`);
        check(item.piece, claims.get(item.claim).t);
      } else if (item.effect === 'wider') {
        assert.ok(labels.includes(item.label) && item.role && item.why.length > 30, `${where} ${item.key}`);
        for (const piece of item.support) check(piece, item.t);
      } else {
        assert.equal(item.effect, 'qualified');
        assert.ok(claims.has(item.claim) && item.t.length > 60, `${where} ${item.key}`);
        for (const piece of item.support) check(piece, item.t);
      }
    }
    for (const effect of ['stronger', 'wider', 'qualified']) assert.equal(seneca.counts[effect], seneca.items.filter((item) => item.effect === effect).length, where);
    assert.ok(seneca.items.length >= 1, `${where}: Seneca has at least one item`);
    // Clauses he adds to the body: each continues the statement or a claim, says what it does, and rests on his own pieces.
    if (seneca.counts.wider + seneca.counts.qualified > 0) assert.ok(seneca.amend.length >= 1, `${where} says in the body what Seneca adds, changes or challenges`);
    const targets = new Set();
    for (const clause of seneca.amend) {
      assert.ok(clause.target === 'statement' || claims.has(clause.target), `${where} clause target ${clause.target}`);
      assert.ok(!targets.has(clause.target), `${where}: one clause per sentence (${clause.target})`);
      targets.add(clause.target);
      assert.ok(['adds', 'changes', 'challenges', 'limits'].includes(clause.kind), `${where} clause kind ${clause.kind}`);
      // A clause that limits or challenges a claim comes from an item that limits that same claim.
      if (clause.target !== 'statement' && ['challenges', 'limits'].includes(clause.kind)) {
        assert.ok(seneca.items.some((item) => item.effect === 'qualified' && item.claim === clause.target && (clause.from || []).includes(item.key)), `${where}: the clause on ${clause.target} ${clause.kind} it, but no item of that kind stands on that claim`);
      }
      assert.match(clause.t, /^[ ,;]/, `${where}: a clause continues the sentence`);
      assert.ok(!/[.!?]\s*$/.test(clause.t) && clause.t.trim().length >= 20 && clause.t.length <= 140, `${where}: “${clause.t}”`);
      assert.ok(clause.ids.length && clause.ids.every((id) => seen.has(id)), `${where}: a clause rests on Seneca's quoted pieces (${clause.ids})`);
    }
    // Marcus's own wording and support never change when Seneca is added: his clauses are appended and marked as his.
    assert.ok(article.claims.every((claim) => claim.support.every((piece) => !piece.author)), where);
    for (const passage of seneca.passages) {
      assert.ok(article.sources.includes(passage.nearest.ref) && passage.rank >= 1 && passage.rank <= seneca.total, `${where} ${passage.ref}`);
      assert.ok(Math.abs(passage.at[0]) <= 1 && Math.abs(passage.at[1]) <= 1, `${where} ${passage.ref}`);
    }
  }
});

test('every passage of a section either feeds the article or is set aside with a reason', () => {
  for (const article of record.articles) {
    assert.equal(article.members.length, article.section_size);
    const quoted = new Set(piecesOf(article).map((piece) => piece.ref));
    assert.deepEqual(article.sources, article.members.filter((member) => member.used).map((member) => member.ref));
    for (const member of article.members) {
      assert.equal(member.used, quoted.has(member.ref));
      if (member.used) assert.ok(member.feeds.length); else assert.ok(member.why && member.why.length > 20, `article ${article.number}: ${member.ref} has a reason`);
    }
    assert.ok(article.sources.length * 2 > article.section_size, `article ${article.number} draws on most of its section`);
  }
});

test('Seneca is published only in the project’s own translation from the Latin', () => {
  // content/aurelius/translation/seneca-v1.json holds the Latin and the English of every quoted section; the page carries
  // its text and revision, and every quote is a span of that English. Gummere's 1917–25 English is never published.
  const own = new Map(read('content/aurelius/translation/seneca-v1.json').passages.map((p) => [p.ref, p]));
  assert.match(record.authors[0].translator, /This project, from the Latin/);
  for (const article of record.articles) {
    const voice = article.voices?.seneca;
    if (!voice) continue;
    for (const passage of voice.passages) {
      const mine = own.get(passage.ref);
      assert.ok(mine, `article ${article.number}: ${passage.ref} is not in the project's translation`);
      assert.equal(passage.revision, mine.revision, `article ${article.number}: ${passage.ref} is not the stored revision`);
      assert.equal(passage.text, mine.english, `article ${article.number}: ${passage.ref} text differs from the stored English`);
    }
  }
});

// ---------- the Russian edition ----------
// scripts/aurelius-constitution.py --lang ru writes stoic-constitution.ru.json and stoic-constitution/ru/<chapter>.json from the
// overlay content/aurelius/translation/articles-ru-v1.json and the passages' Russian in ru-v1.json. Until the overlay is merged and
// built, these tests skip and say so. STOIC_RU_DIR points them at another build (a development build is --partial and fails the
// completeness test on purpose).
const RU_DIR = process.env.STOIC_RU_DIR ? new URL(`file://${process.env.STOIC_RU_DIR.replace(/\/?$/, '/')}`) : RECORD_DIR;
const OVERLAY_URL = new URL('../../content/aurelius/translation/articles-ru-v1.json', import.meta.url);
const ruIndexUrl = new URL('stoic-constitution.ru.json', RU_DIR);
const ruSkip = !fs.existsSync(ruIndexUrl) ? `the Russian record ${ruIndexUrl.pathname} is not built yet (merge the overlay, then run scripts/aurelius-constitution.py --lang ru)`
  : !process.env.STOIC_RU_DIR && !fs.existsSync(OVERLAY_URL) ? 'the Russian record exists but the overlay articles-ru-v1.json does not' : false;
const ruRecord = ruSkip ? null : (() => {
  const index = JSON.parse(fs.readFileSync(ruIndexUrl, 'utf8')), full = new Map();
  for (const chapter of [...new Set(index.articles.map((stub) => stub.chapter))]) {
    for (const article of JSON.parse(fs.readFileSync(new URL(`stoic-constitution/ru/${chapter}.json`, RU_DIR), 'utf8')).articles) full.set(article.number, article);
  }
  return {...index, stubs: index.articles, articles: index.articles.map((stub) => full.get(stub.number))};
})();
const russianOf = new Map(ruSkip ? [] : read('content/aurelius/translation/ru-v1.json').passages.map((p) => [p.work + ':' + p.ref, p]));
const inRussian = (article) => ruRecord.overlay.articles.includes(article.number);
// The paths of an authored article that carry words the page shows (the same rule as the build's overlay_paths).
const RU_TEXT_KEYS = new Set(['title', 't', 'kind', 'form', 'why', 'role', 'shared', 'changed', 'follows', 'note', 'label', 'limit', 'context',
  'becomes', 'statement', 'words', 'doubt', 'action', 'practice', 'breaks']);
const RU_ID = /^(?:[a-z]?\d+(?:\.\d+)*[a-z]?|c\d+|w\d+|S[\d.]+[a-z])$/;
const overlayPaths = (article) => {
  const out = new Set();
  const walk = (x, path) => {
    if (Array.isArray(x)) x.forEach((v, i) => walk(v, [...path, i]));
    else if (x && typeof x === 'object') { for (const [k, v] of Object.entries(x)) if (k !== 'searched') walk(v, [...path, k]); }
    else if (typeof x === 'string') {
      const key = [...path].reverse().find((p) => typeof p === 'string') || '';
      if ((['quote', 'gives', 'decisions'].includes(key) || RU_TEXT_KEYS.has(key) || ['limit', 'decisions', 'aside', 'empty'].includes(path[0])) && !RU_ID.test(x)) out.add(path.join('/'));
    }
  };
  walk(article, []);
  return out;
};
// English in a Russian string: three or more words in Latin letters that make up 40% or more of its letters. Names, references and
// a Greek term in transliteration stay allowed.
const LATIN_OK = /^(Ep|EPUB|OpenAI|text|embedding|large|Claude|Opus|[ivxlcdm]+)$/i;
const english = (text) => {
  const latin = (text.match(/[A-Za-z][A-Za-z’'-]+/g) || []).filter((word) => !LATIN_OK.test(word));
  return latin.length >= 3 && latin.join('').length >= 0.4 * (text.match(/\p{L}/gu) || []).length;
};

test('Russian: the overlay is complete and current, and every passage’s Russian was made from the published English', {skip: ruSkip}, () => {
  const authored = read('content/aurelius/constitution.json');
  const overlay = process.env.STOIC_RU_DIR && !fs.existsSync(OVERLAY_URL) ? null : JSON.parse(fs.readFileSync(OVERLAY_URL, 'utf8'));
  assert.equal(ruRecord.language, 'ru');
  assert.equal(ruRecord.overlay.partial, false, 'the published Russian record is not a development (partial) build');
  assert.deepEqual(ruRecord.overlay.articles, authored.articles.map((article) => article.number), 'every article is in Russian');
  if (overlay) {
    assert.equal(ruRecord.overlay.id, overlay.id);
    for (const article of authored.articles) {
      const want = overlayPaths(article), have = new Set(Object.keys(overlay.articles[String(article.number)] || {}));
      assert.deepEqual([...want].filter((p) => !have.has(p)), [], `article ${article.number}: paths of the English without a Russian`);
      assert.deepEqual([...have].filter((p) => !want.has(p)), [], `article ${article.number}: paths not in the present English (the English changed under the overlay)`);
    }
    const letters = read('content/aurelius/translation/seneca-v1.json').letters;
    const global = [...authored.labels.flatMap((l, i) => ['name', 'asks'].map((k) => `labels/${i}/${k}`)), ...authored.effects.flatMap((l, i) => ['name', 'asks'].map((k) => `effects/${i}/${k}`)),
      ...Object.keys(authored.chapters).flatMap((c) => [`chapters/${c}/title`, `chapters/${c}/summary`]), 'chapter_order_note', ...Object.keys(letters).map((n) => `letters/${n}`)];
    assert.deepEqual(Object.keys(overlay.global).sort(), global.sort(), 'the page-wide strings');
  }
  // Every Russian passage was made from the English published now.
  const current = new Map([...read('content/aurelius/translation/project-v1.json').passages.map((p) => ['marcus:' + p.standard_ref, p.revision]),
    ...read('content/aurelius/translation/seneca-v1.json').passages.map((p) => ['seneca:' + p.ref, p.revision])]);
  const stale = [...russianOf.values()].filter((p) => current.get(p.work + ':' + p.ref) !== p.english_revision).map((p) => p.ref);
  assert.deepEqual(stale, [], 'Russian made from an English that is no longer published');
});

test('Russian: every quote is one exact span of its passage’s Russian, and the passages are the stored Russian', {skip: ruSkip}, () => {
  for (const article of ruRecord.articles.filter(inRussian)) {
    const where = `article ${article.number}`;
    const texts = new Map(article.members.map((member) => [member.ref, member.text]));
    for (const member of article.members) {
      const stored = russianOf.get('marcus:' + member.standard);
      assert.ok(stored && member.text === stored.russian && member.russian === stored.revision, `${where}: ${member.ref} is the stored Russian of ${member.standard}`);
    }
    for (const piece of piecesOf(article)) {
      const text = texts.get(piece.ref);
      assert.equal(occurrences(text, piece.quote), 1, `${where} ${piece.id} is one exact span of the Russian`);
      assert.equal(text.slice(piece.at, piece.at + piece.quote.length), piece.quote, `${where} ${piece.id}`);
      assert.equal(Array.from(text).slice(piece.start, piece.end).join(''), piece.quote, `${where} ${piece.id}`);
    }
    const seneca = article.voices?.seneca;
    if (!seneca) continue;
    const letters = new Map(seneca.passages.map((passage) => [passage.ref, passage.text]));
    for (const passage of seneca.passages) {
      const stored = russianOf.get('seneca:' + passage.ref);
      assert.ok(stored && passage.text === stored.russian && passage.russian === stored.revision, `${where}: ${passage.ref} is the stored Russian`);
    }
    for (const item of seneca.items) {
      for (const piece of item.piece ? [item.piece] : item.support) {
        assert.equal(occurrences(letters.get(piece.ref), piece.quote), 1, `${where} ${piece.id} is one exact span of the Russian`);
        assert.equal(letters.get(piece.ref).slice(piece.at, piece.at + piece.quote.length), piece.quote, `${where} ${piece.id}`);
        assert.ok(piece.context.length >= 20 && piece.context.length <= 260, `${where} ${piece.id}: context of 20 to 260 characters`);
      }
    }
  }
});

test('Russian: gives phrases, statement parts and inferences stand in their Russian sentences', {skip: ruSkip}, () => {
  const once = (sentence, words) => [...sentence.matchAll(new RegExp('(?<![\\p{L}\\p{N}_])' + escape(words) + '(?![\\p{L}\\p{N}_])', 'gu'))].length;
  for (const article of ruRecord.articles.filter(inRussian)) {
    const where = `article ${article.number}`;
    assert.deepEqual(statementProblems(article, 190), [], where);
    for (const claim of article.claims) {
      for (const piece of claim.support) for (const words of piece.gives ?? []) assert.ok(claim.t.toLowerCase().includes(words.toLowerCase()), `${where} ${piece.id}: «${words}» is in claim ${claim.number}`);
      for (const item of claim.inferences ?? []) assert.equal(once(claim.t, item.words), 1, `${where} claim ${claim.number}: the inference «${item.words}» stands once`);
    }
    for (const item of article.statement.inferences ?? []) assert.equal(once(article.statement.t, item.words), 1, `${where} statement: the inference «${item.words}» stands once`);
    const seneca = article.voices?.seneca;
    for (const item of seneca?.items ?? []) {
      const sentence = item.effect === 'stronger' ? article.claims.find((claim) => claim.id === item.claim).t : item.t;
      for (const piece of item.piece ? [item.piece] : item.support) for (const words of piece.gives ?? []) assert.ok(sentence.toLowerCase().includes(words.toLowerCase()), `${where} ${piece.id}: «${words}»`);
    }
    for (const clause of seneca?.amend ?? []) assert.ok(/^[ ,;]/.test(clause.t) && !/[.!?]\s*$/.test(clause.t), `${where}: Seneca's clause continues the sentence: «${clause.t}»`);
  }
});

test('Russian: the shown strings carry no English beyond names and references', {skip: ruSkip}, () => {
  const found = [];
  const look = (where, value) => { if (typeof value === 'string' && english(value)) found.push(`${where}: ${value.slice(0, 60)}`); };
  look('status', ruRecord.status);
  look('vectors', ruRecord.method.vectors);
  for (const key of ['name', 'work', 'short']) look('author ' + key, ruRecord.authors[0][key]);
  for (const part of [...ruRecord.labels, ...ruRecord.effects]) { look('label', part.name); look('label', part.asks); }
  look('chapter_order_note', ruRecord.chapter_order_note);
  for (const chapter of ruRecord.chapters) { look(chapter.id, chapter.title); look(chapter.id, chapter.summary); for (const section of chapter.sections) look(section.id, section.title); }
  for (const article of ruRecord.articles.filter(inRussian)) {
    const at = `article ${article.number}`;
    for (const value of [article.title, article.statement.t, article.statement.kind, article.statement.form, article.limit, ...article.decisions]) look(at, value);
    for (const part of article.statement.parts) look(at, part.words);
    for (const group of article.groups) { look(at, group.name); look(at, group.asks); look(at, group.empty); }
    for (const claim of article.claims) {
      for (const value of [claim.role, claim.t, claim.shared, claim.changed, ...(claim.inferences ?? []).map((item) => item.why)]) look(`${at} ${claim.id}`, value);
      for (const piece of claim.support) for (const value of [piece.follows, piece.note, ...(piece.gives ?? [])]) look(`${at} ${piece.id}`, value);
    }
    for (const item of article.single) for (const value of [item.label, item.t, item.why, item.follows]) look(`${at} ${item.id}`, value);
    for (const member of article.members) look(`${at} ${member.ref}`, member.why);
    for (const item of article.map.around.near) look(`${at} neighbour`, item.title);
    const seneca = article.voices?.seneca;
    if (!seneca) continue;
    for (const value of [seneca.becomes, seneca.statement, ...seneca.amend.map((clause) => clause.t), ...seneca.passages.map((passage) => passage.title)]) look(`${at} seneca`, value);
    for (const item of seneca.items) {
      for (const value of [item.role, item.t, item.why]) look(`${at} seneca`, value);
      for (const piece of item.piece ? [item.piece] : item.support) for (const value of [piece.follows, piece.context, ...(piece.gives ?? [])]) look(`${at} ${piece.id}`, value);
    }
  }
  assert.deepEqual(found.slice(0, 10), [], `${found.length} shown strings look English`);
});

test('Russian: each article keeps the English one’s structure: numbers, ids, colours, map and counts', {skip: ruSkip}, () => {
  assert.deepEqual(ruRecord.stubs.map((stub) => [stub.number, stub.section, stub.chapter, stub.counts]), record.stubs.map((stub) => [stub.number, stub.section, stub.chapter, stub.counts]));
  for (const [index, article] of ruRecord.articles.entries()) {
    const en = record.articles[index], where = `article ${article.number}`;
    assert.deepEqual(article.colors, en.colors, `${where}: colours`);
    assert.deepEqual(article.map.points, en.map.points, `${where}: map`);
    assert.deepEqual(article.claims.map((claim) => [claim.id, claim.number, claim.passages, claim.support.map((piece) => piece.id)]),
      en.claims.map((claim) => [claim.id, claim.number, claim.passages, claim.support.map((piece) => piece.id)]), `${where}: claims`);
    assert.deepEqual(article.members.map((member) => [member.ref, member.used, member.feeds]), en.members.map((member) => [member.ref, member.used, member.feeds]), `${where}: members`);
    assert.deepEqual(article.statement.parts.map((part) => part.refs), en.statement.parts.map((part) => part.refs), `${where}: statement parts`);
    assert.deepEqual(Object.keys(article.voices), Object.keys(en.voices), where);
    for (const [key, voice] of Object.entries(article.voices)) assert.deepEqual(voice.counts, en.voices[key].counts, `${where}: ${key}`);
  }
  // The English record says nothing of a language; only the Russian one does.
  assert.equal(record.language, undefined);
});

// The English build is untouched by the Russian one: a fresh English build matches the published files byte for byte.
// Needs the private corpus under .aurelius/ (and about 25 s); skipped without it.
const CORPUS_DIR = new URL('../../.aurelius/corpora/', import.meta.url);
test('the published English record is exactly what the build writes now', {skip: !fs.existsSync(CORPUS_DIR) || process.env.STOIC_RECORD_DIR ? 'needs the private corpus under .aurelius/ and the published files' : false, timeout: 180000}, async () => {
  const {spawnSync} = await import('node:child_process');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = new URL('../../', import.meta.url).pathname;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'stoic-en-'));
  try {
    const done = spawnSync(path.join(root, 'apps/aurelius/.venv/bin/python'), [path.join(root, 'scripts/aurelius-constitution.py'), '--out-dir', out], {cwd: root, encoding: 'utf8'});
    assert.equal(done.status, 0, done.stderr.split('\n').slice(-3).join('\n'));
    const names = ['stoic-constitution.json', ...fs.readdirSync(path.join(out, 'stoic-constitution')).filter((name) => name.endsWith('.json')).map((name) => 'stoic-constitution/' + name)];
    for (const name of names) assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(new URL(name, RECORD_DIR))), `${name} differs from a fresh English build: rebuild, or the build changed the English`);
  } finally {
    fs.rmSync(out, {recursive: true, force: true});
  }
});

test('the page head starts downloading the chapter the page opens first', () => {
  // public/apps/stoic-constitution.html fetches the index and Article 1's chapter from <head> so the articles are not
  // delayed by the page's length (24 Nov 2026). The chapter it guesses must be the one the page opens when the link names
  // none: the chapter of the first article, in both languages.
  const html = fs.readFileSync(new URL('../../public/apps/stoic-constitution.html', import.meta.url), 'utf8');
  const guessed = (html.match(/const FIRST_CHAPTER = '(c\d+)'/) || [])[1];
  assert.ok(guessed, 'the head script names FIRST_CHAPTER');
  for (const name of ['stoic-constitution.json', 'stoic-constitution.ru.json']) assert.equal(published(name).articles[0].chapter, guessed, name);
  assert.match(html, /early\(RU \? 'stoic-constitution\.ru\.json' : 'stoic-constitution\.json'\)/, 'the index is taken from the early download');
  assert.match(html, /return early\('stoic-constitution\/'/, 'chapters are taken from the early download');
});
