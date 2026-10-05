import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { ConfirmDialog } from './ConfirmDialog';
import { Notices } from './Notices';
import { Icon } from '../forms/Icon';
import { adminCopy as a, formatWhen } from '../../content/adminCopy';
import { formatBytes, lessonBytes, sortByWeek, STORAGE_LIMIT_BYTES, type Lesson } from '../../lib/lessons';
import { inspectFile, validateKit, type KitFileInfo, type KitResult } from '../../lib/kit';
import {
  buildKitZip,
  filesRecord,
  pathsIn,
  removeStaleFiles,
  removeStoragePaths,
  rowFromKit,
  saveBlob,
  uploadLessonFile,
} from '../../lib/lessonAdmin';
import { FILE_SLOTS, type FileSlot } from '../../lib/kit';
import type { ExtraFile, StoredFile } from '../../lib/lessons';

type Row = Pick<Lesson, 'id' | 'slug' | 'week_number' | 'title' | 'status' | 'published_at' | 'updated_at' | 'files'>;
const t = a.lessons;
const listColumns = 'id, slug, week_number, title, status, published_at, updated_at, files';

export default function LessonsPage() {
  return (
    <AdminShell current="lessons" title={t.title}>
      {(supabase) => <Lessons supabase={supabase} />}
    </AdminShell>
  );
}

interface KitState {
  files: File[];
  result: KitResult;
  existing: { id: string } | null;
}

