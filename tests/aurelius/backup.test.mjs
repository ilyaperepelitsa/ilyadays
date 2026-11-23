import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseBackup, backupSummary } from '../../src/lib/aurelius/backup.mjs';

const seed = () => JSON.parse(fs.readFileSync(new URL('../../content/aurelius/backup-study.json', import.meta.url), 'utf8'));
// Mirrors downloadSyntheticProject in persistence.ts.
const exported = (w) => JSON.stringify({ manifest: { format: 'aurelius-project-v1', corpus: w.corpus_kind, not_a_translation: w.corpus_kind === 'synthetic', source_processing: false, model_runs: [], edition_ids: w.editions.map((e) => e.id) }, workspace: w }, null, 2);

test('public study round-trips through the export format', () => {
  const w = seed();
  assert.deepEqual(parseBackup(exported(w), w), w);
});
test('rejects a different corpus kind, edition, malformed JSON and schema version', () => {
  const w = seed(), text = exported(w);
  assert.throws(() => parseBackup(text, { ...w, corpus_kind: 'synthetic' }), /different study/);
  assert.throws(() => parseBackup(text, { ...w, editions: [{ id: 'other-edition' }] }), /different edition/);
  assert.throws(() => parseBackup('{not json', w), /not valid JSON/);
  assert.throws(() => parseBackup('', w), /empty/);
  assert.throws(() => parseBackup(exported({ ...w, schema_version: 2 }), w), /schema version/);
  assert.throws(() => parseBackup(JSON.stringify({ workspace: w }), w), /unknown format/);
  assert.throws(() => parseBackup(exported({ ...w, corpus_kind: 'hays' }), { ...w, corpus_kind: 'hays' }), /private/);
});
test('backupSummary counts lessons, passages, active links and book revisions', () => {
  const w = seed(), s = backupSummary(w);
  assert.equal(s.lessons, w.conclusions.length);
  assert.equal(s.passages, w.passages.length);
  assert.equal(s.evidenceLinks, w.links.filter((l) => l.active !== false).length);
  assert.equal(s.bookRevisions, (w.manuscript_revisions ?? []).length);
  assert.equal(s.version, w.version);
});
