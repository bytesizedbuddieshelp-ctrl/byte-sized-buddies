import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { ConfirmDialog } from './ConfirmDialog';
import { Notices } from './Notices';
import { Field } from '../forms/Field';
import { Icon } from '../forms/Icon';
import { adminCopy as a } from '../../content/adminCopy';
import { saveBlob } from '../../lib/lessonAdmin';
import { limits, loadVisits, newVisitId, saveVisits, validateVisit, visitStats, visitsToCsv, MAX_VISITS, type Visit, type VisitErrors, type VisitInput } from '../../lib/visitLog';

const t = a.visits;

interface LessonOption {
  slug: string;
  title: string;
  week_number: number | null;
}

export default function VisitsPage() {
  return (
    <AdminShell current="visits" title={t.title}>
      {(supabase) => <Visits supabase={supabase} />}
    </AdminShell>
  );
}

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const blank = (): VisitInput => ({ date: today(), facility: '', lesson_slug: '', learners: '', went_well: '', to_change: '', next_step: '' });
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' });

function Visits({ supabase }: { supabase: SupabaseClient }) {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState<VisitInput>(blank());
  const [errors, setErrors] = useState<VisitErrors>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');
  const [toDelete, setToDelete] = useState<Visit | null>(null);

  useEffect(() => {
    loadVisits(supabase).then(setVisits).catch(() => setFailed(true));
    supabase
      .from('lessons')
      .select('slug, title, week_number')
      .order('week_number', { ascending: false, nullsFirst: false })
      .then(({ data }) => setLessons((data ?? []) as LessonOption[]));
  }, []);

  const stats = useMemo(() => visitStats(visits ?? []), [visits]);
  const set = (key: keyof VisitInput) => (e: Event) => setForm((f) => ({ ...f, [key]: (e.currentTarget as HTMLInputElement).value }));

  async function persist(next: Visit[]) {
    await saveVisits(supabase, next);
    setVisits(next.slice().sort((x, y) => y.date.localeCompare(x.date) || y.created_at.localeCompare(x.created_at)));
  }

  async function submit(e: Event) {
    e.preventDefault();
    setOk('');
    setProblem('');
    const lesson = lessons.find((l) => l.slug === form.lesson_slug);
    const checked = validateVisit({ ...form, lesson_title: lesson ? lesson.title : '' });
    setErrors(checked.errors);
    if (!checked.visit) return;
    if (!editing && (visits?.length ?? 0) >= MAX_VISITS) return setProblem(`The log holds ${MAX_VISITS} visits. Download a spreadsheet, then delete the oldest ones.`);
    setBusy(true);
    try {
      const list = visits ?? [];
      if (editing) {
        await persist(list.map((v) => (v.id === editing ? { ...v, ...checked.visit! } : v)));
      } else {
        await persist([...list, { id: newVisitId(), created_at: new Date().toISOString(), ...checked.visit }]);
      }
      setOk(t.saved);
      setForm(blank());
      setEditing(null);
    } catch {
      setProblem(t.saveError);
    }
    setBusy(false);
  }

  function edit(v: Visit) {
    setEditing(v.id);
    setErrors({});
    setOk('');
    setForm({ date: v.date, facility: v.facility, lesson_slug: v.lesson_slug ?? '', learners: v.learners === null ? '' : String(v.learners), went_well: v.went_well, to_change: v.to_change, next_step: v.next_step });
    document.getElementById('visit-date')?.scrollIntoView({ block: 'center' });
    document.getElementById('visit-date')?.focus();
  }

  async function remove() {
    const v = toDelete;
    setToDelete(null);
    if (!v || !visits) return;
    try {
      await persist(visits.filter((x) => x.id !== v.id));
      setOk(t.deleted);
    } catch {
      setProblem(t.saveError);
    }
  }

  function exportCsv() {
    saveBlob(`byte-sized-buddies-visits-${today()}.csv`, visitsToCsv(visits ?? []), 'text/csv');
    setOk(t.exportDone);
  }

  if (failed) return <p class="admin-message is-error" role="alert">{t.loadError}</p>;
  if (visits === null) return <p role="status">{t.loading}</p>;

  const problems = Object.values(errors);
  return (
    <div>
      <p class="lead">{t.intro}</p>
      <p class="admin-message">{t.privateNote}</p>
      <Notices ok={ok} problem={problem} />

      <section class="admin-box" aria-labelledby="visit-add-title">
        <h2 id="visit-add-title">{editing ? t.editing : t.addHeading}</h2>
        {problems.length > 0 && (
          <div role="alert" class="admin-message is-error">
            <p>{t.problems}</p>
            <ul class="problem-list">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <form onSubmit={submit} noValidate class="visit-form">
          <div class="field">
            <label class="field-label" for="visit-date">
              {t.fields.date}
            </label>
            <input id="visit-date" class="field-control" type="date" value={form.date} aria-invalid={errors.date ? 'true' : undefined} onInput={set('date')} />
          </div>
          <div class="field">
            <label class="field-label" for="visit-facility">
              {t.fields.facility}
            </label>
            <input id="visit-facility" class="field-control" type="text" value={form.facility} maxLength={limits.facility} aria-invalid={errors.facility ? 'true' : undefined} onInput={set('facility')} />
          </div>
          <div class="field">
            <label class="field-label" for="visit-lesson">
              {t.fields.lesson}
            </label>
            <select id="visit-lesson" class="field-control" value={form.lesson_slug} onChange={set('lesson_slug')}>
              <option value="">{t.fields.lessonNone}</option>
              {lessons.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.week_number ? `Week ${l.week_number}: ` : ''}
                  {l.title}
                </option>
              ))}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="visit-learners">
              {t.fields.learners}
            </label>
            <p class="field-helper" id="visit-learners-help">
              {t.fields.learnersHelp}
            </p>
            <input id="visit-learners" class="field-control" type="text" inputMode="numeric" value={form.learners} aria-describedby="visit-learners-help" aria-invalid={errors.learners ? 'true' : undefined} onInput={set('learners')} />
          </div>
          <div class="field visit-wide">
            <label class="field-label" for="visit-well">
              {t.fields.wentWell}
            </label>
            <textarea id="visit-well" class="field-control" rows={3} maxLength={limits.note} value={form.went_well} onInput={set('went_well')} />
          </div>
          <div class="field visit-wide">
            <label class="field-label" for="visit-change">
              {t.fields.toChange}
            </label>
            <textarea id="visit-change" class="field-control" rows={3} maxLength={limits.note} value={form.to_change} onInput={set('to_change')} />
          </div>
          <div class="field visit-wide">
            <label class="field-label" for="visit-next">
              {t.fields.nextStep}
            </label>
            <p class="field-helper" id="visit-next-help">
              {t.fields.nextStepHelp}
            </p>
            <textarea id="visit-next" class="field-control" rows={2} maxLength={limits.note} value={form.next_step} aria-describedby="visit-next-help" onInput={set('next_step')} />
          </div>
          <div class="button-row visit-wide">
            <button type="submit" class="button button-primary" disabled={busy}>
              {busy ? t.saving : t.save}
            </button>
            {editing && (
              <button
                type="button"
                class="button button-secondary"
                onClick={() => {
                  setEditing(null);
                  setForm(blank());
                  setErrors({});
                }}
              >
                {t.cancelEdit}
              </button>
            )}
          </div>
        </form>
      </section>

      {visits.length > 0 && (
        <section class="admin-box" aria-labelledby="visit-stats-title">
          <h2 id="visit-stats-title">{t.statsHeading}</h2>
          <ul class="stat-grid">
            <li class="stat-tile">
              <strong class="stat-number">{stats.visits}</strong> <span class="stat-label">{t.stats.visits(stats.visits)}</span>
            </li>
            <li class="stat-tile">
              <strong class="stat-number">{stats.learners}</strong> <span class="stat-label">{t.stats.learners(stats.learners)}</span>
            </li>
            <li class="stat-tile">
              <strong class="stat-number">{stats.places}</strong> <span class="stat-label">{t.stats.places(stats.places)}</span>
            </li>
          </ul>
          {stats.mostTaught && <p>{t.mostTaught(stats.mostTaught.title, stats.mostTaught.count)}</p>}
          <div class="button-row">
            <button type="button" class="button button-secondary" onClick={exportCsv}>
              <Icon name="download" size={24} /> {t.export}
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="visit-list-title">
        <h2 id="visit-list-title">{t.listHeading}</h2>
        {visits.length === 0 ? (
          <p>{t.empty}</p>
        ) : (
          <ul class="admin-list">
            {visits.map((v) => (
              <li key={v.id} class="admin-box">
                <h3 style="margin: 0 0 8px;">{v.facility}</h3>
                <p class="caption">
                  {longDate(v.date)}
                  {v.lesson_title && ` · ${v.lesson_title}`}
                  {v.learners !== null && ` · ${t.learnersCount(v.learners)}`}
                </p>
                {v.went_well && (
                  <p>
                    <strong>{t.wentWellLabel}:</strong> {v.went_well}
                  </p>
                )}
                {v.to_change && (
                  <p>
                    <strong>{t.toChangeLabel}:</strong> {v.to_change}
                  </p>
                )}
                {v.next_step && (
                  <p>
                    <strong>{t.nextStepLabel}:</strong> {v.next_step}
                  </p>
                )}
                <div class="button-row">
                  <button type="button" class="button button-secondary" onClick={() => edit(v)}>
                    {t.edit}
                  </button>
                  <button type="button" class="button button-danger" onClick={() => setToDelete(v)}>
                    {t.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog open={toDelete !== null} danger title={t.confirmTitle} confirmLabel={t.delete} cancelLabel={t.cancel} onConfirm={remove} onCancel={() => setToDelete(null)}>
        <p>{t.confirmText}</p>
      </ConfirmDialog>
    </div>
  );
}
