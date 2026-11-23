'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Workspace } from '@/lib/aurelius/types';
import { COUNTERPART, alignmentScores, bestMatches, decodeAlignment, nearest } from '@/lib/aurelius/alignment.mjs';

type Lang = 'en' | 'ru';
type Token = { text: string; start: number; end: number; stop: boolean; index: number; column?: number };
type Artifact = { method: Record<string, string>; items: Record<string, unknown> };
const pick = (lang: Lang, en: string, ru: string) => (lang === 'ru' ? ru : en);
const fmt = (v: number) => v.toFixed(2);

// One shared fetch of the 0.4 MB artifact, started when the first figure mounts.
let pending: Promise<Artifact> | null = null;
const loadArtifact = () => (pending ??= import('../../../content/aurelius/alignment.json').then((m) => m.default as unknown as Artifact));

/** Text with every word wrapped; what lies between words is printed as it is in the stored text. */
function Words({ text, tokens, render }: { text: string; tokens: Token[]; render: (t: Token) => React.ReactNode }) {
  const out: React.ReactNode[] = []; let at = 0;
  tokens.forEach((t) => { if (t.start > at) out.push(text.slice(at, t.start)); out.push(render(t)); at = t.end; });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

/** Word-level alignment between a lesson's wording and the passages it cites, drawn from a similarity matrix
 * computed offline (see scripts/aurelius-alignment.py). Renders nothing when no alignment exists for the revision. */
export function AlignmentFigure({ workspace, revisionId, lang }: { workspace: Workspace; revisionId: string; lang: Lang }) {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [row, setRow] = useState<number | null>(null);
  const [cell, setCell] = useState<{ row: number; column: number } | null>(null);
  useEffect(() => { let live = true; void loadArtifact().then((a) => { if (live) setArtifact(a); }).catch(() => {}); return () => { live = false; }; }, []);

  const revision = workspace.revisions.find((r) => r.id === revisionId);
  const item = artifact?.items[revisionId];
  const data = useMemo(() => {
    if (!item || !revision) return null;
    const a = decodeAlignment(item) as { result: Token[]; sources: { spanId: string; tokens: Token[] }[]; sim: number[][]; columns: Token[] };
    // The artifact belongs to exact wording: if the stored text was edited since, show nothing rather than misplace words.
    if (a.result.some((t) => revision.text.slice(t.start, t.end) !== t.text)) return null;
    const spans = a.sources.map((s) => ({ ...s, span: workspace.spans.find((x) => x.id === s.spanId) }));
    if (spans.some((s) => !s.span || s.tokens.some((t) => s.span!.exact.slice(t.start, t.end) !== t.text))) return null;
    return { a, spans, scores: alignmentScores(a), best: bestMatches(a) as { forResult: Map<number, { column: number; value: number }>; forSource: Map<number, { row: number; value: number }> } };
  }, [item, revision, workspace.spans]);
  if (!data || !revision) return null;

  const { a, spans, scores, best } = data;
  const contentRows = a.result.filter((t) => !t.stop);
  const own = contentRows.filter((t) => best.forResult.get(t.index)!.value < COUNTERPART).length;
  const tint = (v: number) => ({ '--au-sim': Math.max(0, Math.min(1, (v - 0.2) / 0.8)).toFixed(3) } as React.CSSProperties);
  const reference = (spanId: string) => { const p = workspace.passages.find((x) => x.revision_id === workspace.spans.find((s) => s.id === spanId)?.passage_revision); return p ? `${p.book}.${p.section}` : ''; };
  const active = row !== null ? a.result[row] : null;
  const readout = cell
    ? `${a.result[cell.row].text} ↔ ${a.columns[cell.column].text} · ${fmt(a.sim[cell.row][cell.column])}`
    : active
      ? `${active.text} → ${(nearest(a, active.index, 3) as { text: string; value: number }[]).map((n) => `${n.text} ${fmt(n.value)}`).join(' · ')}`
      : pick(lang, 'Tap a word of the rule to see its closest words in the passages.', 'Нажмите на слово правила, чтобы увидеть ближайшие слова во фрагментах.');

  return <figure className="au-align">
    <figcaption>
      <h4>{pick(lang, 'Word alignment', 'Выравнивание слов')}</h4>
      <p>{pick(lang, 'How closely each word of the rule matches the words of the cited passages, measured by a language model.', 'Насколько каждое слово правила близко к словам процитированных фрагментов по оценке языковой модели.')}</p>
    </figcaption>

    <dl className="au-align-scores">
      <div><dt>{pick(lang, 'Precision', 'Точность')}</dt><dd>{fmt(scores.precision)}</dd><small>{pick(lang, 'rule words found in the passages', 'слова правила, найденные во фрагментах')}</small></div>
      <div><dt>{pick(lang, 'Recall', 'Полнота')}</dt><dd>{fmt(scores.recall)}</dd><small>{pick(lang, 'passage words carried into the rule', 'слова фрагментов, перешедшие в правило')}</small></div>
      <div><dt>F1</dt><dd>{fmt(scores.f1)}</dd><small>{pick(lang, 'balance of the two', 'баланс двух оценок')}</small></div>
      <div><dt>{pick(lang, 'Editor’s words', 'Слова редактора')}</dt><dd>{own}<span>/{contentRows.length}</span></dd><small>{pick(lang, `no counterpart at ${fmt(COUNTERPART)} or above`, `нет соответствия от ${fmt(COUNTERPART)}`)}</small></div>
    </dl>

    <div className="au-align-texts">
      <section aria-label={pick(lang, 'Rule', 'Правило')}>
        <h5>{pick(lang, 'Rule', 'Правило')}</h5>
        <p><Words text={revision.text} tokens={a.result} render={(t) => t.stop
          ? <span key={t.index} className="au-align-stop">{t.text}</span>
          : <button type="button" key={t.index} className="au-align-word" aria-pressed={row === t.index} style={tint(best.forResult.get(t.index)!.value)}
              data-own={best.forResult.get(t.index)!.value < COUNTERPART || undefined}
              aria-label={`${t.text}: ${pick(lang, 'closest passage word', 'ближайшее слово фрагмента')} ${a.columns[best.forResult.get(t.index)!.column].text}, ${fmt(best.forResult.get(t.index)!.value)}`}
              onClick={() => { setCell(null); setRow(row === t.index ? null : t.index); }}>{t.text}</button>} /></p>
      </section>
      {spans.map((s) => <section key={s.spanId} aria-label={`${pick(lang, 'Passage', 'Фрагмент')} ${reference(s.spanId)}`}>
        <h5>{pick(lang, 'Passage', 'Фрагмент')} {reference(s.spanId)}</h5>
        <p><Words text={s.span!.exact} tokens={s.tokens} render={(t) => t.stop
          ? <span key={t.index} className="au-align-stop">{t.text}</span>
          : <span key={t.index} className="au-align-word" style={tint(row !== null ? a.sim[row][t.column!] : best.forSource.get(t.column!)!.value)}
              title={row !== null ? `${a.result[row].text} ↔ ${t.text} · ${fmt(a.sim[row][t.column!])}` : `${t.text} ↔ ${a.result[best.forSource.get(t.column!)!.row].text} · ${fmt(best.forSource.get(t.column!)!.value)}`}>{t.text}</span>} /></p>
      </section>)}
    </div>

    <p className="au-align-readout" role="status">{readout}</p>
    <div className="au-align-scale" aria-hidden="true"><span>0.2</span><i /><span>1.0</span><em>{pick(lang, 'cosine similarity', 'косинусная близость')}</em></div>

    <details className="au-align-matrix">
      <summary>{pick(lang, 'Similarity matrix', 'Матрица близости')}</summary>
      {spans.map((s) => { const cols = s.tokens.filter((t) => !t.stop); return <div key={s.spanId} className="au-align-scroll">
        <table>
          <caption>{pick(lang, 'Rule words (rows) against passage', 'Слова правила (строки) и фрагмент')} {reference(s.spanId)} {pick(lang, '(columns)', '(столбцы)')}</caption>
          <thead><tr><td />{cols.map((c) => <th key={c.index} scope="col"><span>{c.text}</span></th>)}</tr></thead>
          <tbody>{contentRows.map((r) => <tr key={r.index}><th scope="row">{r.text}</th>{cols.map((c) => { const v = a.sim[r.index][c.column!], peak = v >= COUNTERPART && best.forResult.get(r.index)!.column === c.column;
            return <td key={c.index}><button type="button" style={tint(v)} data-peak={peak || undefined} aria-label={`${r.text}, ${c.text}: ${fmt(v)}`} title={`${r.text} ↔ ${c.text} · ${fmt(v)}`}
              onClick={() => setCell({ row: r.index, column: c.column! })} onPointerEnter={() => setCell({ row: r.index, column: c.column! })} onFocus={() => setCell({ row: r.index, column: c.column! })} /></td>; })}</tr>)}</tbody>
        </table>
      </div>; })}
      <p className="au-align-note">{pick(lang, `A ringed cell is the row’s best match when it reaches ${fmt(COUNTERPART)}. Function words (the, of, and…) are left out.`, `Обведена лучшая ячейка строки, если она не ниже ${fmt(COUNTERPART)}. Служебные слова не показаны.`)}</p>
    </details>

    <details className="au-align-method">
      <summary>{pick(lang, 'Method', 'Метод')}</summary>
      <p>{pick(lang,
        `Each word is represented by a contextual embedding from ${artifact!.method.model} (${artifact!.method.layer}; ${artifact!.method.pooling}). Similarity is the cosine between two word vectors. Precision is the mean, over the rule’s content words, of each word’s best match in the passages; recall is the same from the passages’ side; F1 is their harmonic mean. This is the greedy matching of BERTScore (Zhang et al., ICLR 2020), here without idf weighting or baseline rescaling, so values are comparable between lessons on this page but not with published BERTScore figures.`,
        `Каждое слово представлено контекстным вектором модели ${artifact!.method.model} (последний скрытый слой; среднее по частям слова, единичная длина). Близость — косинус между векторами двух слов. Точность — среднее по содержательным словам правила лучшего соответствия во фрагментах; полнота — то же со стороны фрагментов; F1 — их гармоническое среднее. Это жадное сопоставление из BERTScore (Zhang et al., ICLR 2020), здесь без idf-весов и без нормировки по базовой линии, поэтому значения сравнимы между уроками на этой странице, но не с опубликованными значениями BERTScore.`)}</p>
      <p>{pick(lang,
        'The numbers describe wording, not truth: a high score means the rule reuses the passage’s vocabulary, a low one that it paraphrases. Which passage supports which rule is decided by hand and shown above; the model does not decide it.',
        'Числа описывают формулировку, а не истинность: высокая оценка значит, что правило повторяет словарь фрагмента, низкая — что оно его пересказывает. Какой фрагмент подтверждает какое правило, решается вручную и показано выше; модель этого не решает.')}</p>
      <p className="au-align-note">{artifact!.method.model}@{artifact!.method.model_revision.slice(0, 8)}</p>
    </details>
  </figure>;
}
