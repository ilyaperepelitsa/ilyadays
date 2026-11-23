import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

// The first constitution articles are published as a static record. It must stay tied to the
// published Casaubon map (immutable revisions and text hashes) and to the topic hierarchy.
const read = (path) => JSON.parse(fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const record = read('public/apps/stoic-constitution.json');
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

test('the topic artifact carries references and numbers only', () => {
  assert.equal(topics.share_mode, 'references_and_numbers_only');
  assert.ok(!JSON.stringify(topics).includes('"text"'));
});

test('every chapter and section has a name, and exactly the first chapter was named from a full reading', () => {
  assert.equal(record.chapters.length, topics.chapters.length);
  assert.deepEqual(record.chapters.map((chapter) => chapter.order), record.chapters.map((_, index) => index + 1));
  for (const chapter of record.chapters) {
    assert.ok(chapter.title && chapter.summary);
    for (const section of chapter.sections) assert.ok(section.title, `${section.id} is named`);
  }
  assert.deepEqual(record.chapters.filter((chapter) => chapter.read === 'full').map((chapter) => chapter.order), [1]);
});

test('five articles, one per section of the first chapter, each from its own section', () => {
  assert.deepEqual(record.articles.map((article) => article.number), [1, 2, 3, 4, 5]);
  const first = record.chapters[0];
  assert.deepEqual(record.articles.map((article) => article.section), first.sections.slice(0, 5).map((section) => section.id));
  for (const article of record.articles) {
    const section = topics.chapters.flatMap((chapter) => chapter.sections).find((item) => item.id === article.section);
    assert.deepEqual(article.members.map((member) => member.revision), section.members.map((member) => member.revision_id));
  }
});

const piecesOf = (article) => [...article.claims.flatMap((claim) => claim.support), ...article.single];

test('quoted passages are the immutable published text, and every quote is one exact span', () => {
  for (const article of record.articles) {
    const texts = new Map(article.members.map((member) => [member.ref, member.text]));
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
    assert.ok(article.claims.length >= 3, `article ${article.number} fuses at least three claims`);
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

test('each article makes one short statement whose parts each rest on quoted pieces from two or more passages', () => {
  for (const article of record.articles) {
    const where = `article ${article.number}`;
    const ids = new Map([...article.claims.flatMap((claim) => claim.support), ...article.single].map((piece) => [piece.id, piece]));
    const { statement } = article;
    assert.ok(statement.t.length > 30 && statement.t.length < 140 && statement.kind && statement.form, where);
    assert.ok(statement.parts.length >= 2, `${where}: the statement is traced in parts`);
    for (const part of statement.parts) {
      assert.ok(statement.t.toLowerCase().includes(part.words.toLowerCase()), `${where}: “${part.words}” is in the statement`);
      assert.deepEqual(part.refs, [...new Set(part.ids.map((id) => ids.get(id).ref))], `${where}: “${part.words}”`);
      assert.ok(part.refs.length >= 2, `${where}: “${part.words}” rests on more than one passage`);
    }
    assert.ok(article.decisions.length && article.limit);
  }
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

test('every quoted piece carries its own one-sentence conclusion, and enough components have more than one source', () => {
  let components = 0, shared = 0;
  for (const article of record.articles) {
    for (const piece of [...article.claims.flatMap((claim) => claim.support), ...article.single]) {
      assert.ok(typeof piece.follows === 'string' && piece.follows.length > 20 && piece.follows.length < 170 && /\.$/.test(piece.follows), `article ${article.number} ${piece.id}`);
      assert.ok(!/\b(thou|thee|thy|doth|hath)\b/i.test(piece.follows), `article ${article.number} ${piece.id}: the conclusion is in plain modern English`);
    }
    for (const claim of article.claims) {
      const cover = Array.from(claim.t, () => new Set());
      for (const piece of claim.support) {
        for (const words of piece.gives ?? []) {
          const at = claim.t.toLowerCase().indexOf(words.toLowerCase());
          for (let i = at; i < at + words.length; i += 1) cover[i].add(piece.ref);
        }
      }
      const keys = cover.map((refs) => [...refs].sort().join('|'));
      keys.forEach((key, i) => {
        if (key && key !== keys[i - 1]) { components += 1; if (key.includes('|')) shared += 1; }
      });
    }
  }
  assert.ok(shared / components >= 0.35, `${shared} of ${components} claim components rest on more than one passage`);
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
