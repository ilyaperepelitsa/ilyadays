// Pure helpers for restoring an exported Aurelius project file. No DOM or storage access.
export const BACKUP_FORMAT = 'aurelius-project-v1';
export const MAX_BACKUP_BYTES = 40 * 1024 * 1024;
export const SUPPORTED_SCHEMA = 1;

const editionIds = (workspace) => (Array.isArray(workspace?.editions) ? workspace.editions.map((e) => e?.id) : []).sort();

/**
 * Parse and validate an exported project file against the workspace that is currently open.
 * `expected` needs only `corpus_kind` and `editions[].id`. Returns the workspace or throws an Error
 * whose message is safe to show to the person.
 */
export function parseBackup(text, expected) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The file is empty.');
  if (text.length > MAX_BACKUP_BYTES) throw new Error('The file is too large to be an Aurelius project export.');
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON, so it cannot be an Aurelius project export.');
  }
  const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObject(payload) || !isObject(payload.workspace)) throw new Error('This file does not contain an Aurelius workspace.');
  if (payload.manifest?.format !== BACKUP_FORMAT) throw new Error('This file is not an Aurelius project export (unknown format).');
  const workspace = payload.workspace;
  if (workspace.corpus_kind === 'hays') throw new Error('The private modern translation cannot be restored into a browser.');
  if (workspace.corpus_kind !== expected?.corpus_kind) throw new Error(`This file belongs to a different study (${String(workspace.corpus_kind)}, not ${String(expected?.corpus_kind)}).`);
  const have = editionIds(workspace), want = editionIds(expected);
  if (!have.length || have.length !== want.length || have.some((id, i) => id !== want[i])) throw new Error('This file was made from a different edition of the text, so it cannot replace this study.');
  if (workspace.schema_version !== SUPPORTED_SCHEMA) throw new Error(`This file uses an unsupported schema version (${String(workspace.schema_version)}).`);
  for (const key of ['passages', 'links', 'revisions', 'conclusions']) if (!Array.isArray(workspace[key])) throw new Error(`The file is missing its ${key} list and looks damaged.`);
  return workspace;
}

/** Counts shown in the confirmation step. */
export function backupSummary(workspace) {
  const count = (v) => (Array.isArray(v) ? v.length : 0);
  return {
    lessons: count(workspace.conclusions),
    passages: count(workspace.passages),
    evidenceLinks: Array.isArray(workspace.links) ? workspace.links.filter((l) => l?.active !== false).length : 0,
    bookRevisions: count(workspace.manuscript_revisions),
    version: Number.isFinite(workspace.version) ? workspace.version : 0,
  };
}
