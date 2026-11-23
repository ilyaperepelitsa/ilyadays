// The project's own translation of the Meditations, section by section. Stored record, published file, and the rules
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

const topics = read('content/aurelius/topics.json');
const sectionOf = new Map(topics.chapters.flatMap((c) => c.sections.flatMap((s) => s.members.map((m) => [m.revision_id, s.id]))));
const STANDARD = /^\d{1,2}\.\d{1,2}[a-d]?(?:–\d{1,2}[a-d]?)?$/;

test('translation goes section by section: every passage of a listed section is translated once, and none from outside', () => {
  assert.ok(stored.sections.length >= 1 && new Set(stored.sections).size === stored.sections.length);
  assert.ok(stored.sections.includes('c6.s6'), 'the pilot section');
  const expected = topics.chapters.flatMap((c) => c.sections).filter((s) => stored.sections.includes(s.id)).flatMap((s) => s.members.map((m) => m.revision_id));
  assert.deepEqual(stored.passages.map((passage) => passage.casaubon_revision).sort(), expected.sort());
  assert.equal(new Set(stored.passages.map((passage) => passage.standard_ref)).size, stored.passages.length);
  for (const passage of stored.passages) {
    assert.match(passage.standard_ref, STANDARD, `Meditations ${passage.standard_ref}`);
    assert.ok(passage.casaubon_revision.startsWith(`casaubon-gutenberg-2680-${passage.casaubon_ref.replace('.', '-')}:`), `Meditations ${passage.standard_ref}: the 1634 number`);
  }
  // Article 6 quotes the pilot section, and its passages carry the same numbers.
  const article = chapter.articles.find((item) => item.section === 'c6.s6');
  for (const member of article.members) assert.equal(stored.passages.find((p) => p.casaubon_revision === member.revision).casaubon_ref, member.ref);
});

test('a passage that covers part of a modern chapter says which Greek it leaves out, and no other passage carries a part', () => {
  for (const passage of stored.passages) {
    const where = `Meditations ${passage.standard_ref}`;
    if (/[a-d]/.test(passage.standard_ref)) {
      assert.ok(passage.part && passage.part.why.length > 20, `${where}: why the 1634 translation cuts here`);
      assert.match(passage.part.left_out, /[Ͱ-Ͽἀ-῿]/, where);
      assert.ok(!passage.greek.includes(passage.part.left_out), `${where}: the Greek left out is not in the passage`);
    } else assert.equal(passage.part, undefined, where);
  }
});

test('what the owner has said about the translation is recorded in their words, with the reading of it marked as the editor’s', () => {
  assert.ok(stored.owner.length >= 1);
  for (const entry of stored.owner) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(entry.date) && entry.said && entry.about && entry.read_as, 'date, their words, what about, and how it was read');
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
    // Present, and not the new English. (Some passages are one line: 7.12 is 38 characters in 1634.)
    assert.ok(passage.casaubon.trim().length > 0 && passage.casaubon !== passage.english, `Meditations ${passage.standard_ref}: the 1634 text`);
  }
});

test('the published file reads section by section', () => {
  assert.deepEqual(published.sections.map((section) => section.id), stored.sections);
  for (const section of published.sections) {
    assert.ok(section.title && section.passages >= 1, section.id);
    assert.equal(section.passages, published.passages.filter((passage) => passage.section === section.id).length, section.id);
  }
  const order = published.passages.map((passage) => stored.sections.indexOf(passage.section));
  assert.deepEqual(order, [...order].sort((x, y) => x - y), 'passages are grouped by section, in the order the sections were translated');
  for (const passage of published.passages) assert.equal(passage.section, sectionOf.get(passage.casaubon_revision));
});

