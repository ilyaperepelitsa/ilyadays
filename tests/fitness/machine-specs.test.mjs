import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compile, loadInputs, resolveRequest, reviewErrors, ROOT, sha256, validateInputs } from '../../scripts/fitness-machine-specs.mjs';
import { catalogSeed } from '../../scripts/fitness-catalog-seed.mjs';

const input = loadInputs();
const manifest = compile(input);

test('all machine/station exercises have six controlled views and shared physical identities', () => {
  assert.deepEqual(manifest.counts, { configurations: 70, families: 47, requiredViews: 420, uniqueImages: 397 });
  assert.equal(new Set(manifest.jobs.map((j) => j.id)).size, 397);
  const byId = (id) => manifest.configurations.find((c) => c.exerciseId === id);
  assert.equal(byId('smith-squat').views[0], byId('smith-bench-press').views[0]);
  assert.equal(byId('lat-pulldown').views[0], byId('neutral-grip-pulldown').views[0]);
  assert.notEqual(byId('seated-cable-row').views[0], byId('single-arm-cable-row').views[0]);
  for (const configuration of manifest.configurations) for (const id of configuration.views) assert.ok(manifest.jobs.some((job) => job.id === id), id);
});

test('missing configurations, changed shared geometry and fake API seed parameters fail validation', () => {
  const missing = structuredClone(input); missing.specs.machines.pop();
  assert.throws(() => validateInputs(missing), /Every machine/);
  const drift = structuredClone(input); drift.specs.machines.find((s) => s.exerciseId === 'smith-squat').geometry += ' with a third rail';
  assert.throws(() => validateInputs(drift), /identity drift/);
  const seed = structuredClone(input); seed.language.api.seed = 123;
  assert.throws(() => validateInputs(seed), /API fields/);
  const settings = structuredClone(input); settings.language.api.n = 4;
  assert.throws(() => validateInputs(settings), /generation settings/);
});

test('exact prompts are reproducible with per-view pose and contact checkpoints, but no image determinism claim', () => {
  assert.deepEqual(compile(input), manifest);
  for (const job of manifest.jobs) {
    assert.equal(job.promptSha256, sha256(job.api.fields.prompt));
    assert.equal(job.api.endpoint, '/v1/images/edits');
    assert.equal(job.api.fields.model, 'gpt-image-2-2026-04-21');
    assert.equal(job.status, 'unreviewed');
    assert.ok(job.checkpoints.length >= 3);
    for (const checkpoint of job.checkpoints) assert.ok(job.api.fields.prompt.includes(checkpoint.observe));
    assert.ok(!Object.hasOwn(job.api.fields, 'seed') && !Object.hasOwn(job.api.fields, 'input_fidelity'));
  }
  const chest = input.specs.machines.find((s) => s.exerciseId === 'machine-chest-press');
  const start = manifest.jobs.find((j) => j.id === 'machine-chest-press/start');
  const end = manifest.jobs.find((j) => j.id === 'machine-chest-press/end');
  assert.ok(start.api.fields.prompt.includes(chest.start));
  assert.ok(end.api.fields.prompt.includes(chest.end));
  assert.ok(end.references.some((r) => r.assetId === start.id));
});

test('legacy plate-vs-selector conflicts are explicitly corrected without inventing brand models', () => {
  for (const id of ['decline-chest-press-machine', 'four-way-neck-machine']) {
    const spec = input.specs.machines.find((s) => s.exerciseId === id);
    assert.equal(spec.equipment, 'plate-loaded');
    assert.ok(spec.geometry.includes('plate-loaded'));
    assert.ok(spec.sourceCorrections.length);
    assert.equal(spec.genericVariant, true);
  }
});

const approval = (job, imageSha256, references) => ({
  jobId: job.id, promptSha256: job.promptSha256, status: 'approved', reviewer: 'Test reviewer', reviewedAt: '2026-11-09T17:00:00Z', actualModel: job.api.fields.model, requestId: 'synthetic-test-request', imageSha256,
  referenceAssetHashes: references,
  checkpoints: Object.fromEntries(job.checkpoints.map((c) => [c.id, { pass: true, observation: 'Synthetic test observation for gate verification.', boxes: [[0.1, 0.1, 0.4, 0.4]] }])),
});

test('approval needs every observed checkpoint, valid visible boxes and exact request provenance', () => {
  const job = manifest.jobs[0];
  const review = approval(job, 'a'.repeat(64), Object.fromEntries(job.references.map((r) => [r.assetId, r.sha256])));
  assert.deepEqual(reviewErrors(job, review), []);
  delete review.checkpoints[job.checkpoints[0].id];
  assert.ok(reviewErrors(job, review).some((e) => e.includes(job.checkpoints[0].id)));
  const bad = approval(job, 'a'.repeat(64), {});
  bad.checkpoints[job.checkpoints[0].id].boxes = [[0.9, 0.9, 0.2, 0.2]];
  bad.promptSha256 = 'b'.repeat(64);
  assert.ok(reviewErrors(job, bad).length >= 3);
});

test('edit export blocks unreviewed references and detects changed bytes throughout the lineage', () => {
  const start = manifest.jobs.find((j) => j.id === 'machine-chest-press/start');
  assert.throws(() => resolveRequest(start, manifest, []), /Unapproved reference/);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fitness-spec-'));
  try {
    const master = manifest.jobs.find((j) => j.id === 'machine-chest-press/identity');
    const style = master.references[0];
    fs.mkdirSync(path.dirname(path.join(temp, style.path)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, style.path), path.join(temp, style.path));
    const file = 'synthetic-reference-bytes.dat'; fs.writeFileSync(path.join(temp, file), 'test fixture, not an image');
    const review = { ...approval(master, sha256(fs.readFileSync(path.join(temp, file))), { [style.assetId]: style.sha256 }), path: file };
    const setup = manifest.jobs.find((j) => j.id === 'machine-chest-press/setup');
    assert.equal(resolveRequest(setup, manifest, [review], temp).references[0].path, file);
    fs.writeFileSync(path.join(temp, file), 'changed fixture');
    assert.throws(() => resolveRequest(setup, manifest, [review], temp), /bytes changed/);
    fs.writeFileSync(path.join(temp, file), 'test fixture, not an image');
    review.referenceAssetHashes[style.assetId] = 'b'.repeat(64);
    assert.throws(() => resolveRequest(setup, manifest, [review], temp), /Unapproved reference/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('relational seed uses the same versioned IDs and six-view prompt hashes as the offline compiler', () => {
  const seed = catalogSeed(input);
  assert.equal(seed.version, manifest.catalogVersion);
  assert.equal(seed.sql, fs.readFileSync(path.join(ROOT, 'supabase/seed/fitness-reference-catalog.sql'), 'utf8'));
  assert.ok(seed.sql.includes(manifest.jobs.find((j) => j.id === 'machine-chest-press/start').promptSha256));
  assert.ok(seed.statements.every((s) => s.includes('on conflict do nothing;')));
});
