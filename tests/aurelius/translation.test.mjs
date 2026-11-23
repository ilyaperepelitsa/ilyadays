// The project's own translation of the Meditations (pilot: six passages). Stored record, published file, and the rules
// scripts/aurelius-translation.py enforces: a revision never changes, notes quote the Greek exactly, today's English.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => JSON.parse(fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const stored = read('content/aurelius/translation/project-v1.json');
const published = read('public/apps/stoic-translation.json');
const chapter = read('public/apps/stoic-constitution/c6.json');
const revisionOf = (passage) => `${stored.id}:${passage.standard_ref}:${crypto.createHash('sha256')
  .update([stored.edition.id, passage.standard_ref, passage.greek, passage.english].join('\n'), 'utf8').digest('hex').slice(0, 16)}`;

test('the pilot translates exactly the passages of section c6.s6, each once', () => {
  const section = chapter.articles.find((article) => article.section === stored.scope);
  assert.ok(section, `an article is written on ${stored.scope}`);
  assert.deepEqual(stored.passages.map((passage) => passage.casaubon_revision).sort(), section.members.map((member) => member.revision).sort());
  assert.equal(new Set(stored.passages.map((passage) => passage.standard_ref)).size, stored.passages.length);
  for (const passage of stored.passages) {
    const member = section.members.find((item) => item.revision === passage.casaubon_revision);
    assert.equal(passage.casaubon_ref, member.ref, `Meditations ${passage.standard_ref}: the 1634 number`);
  }
});

test('a revision is the hash of its edition, reference, Greek and English, so no passage is edited in place', () => {
  for (const passage of stored.passages) {
    assert.equal(passage.revision, revisionOf(passage), `Meditations ${passage.standard_ref}: text changed without a new revision`);
    assert.ok(!passage.superseded.includes(passage.revision));
  }
});

test('the edition is recorded with its editor, dates, source, licence and the hash of the file used', () => {
  const { edition } = stored;
  for (const key of ['id', 'citation', 'editor', 'editor_died', 'year', 'source', 'file_sha256', 'retrieved', 'licence', 'rights']) assert.ok(edition[key], `edition.${key}`);
  assert.match(edition.file_sha256, /^[0-9a-f]{64}$/);
  assert.ok(new Date(stored.made) - new Date(edition.editor_died) > 100 * 365.25 * 86400e3, 'the editor died more than 100 years before the translation was made');
});

test('the English is today’s, the Greek is Greek, and every note quotes the Greek exactly', () => {
  for (const passage of stored.passages) {
    const where = `Meditations ${passage.standard_ref}`;
    assert.doesNotMatch(passage.english, /\b(thee|thou|thy|thine|doth|hath|saith|unto|whatsoever|shalt)\b/i, where);
    assert.match(passage.greek, /[Ͱ-Ͽἀ-῿]/, where);
    assert.ok(passage.notes.length >= 1, `${where}: at least one note on what the Greek leaves open`);
    for (const note of passage.notes) assert.ok(passage.greek.includes(note.greek) && note.note, `${where}: note “${note.greek}”`);
    for (const point of passage.check) assert.ok(passage.greek.includes(point.greek) && point.note && point.decided, `${where}: second reading “${point.greek}”`);
  }
});

test('the published file is the stored record with the 1634 text beside each passage', () => {
  assert.equal(published.id, stored.id);
  assert.deepEqual(published.passages.map((passage) => passage.revision), stored.passages.map((passage) => passage.revision));
  for (const passage of published.passages) {
    const mine = stored.passages.find((item) => item.revision === passage.revision);
    assert.equal(passage.english, mine.english);
    assert.equal(passage.greek, mine.greek);
    assert.ok(passage.casaubon.length > 40, `Meditations ${passage.standard_ref}: the 1634 text`);
  }
});

test('the new English is embedded with the corpus model, and the comparison with the 1634 English is published', () => {
  const { vectors } = published;
  assert.ok(vectors, 'run scripts/aurelius-translation.py --embed, then publish');
  assert.equal(vectors.dimensions, 3072);
  assert.equal(vectors.home.section, stored.scope);
  assert.ok(vectors.closeness > 0 && vectors.closeness < 1 && vectors.closeness_1634 > 0 && vectors.closeness_1634 < 1);
  assert.ok(vectors.stayed_home >= 0 && vectors.stayed_home <= published.passages.length);
  for (const passage of published.passages) {
    assert.ok(passage.vector.to_1634 > 0 && passage.vector.to_1634 < 1, `Meditations ${passage.standard_ref}: similarity to its 1634 text`);
    assert.ok(passage.vector.home_rank >= 1 && passage.vector.home_rank <= vectors.sections);
  }
  assert.equal(vectors.stayed_home, published.passages.filter((passage) => passage.vector.home_rank === 1).length);
});