function Lessons({ supabase }: { supabase: SupabaseClient }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [kit, setKit] = useState<KitState | null>(null);
  const [kitProblems, setKitProblems] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  async function load() {
    const { data, error } = await supabase.from('lessons').select(listColumns);
    if (error) return setFailed(true);
    setRows(sortByWeek(data as Row[]));
  }
  useEffect(() => {
    load().catch(() => setFailed(true));
  }, []);

  const used = useMemo(() => (rows ?? []).reduce((sum, row) => sum + lessonBytes(row.files ?? {}), 0), [rows]);

  function say(text: string, isProblem = false) {
    setOk(isProblem ? '' : text);
    setProblem(isProblem ? text : '');
  }

  // ---- Import a kit
  async function readFiles(list: FileList | File[]) {
    setKit(null);
    setKitProblems([]);
    say('');
    const files = Array.from(list);
    const kitFile = files.find((file) => file.name.toLowerCase() === 'kit.json');
    if (!kitFile) return setKitProblems([t.kitMissing]);
    const names = files.map((file) => file.name);
    const dupes = names.filter((name, i) => names.indexOf(name) !== i);
    if (dupes.length) return setKitProblems([`Two files are both named "${dupes[0]}". Please keep only one.`]);
    let json: unknown;
    try {
      if (kitFile.size > 2_000_000) throw new Error('too big');
      json = JSON.parse(await kitFile.text());
    } catch {
      return setKitProblems([t.kitUnreadable]);
    }
    const others = files.filter((file) => file !== kitFile);
    const infos: KitFileInfo[] = await Promise.all(others.map(inspectFile));
    const result = validateKit(json, infos);
    let existing: { id: string } | null = null;
    if (result.lesson) {
      const { data } = await supabase.from('lessons').select('id').eq('slug', result.lesson.slug).maybeSingle();
      existing = data ? { id: (data as { id: string }).id } : null;
    }
    setKit({ files: others, result, existing });
  }

  async function saveKit() {
    if (!kit?.result.lesson) return;
    const lesson = kit.result.lesson;
    setConfirmReplace(false);
    setBusy(t.saving);
    say('');
    try {
      const byName = new Map(kit.files.map((file) => [file.name, file]));
      const uploads: { name: string; slot?: FileSlot; extraTitle?: string }[] = [
        ...FILE_SLOTS.flatMap((slot) => (lesson.files[slot] ? [{ name: lesson.files[slot]!, slot }] : [])),
        ...lesson.images.map((name) => ({ name })),
        ...lesson.extras.map((extra) => ({ name: extra.file, extraTitle: extra.title })),
      ];
      const slots: Partial<Record<FileSlot, StoredFile>> = {};
      const images: { name: string; path: string; bytes: number }[] = [];
      const extras: ExtraFile[] = [];
      for (const [i, item] of uploads.entries()) {
        setBusy(t.uploading(i + 1, uploads.length));
        const stored = await uploadLessonFile(supabase, lesson.slug, byName.get(item.name)!);
        if (item.slot) slots[item.slot] = stored;
        else if (item.extraTitle !== undefined) extras.push({ name: item.name, title: item.extraTitle, ...stored });
        else images.push({ name: item.name, ...stored });
      }
      const files = filesRecord(slots, images, extras);
      const row = rowFromKit(lesson, files);
      if (kit.existing) {
        const { error } = await supabase.from('lessons').update(row).eq('id', kit.existing.id);
        if (error) throw error;
        await removeStaleFiles(supabase, lesson.slug, pathsIn(files));
      } else {
        const { error } = await supabase.from('lessons').insert(row);
        if (error) throw error;
      }
      setKit(null);
      setShowImport(false);
      say(t.imported(lesson.title));
      await load();
    } catch {
      say(t.saveError, true);
    } finally {
      setBusy('');
    }
  }

  // ---- Publish, delete, export
  async function setStatus(row: Row, status: 'draft' | 'published') {
    setBusy(row.id);
    const { error } = await supabase
      .from('lessons')
      .update({ status, published_at: status === 'published' ? new Date().toISOString() : null })
      .eq('id', row.id);
    setBusy('');
    if (error) return say(t.saveError, true);
    say(status === 'published' ? t.published_ok(row.title) : t.unpublished_ok(row.title));
    await load();
  }

  async function remove() {
    const row = toDelete;
    if (!row) return;
    setToDelete(null);
    setBusy(row.id);
    const { error } = await supabase.from('lessons').delete().eq('id', row.id);
    if (error) {
      setBusy('');
      return say(t.saveError, true);
    }
    // The lesson is gone either way. Clean up its files too.
    await removeStaleFiles(supabase, row.slug, []).catch(() => undefined);
    await removeStoragePaths(supabase, pathsIn(row.files ?? {})).catch(() => undefined);
    setBusy('');
    say(t.deleted(row.title));
    await load();
  }

  async function exportKit(row: Row) {
    setBusy(row.id);
    say(t.exporting);
    try {
      const { data, error } = await supabase.from('lessons').select('*').eq('id', row.id).single();
      if (error || !data) throw error;
      const zip = await buildKitZip(data as Lesson);
      saveBlob(`${row.slug}-kit.zip`, zip as BlobPart, 'application/zip');
      say(t.exportDone);
    } catch {
      say(t.exportFailed, true);
    } finally {
      setBusy('');
    }
  }

  async function backup() {
    setBusy('backup');
    const { data, error } = await supabase.from('lessons').select('*');
    setBusy('');
    if (error) return say(t.saveError, true);
    const stamp = new Date().toISOString().slice(0, 10);
    saveBlob(`byte-sized-buddies-lessons-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
    say(t.backupDone);
  }

  const result = kit?.result;
  return (
    <div>
      <Notices ok={ok} problem={problem} />

      <section class="admin-box" aria-labelledby="storage-title">
        <h2 id="storage-title" class="visually-hidden">
          {t.storageLabel}
        </h2>
        <p>
          <strong>{t.storageUsed(formatBytes(used))}</strong>
        </p>
        <div class="meter-bar" role="progressbar" aria-label={t.storageLabel} aria-valuemin={0} aria-valuemax={STORAGE_LIMIT_BYTES} aria-valuenow={used}>
          <div style={`width: ${Math.min(100, (used / STORAGE_LIMIT_BYTES) * 100)}%`} />
        </div>
        <div class="button-row">
          <a class="button button-primary" href="/admin/lesson-edit">
            {t.newLesson}
          </a>
          <button type="button" class="button button-secondary" aria-expanded={showImport} onClick={() => setShowImport((s) => !s)}>
            {t.importKit}
          </button>
          <button type="button" class="button button-secondary" disabled={busy !== ''} onClick={backup}>
            <Icon name="download" size={24} /> {t.backup}
          </button>
        </div>
      </section>

      {showImport && (
        <section class="admin-box" aria-labelledby="import-title">
          <h2 id="import-title">{t.importHeading}</h2>
          <p>{t.importHelp}</p>
          <div
            class={`drop-zone${over ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (e.dataTransfer?.files.length) void readFiles(e.dataTransfer.files);
            }}
          >
            <label class="field-label" for="kit-files">
              {t.chooseFiles}
            </label>
            <input
              id="kit-files"
              class="field-control"
              type="file"
              multiple
              accept=".json,.pdf,.png,.jpg,.jpeg,.webp,.svg"
              onChange={(e) => e.currentTarget.files && void readFiles(e.currentTarget.files)}
            />
            <p class="caption">{t.dropHere}</p>
          </div>

          {kitProblems.length > 0 && (
            <div role="alert" class="admin-message is-error">
              <ul class="problem-list">
                {kitProblems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {result && (
            <div aria-live="polite">
              {result.errors.length > 0 ? (
                <div role="alert" class="admin-message is-error">
                  <p>{t.problems}</p>
                  <ul class="problem-list">
                    {result.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p class="admin-message">{result.summary}</p>
              )}
              {result.warnings.length > 0 && (
                <div>
                  <h3>{t.warningsHeading}</h3>
                  <ul class="note-list">
                    {result.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.lesson && (
                <div class="button-row">
                  <button
                    type="button"
                    class={`button ${kit?.existing ? 'button-danger' : 'button-primary'}`}
                    disabled={busy !== ''}
                    onClick={() => (kit?.existing ? setConfirmReplace(true) : void saveKit())}
                  >
                    {busy && !kit?.existing ? busy : kit?.existing ? t.replaceButton : t.saveDraft}
                  </button>
                  <button type="button" class="button button-secondary" onClick={() => { setKit(null); setKitProblems([]); }}>
                    {t.clear}
                  </button>
                </div>
              )}
              {busy && <p role="status">{busy}</p>}
            </div>
          )}
        </section>
      )}

      {failed ? (
        <p class="admin-message is-error" role="alert">{t.loadError}</p>
      ) : rows === null ? (
        <p role="status">{t.loading}</p>
      ) : rows.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul class="admin-list">
          {rows.map((row) => (
            <li key={row.id} class="admin-box" style="margin-bottom: 16px;">
              <p style="margin-bottom: 8px;">
                <span class="badge badge-sunshine">{row.week_number === null ? 'No week' : `Week ${row.week_number}`}</span>{' '}
                <span class="status-pill">{row.status === 'published' ? t.published : t.draft}</span>
              </p>
              <h2 style="margin: 0 0 8px;">{row.title}</h2>
              <p class="caption">
                {t.updated} {formatWhen(row.updated_at)}
              </p>
              <div class="lesson-row-actions">
                <a class="button button-secondary" href={`/admin/lesson-edit?slug=${encodeURIComponent(row.slug)}`}>
                  {t.edit}
                </a>
                <a class="button button-secondary" href={`/admin/lesson-preview?slug=${encodeURIComponent(row.slug)}`}>
                  {t.preview}
                </a>
                <a class="button button-secondary" href={`/admin/present?slug=${encodeURIComponent(row.slug)}`}>
                  {t.present}
                </a>
                {row.status === 'published' && (
                  <a class="button button-secondary" href={`/lesson?slug=${encodeURIComponent(row.slug)}`} target="_blank" rel="noopener noreferrer">
                    {t.viewPublic}
                  </a>
                )}
                <button type="button" class="button button-primary" disabled={busy !== ''} onClick={() => setStatus(row, row.status === 'published' ? 'draft' : 'published')}>
                  {row.status === 'published' ? t.unpublish : t.publish}
                </button>
                <button type="button" class="button button-secondary" disabled={busy !== ''} onClick={() => exportKit(row)}>
                  {t.exportKit}
                </button>
                <button type="button" class="button button-danger" disabled={busy !== ''} onClick={() => setToDelete(row)}>
                  {t.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmReplace}
        danger
        title={t.replaceTitle}
        confirmLabel={t.replaceButton}
        cancelLabel={t.cancel}
        onConfirm={saveKit}
        onCancel={() => setConfirmReplace(false)}
      >
        <p>{t.replaceText}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={toDelete !== null}
        danger
        title={t.confirmDeleteTitle}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        requireText={toDelete?.title ?? ''}
        requireLabel={t.typeTitle}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      >
        <p>{t.confirmDeleteText}</p>
      </ConfirmDialog>
    </div>
  );
}
