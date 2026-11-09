"use client";
import { useEffect, useRef, useState } from "react";
import type { SousVide } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { Html, Illo } from "./parts";
import { ActionIcon } from "../site/ActionIcon";

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").trim();

export function SousVideTables({ lang, tables }: { lang: Lang; tables: SousVide['tables'] }) {
  const [state, setState] = useState('all');
  const [layout, setLayout] = useState('table');
  const ru = lang === 'ru';
  const reference = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const reveal = () => {
      const id = window.location.hash.slice(1);
      if (id === 'reference' || tables.some((t) => t.id === id)) {
        if (reference.current) reference.current.open = true;
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
      }
    };
    reveal(); window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [tables]);

  return <details className="block sv-reference cook-reference" id="reference" ref={reference} data-layout={layout}>
    <summary>{ru ? 'Полные таблицы и примечания' : 'Full reference tables & notes'}</summary>
    <div className="sv-reference-toolbar">
      <fieldset className="sv-filter">
        <legend>{ru ? 'Начальное состояние' : 'Starting state'}</legend>
        {[
          ['all', ru ? 'Все режимы' : 'All schedules'],
          ['chilled', ru ? 'Охлаждённое / размороженное' : 'Chilled / thawed'],
          ['frozen', ru ? 'Из морозилки' : 'From frozen'],
        ].map(([value, label]) => <label key={value}><input type="radio" name="sv-state" value={value} checked={state === value} onChange={() => setState(value)} />{label}</label>)}
      </fieldset>
      <fieldset className="sv-table-layout">
        <legend>{ru ? 'Вид' : 'View'}</legend>
        {[['table', ru ? 'Таблица' : 'Table'], ['cards', ru ? 'Карточки' : 'Cards']].map(([value, label]) =>
          <label key={value}><input type="radio" name="sv-layout" value={value} checked={layout === value} onChange={() => setLayout(value)} />{label}</label>)}
      </fieldset>
    </div>
    {tables.map((t) => {
      const rows = t.rows.map((row, i) => ({ row, i })).filter(({ i }) => state === 'all' || !t.states || t.states[i] === state || t.states[i] === 'both');
      const stateColumn = t.cols.findIndex((col) => /^(state|состояние)$/i.test(plain(col.label_html)));
      return <section className="block sv sv-table-section" id={t.id} key={t.id}>
        <header className="sv-table-heading">
          <div><h2 id={`${t.id}-heading`}>{t.title}</h2><p className="sv-table-count">{ru ? 'Режимы' : 'Schedules'} · {rows.length}</p></div>
          {t.image && <figure className="sv-art"><Illo src={t.image} alt={t.title} /></figure>}
        </header>
        <p className="sv-scroll-hint"><ActionIcon name="swap" />{ru ? 'Прокрутите вбок, чтобы сравнить столбцы' : 'Scroll sideways to compare columns'}</p>
        <div className="table-wrap cooking-reference-frame" role="region" aria-labelledby={`${t.id}-heading`} tabIndex={0}>
          <table className="stack cook-reference-table" role="table" aria-labelledby={`${t.id}-heading`}>
            <thead role="rowgroup"><tr role="row">{t.cols.map((col, i) => <th key={i} scope="col" role="columnheader" className={col.numeric ? 'num' : undefined} dangerouslySetInnerHTML={{ __html: col.label_html }} />)}</tr></thead>
            <tbody role="rowgroup">{rows.map(({ row, i }) => <tr key={i} role="row" data-starting-state={t.states?.[i]}>{row.map((value, j) => {
              const Tag = j === 0 ? 'th' : 'td';
              return <Tag key={j} scope={j === 0 ? 'row' : undefined} role={j === 0 ? 'rowheader' : 'cell'} className={t.cols[j]?.numeric ? 'num' : undefined} data-label={plain(t.cols[j]?.label_html ?? '')}>
                {j === stateColumn ? <span className="cooking-state">{value}</span> : value}
              </Tag>;
            })}</tr>)}{!rows.length ? <tr><td colSpan={t.cols.length}>{ru ? 'Нет режимов для выбранного состояния.' : 'No schedules for the selected starting state.'}</td></tr> : null}</tbody>
          </table>
        </div>
        {!!t.after_html.length && <div className="sv-after">{t.after_html.map((html, i) => <Html as="p" key={i} html={html} />)}</div>}
      </section>;
    })}
  </details>;
}
