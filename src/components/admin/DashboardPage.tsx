import { useEffect, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { Notices } from './Notices';
import { Icon } from '../forms/Icon';
import { adminCopy as a } from '../../content/adminCopy';
import { fileUrl, type LessonFiles } from '../../lib/lessons';
import { saveBlob } from '../../lib/lessonAdmin';
import { backupEverything } from '../../lib/backup';

interface ThisWeek {
  slug: string;
  title: string;
  week_number: number | null;
  files: LessonFiles;
}

interface Counts {
  newTickets: number;
  inProgress: number;
  newRequests: number;
  unreadEmails: number;
  failedEmails: number;
}

export default function DashboardPage() {
  return (
    <AdminShell current="dashboard" title={a.dashboard.title}>
      {(supabase) => <Dashboard supabase={supabase} />}
    </AdminShell>
  );
}

function Dashboard({ supabase }: { supabase: SupabaseClient }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);
  const [week, setWeek] = useState<ThisWeek | null | undefined>(undefined);
  const [backingUp, setBackingUp] = useState(false);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');

  // The most recently published lesson is "this week".
  useEffect(() => {
    supabase
      .from('lessons')
      .select('slug, title, week_number, files')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .then(({ data }) => setWeek((data?.[0] as ThisWeek) ?? null));
  }, []);

  async function backup() {
    setOk('');
    setProblem('');
    setBackingUp(true);
    try {
      const data = await backupEverything(supabase);
      saveBlob(`byte-sized-buddies-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      setOk(a.dashboard.backupDone);
    } catch {
      setProblem(a.dashboard.backupFailed);
    }
    setBackingUp(false);
  }

  useEffect(() => {
    (async () => {
      const head = { count: 'exact' as const, head: true };
      const [newTickets, inProgress, newRequests, unreadEmails, failedEmails] = await Promise.all([
        supabase.from('tickets').select('id', head).eq('status', 'new'),
        supabase.from('tickets').select('id', head).eq('status', 'in_progress'),
        supabase.from('contact_requests').select('id', head).eq('status', 'new'),
        supabase.from('inbox_messages').select('id', head).eq('is_read', false),
        supabase.from('outbox').select('id', head).eq('status', 'error'),
      ]);
      if (newTickets.error || inProgress.error || newRequests.error || unreadEmails.error || failedEmails.error) return setFailed(true);
      setCounts({
        newTickets: newTickets.count ?? 0,
        inProgress: inProgress.count ?? 0,
        newRequests: newRequests.count ?? 0,
        unreadEmails: unreadEmails.count ?? 0,
        failedEmails: failedEmails.count ?? 0,
      });
    })().catch(() => setFailed(true));
  }, []);

  if (failed) return <p class="admin-message is-error" role="alert">{a.dashboard.error}</p>;
  if (!counts) return <p role="status">{a.dashboard.loading}</p>;

  const waiting = counts.newTickets > 0 || counts.newRequests > 0 || counts.unreadEmails > 0 || counts.failedEmails > 0;
  const d = a.dashboard;
  return (
    <div>
      <section class="admin-box" aria-labelledby="week-title">
        <h2 id="week-title">{d.weekHeading}</h2>
        {week === undefined ? null : week === null ? (
          <p>{d.weekNone}</p>
        ) : (
          <>
            <p class="counter">{d.weekLabel(week.week_number, week.title)}</p>
            <div class="button-row">
              <a class="button button-primary" href={`/admin/present?slug=${encodeURIComponent(week.slug)}`}>
                <Icon name="play" size={24} /> {d.present}
              </a>
              {week.files?.handout && (
                <a class="button button-secondary" href={fileUrl(week.files.handout.path)} target="_blank" rel="noopener noreferrer">
                  <Icon name="download" size={24} /> {d.handout}
                </a>
              )}
              <a class="button button-secondary" href={`/lesson?slug=${encodeURIComponent(week.slug)}`}>
                {d.lessonPage}
              </a>
            </div>
          </>
        )}
      </section>
      <div class="counter-grid">
        <section class="admin-box" aria-label={a.nav.tickets}>
          <p class="counter">{a.dashboard.newTickets(counts.newTickets)}</p>
          <p>{a.dashboard.inProgress(counts.inProgress)}</p>
          <a class="button button-secondary" href="/admin/tickets">
            {a.dashboard.open} {a.nav.tickets.toLowerCase()}
          </a>
        </section>
        <section class="admin-box" aria-label={a.nav.inbox}>
          <p class="counter">{a.dashboard.newRequests(counts.newRequests)}</p>
          <p>{a.dashboard.unreadEmails(counts.unreadEmails)}</p>
          <a class="button button-secondary" href="/admin/inbox">
            {a.dashboard.open} {a.nav.inbox.toLowerCase()}
          </a>
        </section>
      </div>
      <section class="admin-box" aria-labelledby="next-title">
        <h2 id="next-title">{a.dashboard.nextHeading}</h2>
        {waiting ? (
          <ul>
            {counts.newTickets > 0 && (
              <li>
                <a href="/admin/tickets">{a.dashboard.nextTickets}</a>
              </li>
            )}
            {counts.newRequests > 0 && (
              <li>
                <a href="/admin/inbox#requests">{a.dashboard.nextRequests}</a>
              </li>
            )}
            {counts.unreadEmails > 0 && (
              <li>
                <a href="/admin/inbox#emails">{a.dashboard.nextEmails}</a>
              </li>
            )}
            {counts.failedEmails > 0 && (
              <li>
                <a href="/admin/inbox#emails">{a.dashboard.nextFailed(counts.failedEmails)}</a>
              </li>
            )}
          </ul>
        ) : (
          <p>{a.dashboard.nextNothing}</p>
        )}
      </section>
      <section class="admin-box" aria-labelledby="backup-title">
        <h2 id="backup-title">{d.backupHeading}</h2>
        <p>{d.backupHelp}</p>
        <p class="caption">{d.backupPrivate}</p>
        <Notices ok={ok} problem={problem} />
        <button type="button" class="button button-secondary" disabled={backingUp} onClick={backup}>
          <Icon name="download" size={24} /> {backingUp ? d.backingUp : d.backup}
        </button>
      </section>
    </div>
  );
}
