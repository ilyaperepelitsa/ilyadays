'use client';
import { useId, useRef, useState } from 'react';
import type { Workspace } from '@/lib/aurelius/types';
import { downloadSyntheticProject, type WorkStorage } from '@/lib/aurelius/persistence';
import { backupSummary, parseBackup } from '@/lib/aurelius/backup.mjs';

type Lang = 'en' | 'ru';
const pick = (lang: Lang, en: string, ru: string) => (lang === 'ru' ? ru : en);
type Summary = ReturnType<typeof backupSummary>;
type Pending = { workspace: Workspace; file: string; incoming: Summary };

export function ProjectBackup({ workspace, storage, lang, onRestored, disabled }: { workspace: Workspace; storage: WorkStorage; lang: Lang; onRestored: (w: Workspace) => void; disabled: boolean }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const current = backupSummary(workspace);

  const exportProject = () => {
    try {
      setError('');
      downloadSyntheticProject(workspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : pick(lang, 'Export failed.', 'Не удалось экспортировать.'));
    }
  };
  const choose = async (file: File | undefined) => {
    setError('');
    setPending(null);
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text(), workspace) as Workspace;
      setPending({ workspace: parsed, file: file.name, incoming: backupSummary(parsed) });
    } catch (e) {
      setError(e instanceof Error ? e.message : pick(lang, 'This file could not be read.', 'Не удалось прочитать файл.'));
    }
    if (input.current) input.current.value = '';
  };
  const cancel = () => {
    setPending(null);
    setError('');
  };
  const replace = async () => {
    if (!pending || !storage.restore) return;
    setWorking(true);
    try {
      const stored = await storage.restore(pending.workspace);
      setPending(null);
      onRestored(stored);
    } catch (e) {
      setError(e instanceof Error ? e.message : pick(lang, 'Restore failed; your current study was kept.', 'Не удалось восстановить; текущее исследование сохранено.'));
    } finally {
      setWorking(false);
    }
  };
  const rows: [string, keyof Summary][] = [
    [pick(lang, 'Lessons', 'Уроки'), 'lessons'],
    [pick(lang, 'Passages', 'Отрывки'), 'passages'],
    [pick(lang, 'Evidence links', 'Связи с источником'), 'evidenceLinks'],
    [pick(lang, 'Saved book revisions', 'Сохранённые версии книги'), 'bookRevisions'],
    [pick(lang, 'Version', 'Версия'), 'version'],
  ];

  return (
    <section className="au-backup" aria-label={pick(lang, 'Backup and restore', 'Резервная копия')}>
      <div className="au-backup-actions">
        <button type="button" onClick={exportProject} disabled={disabled || working}>{pick(lang, 'Export project', 'Экспортировать проект')}</button>
        {storage.restore && (
          <>
            <label className="au-backup-file" htmlFor={inputId} aria-disabled={disabled || working}>{pick(lang, 'Import project…', 'Импортировать проект…')}</label>
            <input id={inputId} ref={input} className="au-backup-input" type="file" accept=".json,application/json" disabled={disabled || working} onChange={(e) => void choose(e.target.files?.[0])} />
          </>
        )}
      </div>
      {pending && (
        <div className="au-backup-confirm" role="group" aria-label={pick(lang, 'Confirm restore', 'Подтвердите восстановление')}>
          <p><strong>{pick(lang, 'This replaces the study saved in this browser.', 'Это заменит исследование, сохранённое в этом браузере.')}</strong> {pick(lang, 'The current study cannot be recovered afterwards unless you exported it.', 'Текущее исследование нельзя будет вернуть, если вы его не экспортировали.')}</p>
          <table>
            <caption>{pending.file}</caption>
            <thead><tr><th scope="col" /><th scope="col">{pick(lang, 'In this browser', 'В этом браузере')}</th><th scope="col">{pick(lang, 'In the file', 'В файле')}</th></tr></thead>
            <tbody>{rows.map(([label, key]) => <tr key={key}><th scope="row">{label}</th><td>{current[key]}</td><td>{pending.incoming[key]}</td></tr>)}</tbody>
          </table>
          <div className="au-backup-actions">
            <button type="button" className="au-backup-danger" onClick={() => void replace()} disabled={working}>{pick(lang, 'Replace', 'Заменить')}</button>
            <button type="button" onClick={cancel} disabled={working}>{pick(lang, 'Cancel', 'Отмена')}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="au-backup-error">{error}</p>}
    </section>
  );
}
