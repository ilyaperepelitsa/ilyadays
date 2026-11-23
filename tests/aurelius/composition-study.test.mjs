import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The composition study is a static page. Its embedded record must stay tied to the public
// Casaubon study: same revisions, same text, and every quoted piece resolving to one exact span.
const html = fs.readFileSync(new URL('../../public/apps/stoic-composition.html', import.meta.url), 'utf8');
const study = JSON.parse(html.match(/<script id="study" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const source = JSON.parse(fs.readFileSync(new URL('../../content/aurelius/backup-study.json', import.meta.url), 'utf8'));
const escape = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const occurrences = (text, quote) => [...text.matchAll(new RegExp(quote.split(/\s+/).map(escape).join('\\s+'), 'gu'))].length;
const pickAll = (value) => (value && typeof value === 'object' && !Array.isArray(value) && ('act' in value || 'method' in value)) ? [value.act, value.method] : [value];
const pairs = Object.entries(study.pairs);

test('embedded passages are the immutable public Casaubon revisions', () => {
  for (const [ref, passage] of Object.entries(study.passages)) {
    const original = source.passages.find((p) => p.revision_id === passage.revision);
    assert.ok(original, `${ref} revision exists in the public study`);
    assert.equal(`${original.book}.${original.section}`, ref);
    assert.equal(passage.text, original.text);
  }
});

test('every piece quotes one exact span and every relation points at a piece of the same passage', () => {
  for (const [name, pair] of pairs) {
    const ids = new Set(pair.pieces.map((piece) => piece.id));
    assert.equal(ids.size, pair.pieces.length, `${name} piece ids are unique`);
    for (const piece of pair.pieces) {
      const ref = pair.refs[piece.id[0] === 'A' ? 0 : 1];
      assert.equal(occurrences(study.passages[ref].text, piece.quote), 1, `${name} ${piece.id} quote is exact and unambiguous`);
      assert.ok(piece.note, `${name} ${piece.id} has a note`);
      for (const rel of pickAll(piece.rel).filter(Boolean)) {
        assert.ok(ids.has(rel.to), `${name} ${piece.id} relation target exists`);
        assert.equal(rel.to[0], piece.id[0], `${name} ${piece.id} relation stays inside its passage`);
        assert.match(rel.type, /^(supports|qualifies|challenges|illustrates|depends_on|paraphrases|answers)$/);
      }
      if (piece.refers?.to) assert.ok(ids.has(piece.refers.to));
    }
  }
});

test('every article phrase is attributed, and removing B never touches the words from A', () => {
  for (const [name, pair] of pairs) {
    const ids = new Set(pair.pieces.map((piece) => piece.id));
    assert.deepEqual(Object.keys(pair.joins), ['practice', 'argument', 'tests']);
    for (const [key, join] of Object.entries(pair.joins)) {
      const segs = join.entries.flatMap((entry) => entry.segs);
      assert.ok(join.limit && join.mech, `${name} ${key} states its limit and mechanism`);
      for (const seg of segs) {
        const where = `${name} ${key} “${pickAll(seg.t)[0]}”`;
        if (seg.by === 'E') {
          assert.ok(seg.note, `${where}: an editorial phrase explains its step`);
          assert.equal(seg.ids, undefined, `${where}: an editorial phrase claims no source words`);
        } else if (seg.by) {
          assert.ok(seg.ids?.length, `${where}: a source phrase names its pieces`);
          for (const id of seg.ids) {
            assert.ok(ids.has(id), `${where}: ${id} exists`);
            assert.equal(id[0], seg.by, `${where}: ${id} belongs to passage ${seg.by}`);
          }
          assert.notEqual(seg.by === 'A' && seg.needsB, true, `${where}: words from A survive without B`);
        }
        for (const id of seg.leans ?? []) assert.ok(ids.has(id), `${where}: leans on an existing piece`);
      }
      const survivors = segs.filter((seg) => seg.by !== 'B' && !seg.needsB);
      assert.ok(survivors.some((seg) => seg.by === 'A'), `${name} ${key}: something from A remains without B`);
      if (join.outcome === 'join') assert.ok(segs.some((seg) => seg.by === 'B'), `${name} ${key}: a join uses B`);
    }
  }
});

test('the declined join marks both branches as supplying no standard', () => {
  const declined = study.pairs.judgment.joins.tests;
  assert.equal(declined.outcome, 'separate');
  assert.equal(declined.mech.branches.length, 2);
  assert.ok(declined.mech.branches.every((branch) => branch.fail));
});

test('8.12 keeps its condition wherever its instruction is used', () => {
  for (const join of Object.values(study.pairs.judgment.joins)) {
    const used = new Set(join.entries.flatMap((entry) => entry.segs.flatMap((seg) => seg.ids ?? [])));
    if (used.has('A2')) assert.ok(used.has('A3') && used.has('A4'), 'consider travels with its condition and object');
  }
});
