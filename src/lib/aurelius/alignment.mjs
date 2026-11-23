// @ts-check
/** Reading helpers for content/aurelius/alignment.json (written by scripts/aurelius-alignment.py).
 * The artifact stores, for one wording and the passage spans it cites, a word-by-word cosine similarity
 * matrix from contextual embeddings. Everything shown on the page is derived from that matrix here. */

/** Similarity at or above this is drawn as a counterpart; below it the word is treated as the editor's own.
 * A display choice, stated in the figure; the scores themselves use no threshold. */
export const COUNTERPART = 0.5;

/** @param {any} item */
export function decodeAlignment(item) {
  const token = (/** @type {[string,number,number,number]} */ t, /** @type {number} */ index) => ({ text: t[0], start: t[1], end: t[2], stop: !!t[3], index });
  const result = item.result.map(token);
  let offset = 0;
  const sources = item.sources.map((/** @type {any} */ s) => {
    const tokens = s.tokens.map((/** @type {any} */ t, /** @type {number} */ i) => ({ ...token(t, i), column: offset + i }));
    offset += tokens.length;
    return { spanId: s.span_id, tokens };
  });
  const sim = item.sim.map((/** @type {number[]} */ row) => row.map((v) => v / 100));
  return { result, sources, sim, columns: sources.flatMap((/** @type {any} */ s) => s.tokens) };
}

/** Greedy soft matching over content words: precision averages each result word's best source match,
 * recall each source word's best result match (BERTScore without idf weighting or rescaling).
 * @param {ReturnType<typeof decodeAlignment>} a */
export function alignmentScores(a) {
  const rows = a.result.filter((/** @type {any} */ t) => !t.stop), cols = a.columns.filter((/** @type {any} */ t) => !t.stop);
  const mean = (/** @type {number[]} */ v) => v.reduce((x, y) => x + y, 0) / v.length;
  const precision = mean(rows.map((/** @type {any} */ r) => Math.max(...cols.map((/** @type {any} */ c) => a.sim[r.index][c.column]))));
  const recall = mean(cols.map((/** @type {any} */ c) => Math.max(...rows.map((/** @type {any} */ r) => a.sim[r.index][c.column]))));
  return { precision, recall, f1: 2 * precision * recall / (precision + recall) };
}

/** Best content-word match for every result word and every source word.
 * @param {ReturnType<typeof decodeAlignment>} a */
export function bestMatches(a) {
  const rows = a.result.filter((/** @type {any} */ t) => !t.stop), cols = a.columns.filter((/** @type {any} */ t) => !t.stop);
  const forResult = new Map(), forSource = new Map();
  for (const r of rows) { let best = cols[0]; for (const c of cols) if (a.sim[r.index][c.column] > a.sim[r.index][best.column]) best = c; forResult.set(r.index, { column: best.column, value: a.sim[r.index][best.column] }); }
  for (const c of cols) { let best = rows[0]; for (const r of rows) if (a.sim[r.index][c.column] > a.sim[best.index][c.column]) best = r; forSource.set(c.column, { row: best.index, value: a.sim[best.index][c.column] }); }
  return { forResult, forSource };
}

/** The k closest source content words to one result word, best first.
 * @param {ReturnType<typeof decodeAlignment>} a @param {number} row @param {number} [k] */
export function nearest(a, row, k = 3) {
  return a.columns.filter((/** @type {any} */ c) => !c.stop).map((/** @type {any} */ c) => ({ text: c.text, column: c.column, value: a.sim[row][c.column] })).sort((/** @type {any} */ x, /** @type {any} */ y) => y.value - x.value).slice(0, k);
}

/** Hash input shared with the Python writer, so a stale artifact fails the test suite.
 * @param {any} study */
export function alignmentTextKeyInput(study) {
  return JSON.stringify([...study.revisions.map((/** @type {any} */ r) => [r.id, r.text]), ...study.spans.map((/** @type {any} */ s) => [s.id, s.exact]),
    ...study.links.map((/** @type {any} */ l) => [l.id, l.source_span, l.target_revision, l.active])]);
}
