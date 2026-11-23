'use client';
import { useMemo, useState } from 'react';
import type { BookDraft, BookLesson, Workspace } from '@/lib/aurelius/types';
import { draftBook, lessonSources, readingPlan } from '@/lib/aurelius/book.mjs';
import { sourceGradient } from '@/lib/aurelius/provenance.mjs';
import { AlignmentFigure } from './AlignmentFigure';

type Lang = 'en' | 'ru';
const pick = (lang: Lang, en: string, ru: string) => (lang === 'ru' ? ru : en);

const REASON: Record<string, [string, string]> = {
  explicit_reason: ['Marcus’s reason', 'Довод Марка'],
  analogy: ['Marcus’s image', 'Образ у Марка'],
  reason_not_stated: ['Marcus gives no reason here', 'Марк здесь довода не приводит'],
};

/** The book as something to read: chapters, lessons and the passages each one rests on. No editing controls. */
export function BookReader({ workspace, lang, onInspect, onWorkbench }: {
  workspace: Workspace; lang: Lang; onInspect: (conclusionId: string) => void; onWorkbench: (tab: string) => void;
}) {
  const book = useMemo(() => draftBook(workspace) as BookDraft, [workspace]);
  const [selectedSpan, setSelectedSpan] = useState<string | null>(null);
  const translator = workspace.editions[0]?.translator ?? '';

  const chapters = (readingPlan(book) as { id: string; title: string; lessons: { lesson: BookLesson; number: string; fullAt: string; mode: 'full' | 'principle' | 'reference' }[] }[])
    .map((chapter) => ({ ...chapter, lessons: chapter.lessons.map((item) => ({ ...item, title: workspace.conclusions.find((c) => c.id === item.lesson.conclusion_id)?.title ?? '' })) }));
  const lessonCount = new Set(chapters.flatMap((c) => c.lessons.map((l) => l.lesson.conclusion_id))).size;
  const ruleText = (lesson: BookLesson) => workspace.revisions.find((r) => r.id === lesson.expression_revision)?.text ?? workspace.revisions.find((r) => r.id === lesson.conclusion_revision)?.text ?? '';
  const anchor = (number: string) => `lesson-${number.replace('.', '-')}`;

  return <article className="au-read">
    <header className="au-read-head">
      <p className="au-read-eyebrow">{pick(lang, 'Marcus Aurelius · Meditations', 'Марк Аврелий · «Размышления»')}</p>
      <h1>{book.title === 'A personal constitution' ? pick(lang, 'A personal constitution', 'Личная конституция') : book.title}</h1>
      <p className="au-read-lede">{pick(lang,
        `${lessonCount} lessons drawn from ${workspace.passages.length} passages of the Meditations, written as rules to live by. Each underlined clause rests on a passage: tap it to see the words it comes from.`,
        `Уроки из «Размышлений», записанные как правила для жизни (уроков: ${lessonCount}, фрагментов: ${workspace.passages.length}). Каждая подчёркнутая фраза опирается на фрагмент: нажмите на неё, чтобы увидеть исходные слова.`)}</p>
      <p className="au-read-meta">{pick(lang,
        `A first draft, still under review. Passages are quoted from the ${translator} translation.`,
        `Первый черновик, ещё на проверке. Фрагменты цитируются по переводу: ${translator}. Тексты уроков пока на английском.`)}</p>
      <a href={`/apps/stoic-constitution.html?lang=${lang}`}>{pick(lang, 'The Stoic Constitution: all 38 articles from the whole book →', 'Стоическая конституция: все 38 статей из всей книги →')}</a>
      <a href="/apps/stoic-composition.html">{pick(lang, 'See how passages become a constitution article →', 'Как из фрагментов составить статью конституции · на английском →')}</a>
      <a href={`/apps/stoic-method.html?lang=${lang}`}>{pick(lang, 'How the Constitution was made: the method, step by step →', 'Как сделана конституция: метод шаг за шагом →')}</a>
    </header>

    <nav className="au-read-toc" aria-label={pick(lang, 'Contents', 'Содержание')}>
      <h2>{pick(lang, 'Contents', 'Содержание')}</h2>
      <ol>{chapters.map((chapter, ci) => <li key={chapter.id}>
        <a href={`#chapter-${ci + 1}`}><span>{ci + 1}</span>{chapter.title}</a>
        <p>{chapter.lessons.every((l) => l.mode === 'principle')
          ? pick(lang, `The ${chapter.lessons.length} rules, one line each`, `Правила (${chapter.lessons.length}), по одной строке`)
          : chapter.lessons.map(({ title }) => title).join(' · ')}</p>
      </li>)}</ol>
    </nav>

    {chapters.map((chapter, ci) => <section key={chapter.id} className="au-read-chapter" id={`chapter-${ci + 1}`}>
      <h2><span>{pick(lang, 'Chapter', 'Глава')} {ci + 1}</span>{chapter.title}</h2>
      {chapter.lessons.some((l) => l.mode === 'principle') && <ol className="au-read-principles">
        {chapter.lessons.filter((l) => l.mode === 'principle').map(({ lesson, number, fullAt, title }) => <li key={lesson.conclusion_id}>
          <span>{number}</span>
          <p>{ruleText(lesson)}</p>
          <a href={`#${anchor(fullAt)}`}>{title}<small>{pick(lang, `lesson ${fullAt}`, `урок ${fullAt}`)}</small></a>
        </li>)}
      </ol>}
      {chapter.lessons.filter((l) => l.mode !== 'principle').map(({ lesson, number, fullAt, mode, title }) => mode === 'reference'
        ? <p key={lesson.conclusion_id} className="au-read-repeat"><span>{number}</span><a href={`#${anchor(fullAt)}`}>{title}</a><small>{pick(lang, `see ${fullAt}`, `см. ${fullAt}`)}</small></p>
        : <Lesson key={lesson.conclusion_id} workspace={workspace} lang={lang} lesson={lesson} number={number} title={title} id={anchor(number)}
            selectedSpan={selectedSpan} onSelectSpan={setSelectedSpan} onInspect={onInspect} />)}
    </section>)}

    <footer className="au-read-about">
      <h2>{pick(lang, 'How this was made', 'Как это сделано')}</h2>
      <p>{pick(lang,
        'Each lesson was written by hand from the passages quoted under it. Where Marcus gives a reason, it is reported as his; where the link between passages is mine, it is marked as my reading. Nothing here is a quotation unless it sits in a quote block.',
        'Каждый урок написан вручную по фрагментам, приведённым под ним. Где Марк даёт довод, он передан как его довод; где связь между фрагментами моя, она помечена как моё прочтение. Цитатами являются только тексты в блоках цитат.')}</p>
      <div className="au-read-links">
        <button type="button" onClick={() => onWorkbench('workbench')}>{pick(lang, 'Open the evidence workbench', 'Открыть рабочий стол с источниками')}</button>
        <button type="button" onClick={() => onWorkbench('discovery')}>{pick(lang, 'Map of all passages', 'Карта всех фрагментов')}</button>
      </div>
    </footer>
  </article>;
}