test('the new English is embedded with the corpus model, and the comparison with the 1634 English is published per section', () => {
  const { vectors } = published;
  assert.ok(vectors, 'run scripts/aurelius-translation.py --embed, then publish');
  assert.equal(vectors.dimensions, 3072);
  assert.deepEqual(vectors.by_section.map((row) => row.section), stored.sections);
  for (const row of vectors.by_section) {
    const mine = published.passages.filter((passage) => passage.section === row.section);
    assert.equal(row.passages, mine.length, row.section);
    assert.ok(row.closeness > 0 && row.closeness < 1 && row.closeness_1634 > 0 && row.closeness_1634 < 1, row.section);
    assert.equal(row.stayed_home, mine.filter((passage) => passage.vector.home_rank === 1).length, row.section);
  }
  for (const passage of published.passages) {
    assert.ok(passage.vector.to_1634 > 0 && passage.vector.to_1634 < 1, `Meditations ${passage.standard_ref}: similarity to its 1634 text`);
    assert.ok(passage.vector.home_rank >= 1 && passage.vector.home_rank <= vectors.sections);
  }
  assert.equal(vectors.stayed_home, published.passages.filter((passage) => passage.vector.home_rank === 1).length);
});

test('the translations are published as downloads that hold every passage, dedicated to the public domain', () => {
  // scripts/aurelius-downloads.py writes them; `--check` says whether they are up to date byte for byte.
  const file = (name) => fs.readFileSync(new URL(`../../public/downloads/${name}`, import.meta.url));
  for (const [slug, record, key] of [['marcus-meditations-project-v1', 'project-v1', 'standard_ref'], ['seneca-letters-selection-v1', 'seneca-v1', 'ref']]) {
    const passages = JSON.parse(fs.readFileSync(new URL(`../../content/aurelius/translation/${record}.json`, import.meta.url), 'utf8')).passages;
    const md = file(`${slug}.md`).toString(), txt = file(`${slug}.txt`).toString(), epub = file(`${slug}.epub`);
    for (const text of [md, txt]) {
      assert.match(text, /CC0 1\.0 Universal/);
      assert.match(text, /checked by a person who reads (Greek|Latin)/);
      for (const p of passages) assert.ok(text.includes(p.english), `${slug}: ${p[key]} is missing or not current`);
    }
    assert.equal(epub.subarray(0, 4).toString('latin1'), 'PK\u0003\u0004');
    assert.equal(epub.subarray(30, 38).toString(), 'mimetype');
  }
  for (const page of ['stoic-translation.html', 'stoic-constitution.html']) {
    const html = fs.readFileSync(new URL(`../../public/apps/${page}`, import.meta.url), 'utf8');
    for (const name of ['marcus-meditations-project-v1.epub', 'seneca-letters-selection-v1.epub']) assert.ok(html.includes(`/downloads/${name}`), `${page} links ${name}`);
  }
});

test('the Russian is made from the current English, complete, and published on the page and as downloads', () => {
  // content/aurelius/translation/ru-v1.json: Opus 5.5 from the settled English, checked by another model (owner, 23 Nov 2026).
  const json = (path) => JSON.parse(fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const ru = json('content/aurelius/translation/ru-v1.json');
  const sources = {marcus: [json('content/aurelius/translation/project-v1.json').passages, 'standard_ref'], seneca: [json('content/aurelius/translation/seneca-v1.json').passages, 'ref']};
  for (const [work, [passages, key]] of Object.entries(sources)) {
    const mine = new Map(ru.passages.filter((p) => p.work === work).map((p) => [p.ref, p]));
    assert.equal(mine.size, passages.length, `${work}: every passage has its Russian`);
    for (const p of passages) {
      const r = mine.get(p[key]);
      assert.ok(r, `${work} ${p[key]}: no Russian`);
      assert.equal(r.english_revision, p.revision, `${work} ${p[key]}: the Russian was made from an older English`);
      assert.match(r.russian, /[А-Яа-яЁё]/);
      assert.doesNotMatch(r.russian, /["']/, `${work} ${p[key]}: straight quote`);
    }
  }
  const page = json('public/apps/stoic-translation.json');
  assert.ok(page.passages.every((p) => p.russian), 'every passage on the page carries its Russian');
  for (const slug of ['marcus-meditations-ru-v1', 'seneca-letters-selection-ru-v1']) {
    const text = fs.readFileSync(new URL(`../../public/downloads/${slug}.txt`, import.meta.url), 'utf8');
    assert.match(text, /CC0 1\.0 Universal/);
    for (const p of ru.passages.filter((x) => slug.startsWith(x.work))) assert.ok(text.includes(p.russian), `${slug}: ${p.ref}`);
  }
});
