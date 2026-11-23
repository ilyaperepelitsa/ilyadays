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
const statementProblems = (article) => {
  const where = `article ${article.number}`, problems = [];
  const ids = new Map([...article.claims.flatMap((claim) => claim.support), ...article.single].map((piece) => [piece.id, piece]));
  const { statement } = article;
  if (!(statement.t.length > 30 && statement.t.length < 140 && statement.kind && statement.form)) problems.push(`${where}: statement length, kind or form`);
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