function Lesson({ workspace, lang, lesson, number, title, id, selectedSpan, onSelectSpan, onInspect }: {
  workspace: Workspace; lang: Lang; lesson: BookLesson; number: string; title: string; id: string;
  selectedSpan: string | null; onSelectSpan: (id: string | null) => void; onInspect: (conclusionId: string) => void;
}) {
  const meaning = workspace.revisions.find((r) => r.id === lesson.conclusion_revision);
  const expression = workspace.revisions.find((r) => r.id === lesson.expression_revision);
  if (!meaning) return null;
  const sources = lessonSources(workspace, lesson.conclusion_revision);
  const links = workspace.links.filter((l) => l.active && l.target_revision === lesson.conclusion_revision);
  const reasons = (workspace.source_arguments ?? []).filter((a) => a.target_revision === lesson.conclusion_revision);
  const linkedSpans = new Set(links.map((l) => l.source_span));
  const select = (spanId: string) => {
    onSelectSpan(spanId);
    document.querySelector(`#${CSS.escape(id)} [data-span="${CSS.escape(spanId)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const bridge = meaning.synthesis?.interpretive_step ?? meaning.assumptions;

  return <section className="au-read-lesson" id={id} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}><span>{number}</span>{title}</h3>
    <div className="au-read-rule">
      {expression?.doc?.content?.length ? expression.doc.content.map((block, bi) => <p key={String(block.attrs?.id ?? bi)}>
        {block.content?.map((node, ni) => {
          const ids = ((node.marks?.find((m) => m.type === 'grounding')?.attrs?.sourceSpanIds as string[] | undefined) ?? []).filter((s) => linkedSpans.has(s));
          if (!ids.length) return <span key={ni}>{node.text}</span>;
          return <button type="button" key={ni} className="au-read-clause" aria-pressed={!!selectedSpan && ids.includes(selectedSpan)}
            aria-label={`${node.text} — ${pick(lang, 'show the source passage', 'показать исходный фрагмент')}`}
            style={{ '--au-provenance': sourceGradient(ids) } as React.CSSProperties} onClick={() => select(ids[0])}>{node.text}</button>;
        })}
      </p>) : <p>{meaning.text}</p>}
    </div>
    {expression && <p className="au-read-precise"><strong>{pick(lang, 'Precisely: ', 'Точнее: ')}</strong>{meaning.text}</p>}

    {reasons.length > 0 && <div className="au-read-block">
      <h4>{pick(lang, 'Why', 'Почему')}</h4>
      {reasons.map((reason) => <div key={reason.id} className="au-read-reason">
        <span>{pick(lang, ...(REASON[reason.kind] ?? [reason.kind.replaceAll('_', ' '), reason.kind.replaceAll('_', ' ')]) as [string, string])}</span>
        <p>{reason.summary}</p>
        {reason.limits && <small>{reason.limits}</small>}
      </div>)}
    </div>}

    {meaning.practical_implication && meaning.practical_implication !== bridge && <div className="au-read-block"><h4>{pick(lang, 'In practice', 'На практике')}</h4><p>{meaning.practical_implication}</p></div>}
    {(meaning.scope || meaning.qualifications) && <div className="au-read-block">
      <h4>{pick(lang, 'Where it applies, and where it stops', 'Где это применимо и где заканчивается')}</h4>
      {meaning.scope && <p>{meaning.scope}</p>}{meaning.qualifications && <p>{meaning.qualifications}</p>}
    </div>}
    {bridge && <div className="au-read-block"><h4>{pick(lang, 'My reading', 'Моё прочтение')}</h4><p>{bridge}</p></div>}

    <div className="au-read-block au-read-sources">
      <h4>{pick(lang, 'The passages', 'Фрагменты')}</h4>
      {sources.map((passage) => {
        const spans = links.map((l) => workspace.spans.find((s) => s.id === l.source_span)).filter((s) => s?.passage_revision === passage.revision_id);
        const unique = [...new Map(spans.map((s) => [s!.id, s!])).values()];
        return <figure key={passage.id}>
          {unique.map((span) => <blockquote key={span.id} data-span={span.id} className={selectedSpan === span.id ? 'is-selected' : ''}
            style={{ '--au-provenance': sourceGradient([span.id]) } as React.CSSProperties}>{span.exact}</blockquote>)}
          <figcaption>{pick(lang, 'Meditations', '«Размышления»')} {passage.book}.{passage.section}
            <details><summary>{pick(lang, 'Read the whole passage', 'Весь фрагмент')}</summary><p>{passage.text}</p></details>
          </figcaption>
        </figure>;
      })}
      <AlignmentFigure workspace={workspace} revisionId={lesson.expression_revision ?? lesson.conclusion_revision} lang={lang} />
      <button type="button" className="au-read-inspect" onClick={() => onInspect(lesson.conclusion_id)}>{pick(lang, 'Inspect the evidence links', 'Проверить связи с источниками')}</button>
    </div>
  </section>;
}
