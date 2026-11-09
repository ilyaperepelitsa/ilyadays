#!/usr/bin/env node
/** Offline compiler/review gate. Network calls and image generation belong to the bundled imagegen CLI. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VIEWS = ['identity', 'adjustment', 'setup', 'start', 'end', 'alignment'];
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const invariant = (valid, message) => { if (!valid) throw new Error(message); };
const sourcePaths = ['art/fitness/machines/language.json', 'art/fitness/machines/specs.json', 'art/fitness/scenes.json', 'content/fitness/exercises.json', 'content/fitness/registry.json', 'content/fitness/images.json', 'art/image-requirements.json', 'src/lib/fitness/catalog-core.mjs', 'content/fitness/templates.json', 'scripts/fitness-machine-specs.mjs', 'scripts/fitness-catalog-seed.mjs', 'public/media/illustrations/nigiri/technique-4.webp'];

export function loadInputs() {
  return { language: json(sourcePaths[0]), specs: json(sourcePaths[1]), scenes: json(sourcePaths[2]), exercises: json(sourcePaths[3]), registry: json(sourcePaths[4]), images: json(sourcePaths[5]), sources: Object.fromEntries(sourcePaths.map((f) => [f, sha256(fs.readFileSync(path.join(ROOT, f)))])) };
}

export function validateInputs(input) {
  const { language, specs, scenes, exercises, images } = input;
  invariant(language.api.model === 'gpt-image-2-2026-04-21', 'Change the model policy explicitly before changing models');
  invariant(Object.keys(language.api).sort().join(',') === 'background,model,moderation,n,output_format,quality,size', 'Unsupported or uncontrolled API fields');
  invariant(language.api.n === 1 && language.api.size === '1536x1024' && language.api.quality === 'high' && language.api.output_format === 'png' && language.api.background === 'opaque' && language.api.moderation === 'auto', 'Unexpected generation settings');
  invariant(JSON.stringify(language.requiredViews) === JSON.stringify(VIEWS), 'View policy mismatch');
  const expected = new Set(Object.keys(images.machines));
  for (const exercise of exercises) {
    if (['selectorized', 'plate-loaded', 'smith', 'cable', 'assisted'].includes(exercise.equipment) && scenes.exercises[exercise.id]?.station !== false) expected.add(exercise.id);
  }
  const ids = new Set(); const machines = new Map();
  for (const spec of specs.machines) {
    invariant(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.exerciseId) && !ids.has(spec.exerciseId), `Invalid/duplicate ${spec.exerciseId}`);
    ids.add(spec.exerciseId);
    invariant(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.machineId), 'Invalid physical machine ID');
    const exercise = exercises.find((e) => e.id === spec.exerciseId);
    invariant(exercise && exercise.equipment === spec.equipment, `Catalog mismatch: ${spec.exerciseId}`);
    invariant(spec.genericVariant === true, 'Unverified manufacturer identity is prohibited');
    invariant(spec.requiredViewCount === 6 && JSON.stringify(spec.requiredViews) === JSON.stringify(VIEWS), `Incomplete views: ${spec.exerciseId}`);
    for (const key of ['geometry', 'configuration', 'setup', 'start', 'end', 'travel', 'alignment', 'camera', 'alignmentCamera']) invariant(typeof spec[key] === 'string' && spec[key].length > 5, `${spec.exerciseId}: missing ${key}`);
    const prior = machines.get(spec.machineId);
    invariant(!prior || prior.geometry === spec.geometry && prior.equipment === spec.equipment, `Family identity drift: ${spec.machineId}`);
    machines.set(spec.machineId, spec);
    invariant(spec.checkpoints.length >= 12 && new Set(spec.checkpoints.map((c) => c.id)).size === spec.checkpoints.length, `Incomplete checkpoints: ${spec.exerciseId}`);
    for (const checkpoint of spec.checkpoints) invariant(checkpoint.observe.length > 30 && checkpoint.reject.length > 20 && checkpoint.views.every((v) => VIEWS.includes(v)), `${spec.exerciseId}: invalid checkpoint ${checkpoint.id}`);
    for (const view of VIEWS) invariant(spec.checkpoints.filter((c) => c.views.includes(view)).length >= 3, `${spec.exerciseId}/${view}: missing review coverage`);
  }
  invariant(ids.size === expected.size && [...expected].every((id) => ids.has(id)), 'Every machine/station needs exactly one configuration');
  return { configurations: ids.size, families: machines.size, requiredViews: ids.size * 6, uniqueImages: machines.size + ids.size * 5 };
}

const viewInstructions = (spec, view) => ({
  identity: `Machine alone, no actor. Full chassis at three-quarter front, unchanged fixed geometry. Show all adjustment controls, resistance mechanism, cable/pivot/rail attachments and ground contacts. No exercise-specific removable bench or attachment unless part of the fixed identity.`,
  adjustment: `One close-up of the principal user adjustment and its locked hardware, showing enough adjacent pad/frame/body landmark to understand its position. Setup requirement: ${spec.setup}. Configuration: ${spec.configuration}. No inset or invented labels.`,
  setup: `Full-body setup on the configured machine before movement: ${spec.setup}. Use the exact configuration: ${spec.configuration}.`,
  start: `Full-body START of the working phase: ${spec.start}. Supporting contacts: ${spec.setup}. Keep the setup camera and fixed machine unchanged.`,
  end: `Full-body END of the same repetition: ${spec.end}. Travel from start: ${spec.travel}. Keep the start reference camera, crop, actor and fixed machine unchanged; move only the connected working mechanism and appropriate body joints.`,
  alignment: `One detail view, ${spec.alignmentCamera}. ${spec.alignment}. Preserve the same machine and actor. The contact, load-bearing joint and relevant pivot must be simultaneously inspectable; no diagram inset.`,
})[view];

export function compile(input = loadInputs()) {
  const counts = validateInputs(input); const { language, specs, sources } = input;
  const sourceSha256 = sha256(JSON.stringify(sources));
  const jobs = []; const families = new Map();
  const style = { assetId: 'house-style-reference', role: 'linework-and-palette-only', path: language.styleReference, sha256: sha256(fs.readFileSync(path.join(ROOT, language.styleReference))) };
  const request = (spec, view, refs) => {
    const prompt = [
      `Use case: scientific-educational. Asset: controlled fitness guide. Language ${language.version}; configuration ${spec.exerciseId}; view ${view}.`,
      language.policyScope, language.rendering, `Exact palette: ${JSON.stringify(language.palette)}.`,
      `Physical machine identity ${spec.machineId}: ${spec.geometry}.`, language.machineLock,
      view === 'identity' ? '' : language.actor,
      `Camera: ${view === 'identity' ? 'full machine three-quarter front' : view === 'alignment' ? spec.alignmentCamera : view === 'adjustment' ? 'close view of the principal adjustment and adjacent contact' : spec.camera}. ${language.cameraLock}`,
      `Input images, in this exact order: ${refs.map((r, i) => `Image ${i + 1}: ${r.role} (${r.assetId})`).join('; ')}. Copy physical geometry only from the machine identity reference; style image controls line/palette only.`,
      viewInstructions(spec, view),
      `Mandatory visible checkpoints:\n${spec.checkpoints.filter((c) => c.views.includes(view)).map((c) => `- ${c.id}: ${c.observe} Reject: ${c.reject}`).join('\n')}`,
      `No text or marks in the output. Do not solve an occlusion by changing machine geometry. Any unresolvable geometry/contact conflict must be rejected during review.`,
    ].filter(Boolean).join('\n\n');
    return { id: view === 'identity' ? `${spec.machineId}/identity` : `${spec.exerciseId}/${view}`, exerciseId: spec.exerciseId, machineId: spec.machineId, view, status: 'unreviewed', sourceSha256, promptSha256: sha256(prompt), api: { endpoint: '/v1/images/edits', fields: { ...language.api, prompt }, multipartField: 'image[]' }, references: refs, checkpoints: spec.checkpoints.filter((c) => c.views.includes(view)), output: `output/imagegen/fitness-v2/${view === 'identity' ? spec.machineId : spec.exerciseId}/${view}.png` };
  };
  for (const spec of specs.machines) {
    if (families.has(spec.machineId)) continue;
    const job = request(spec, 'identity', [style]);
    families.set(spec.machineId, job); jobs.push(job);
  }
  for (const spec of specs.machines) {
    const identity = { assetId: `${spec.machineId}/identity`, role: 'approved-physical-machine-identity' };
    for (const view of VIEWS.slice(1)) {
      const refs = [identity];
      if (view === 'start') refs.push({ assetId: `${spec.exerciseId}/setup`, role: 'approved-camera-actor-and-configuration' });
      if (view === 'end' || view === 'alignment') refs.push({ assetId: `${spec.exerciseId}/start`, role: 'approved-start-pose-camera-and-contacts' });
      jobs.push(request(spec, view, refs));
    }
  }
  return { version: specs.version, languageVersion: language.version, catalogVersion: `fitness-v2-${sourceSha256.slice(0, 16)}`, sourceSha256, sources, counts, configurations: specs.machines.map((spec) => ({ exerciseId: spec.exerciseId, machineId: spec.machineId, requiredViewCount: 6, views: VIEWS.map((view) => view === 'identity' ? `${spec.machineId}/identity` : `${spec.exerciseId}/${view}`) })), jobs };
}

export function reviewErrors(job, review) {
  const errors = [];
  const require = (ok, error) => { if (!ok) errors.push(error); };
  require(review.jobId === job.id && review.promptSha256 === job.promptSha256, 'Review must match this exact job and prompt');
  require(review.status === 'approved', 'Approval is explicit');
  require(typeof review.reviewer === 'string' && review.reviewer.trim().length >= 3 && Number.isFinite(Date.parse(review.reviewedAt)), 'Named reviewer and dated inspection required');
  require(typeof review.actualModel === 'string' && [job.api.fields.model, 'gpt-image-2'].includes(review.actualModel) && typeof review.requestId === 'string' && review.requestId.length > 5, 'Actual model and API request ID required');
  require(typeof review.imageSha256 === 'string' && /^[a-f0-9]{64}$/.test(review.imageSha256), 'Output hash required');
  for (const ref of job.references) require(typeof review.referenceAssetHashes?.[ref.assetId] === 'string' && /^[a-f0-9]{64}$/.test(review.referenceAssetHashes[ref.assetId]) && (!ref.sha256 || review.referenceAssetHashes[ref.assetId] === ref.sha256), `Reference hash required: ${ref.assetId}`);
  for (const checkpoint of job.checkpoints) {
    const decision = review.checkpoints?.[checkpoint.id];
    require(decision?.pass === true && typeof decision.observation === 'string' && decision.observation.trim().length >= 12, `Observed pass required: ${checkpoint.id}`);
    require(Array.isArray(decision?.boxes) && decision.boxes.length > 0 && decision.boxes.every((b) => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[0] >= 0 && b[1] >= 0 && b[2] > 0 && b[3] > 0 && b[0] + b[2] <= 1 && b[1] + b[3] <= 1), `Visible evidence box required: ${checkpoint.id}`);
  }
  return errors;
}

export function resolveRequest(job, manifest, reviews, root = ROOT) {
  const references = job.references.map((ref) => {
    if (ref.sha256) { invariant(sha256(fs.readFileSync(path.resolve(root, ref.path))) === ref.sha256, 'Style reference changed'); return ref; }
    const review = reviews.find((r) => r.jobId === ref.assetId);
    const source = manifest.jobs.find((j) => j.id === ref.assetId);
    invariant(review && source && !reviewErrors(source, review).length, `Unapproved reference: ${ref.assetId}`);
    invariant(typeof review.path === 'string' && sha256(fs.readFileSync(path.resolve(root, review.path))) === review.imageSha256, `Reference bytes changed: ${ref.assetId}`);
    // Check the recorded dependencies too; an approved label cannot launder a changed upstream reference.
    const upstream = resolveRequest(source, manifest, reviews, root);
    for (const input of upstream.references) invariant(review.referenceAssetHashes[input.assetId] === input.sha256, `Reference lineage changed: ${ref.assetId}`);
    return { ...ref, path: review.path, sha256: review.imageSha256 };
  });
  return { ...job, references };
}

function main() {
  const args = process.argv.slice(2); const mode = args.shift() ?? 'check';
  const arg = (key) => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  const manifest = compile();
  if (mode === 'check') { console.log(JSON.stringify({ status: 'valid', ...manifest.counts, sourceSha256: manifest.sourceSha256 })); return; }
  const directory = path.resolve(ROOT, arg('--out') || 'output/fitness-machine-specs'); fs.mkdirSync(directory, { recursive: true });
  if (mode === 'build') {
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    for (const config of manifest.configurations) fs.writeFileSync(path.join(directory, `${config.exerciseId}.json`), JSON.stringify({ ...config, version: manifest.version, languageVersion: manifest.languageVersion, sourceSha256: manifest.sourceSha256, requests: config.views.map((id) => manifest.jobs.find((j) => j.id === id)) }, null, 2) + '\n');
    console.log(`Wrote ${manifest.counts.configurations} configs and ${manifest.counts.uniqueImages} exact request/review specs to ${directory}`); return;
  }
  if (mode === 'export') {
    const selected = args.includes('--job') ? manifest.jobs.filter((j) => j.id === arg('--job')) : manifest.jobs.filter((j) => j.view === 'identity');
    invariant(selected.length > 0, 'Unknown job');
    const reviews = args.includes('--reviews') ? JSON.parse(fs.readFileSync(arg('--reviews'), 'utf8')) : [];
    const resolved = selected.map((job) => resolveRequest(job, manifest, reviews));
    for (const job of resolved) {
      const stem = job.id.replaceAll('/', '--');
      fs.writeFileSync(path.join(directory, `${stem}.prompt.txt`), job.api.fields.prompt + '\n');
      fs.writeFileSync(path.join(directory, `${stem}.request.json`), JSON.stringify({ endpoint: job.api.endpoint, fields: job.api.fields, multipart: job.references.map((r) => ({ field: job.api.multipartField, file: path.resolve(ROOT, r.path), sha256: r.sha256, role: r.role })) }, null, 2) + '\n');
    }
    console.log(`Exported ${resolved.length} reference-resolved requests; no network calls made`); return;
  }
  throw new Error(`Unknown command: ${mode}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
