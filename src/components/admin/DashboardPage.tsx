import { useEffect, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { Notices } from './Notices';
import { Icon } from '../forms/Icon';
import { SlideCanvas, SlideFrame } from '../slides/SlideCanvas';
import { adminCopy as a, formatWhen } from '../../content/adminCopy';
import { fileUrl, imageUrlFor, type LessonFiles } from '../../lib/lessons';
import { saveBlob } from '../../lib/lessonAdmin';
import { backupEverything } from '../../lib/backup';
import type { SlideDeck } from '../../lib/slides';
import type { IconName } from '../../lib/icons';

const d = a.dashboard;

interface ThisWeek {
  slug: string;
  title: string;
  week_number: number | null;
  files: LessonFiles;
  slides: SlideDeck;
}

interface Counts {
  newTickets: number;
  inProgress: number;
  newRequests: number;
  unreadEmails: number;
  failedEmails: number;
}

interface RecentTicket {
  id: string;
  requester_name: string;
  question: string;
  status: string;
  created_at: string;
}

interface RecentRequest {
  id: string;
  facility: string;
  contact_name: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  return (
    <AdminShell current="dashboard" title={d.title}>
      {(supabase) => <Dashboard supabase={supabase} />}
    </AdminShell>
  );
}

const snippet = (text: string) => (text.length > 110 ? `${text.slice(0, 110)}…` : text);

function Dashboard({ supabase }: { supabase: SupabaseClient }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);
  const [week, setWeek] = useState<ThisWeek | null | undefined>(undefined);
  const [tickets, setTickets] = useState<RecentTicket[] | null>(null);
  const [requests, setRequests] = useState<RecentRequest[] | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');

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

    // The most recently published lesson is "this week".
    supabase
      .from('lessons')
      .select('slug, title, week_number, files, slides')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .then(({ data }) => setWeek((data?.[0] as ThisWeek) ?? null));

    supabase
      .from('tickets')
      .select('id, requester_name, question, status, created_at')
      .in('status', ['new', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => setTickets((data ?? []) as RecentTicket[]));

    supabase
      .from('contact_requests')
      .select('id, facility, contact_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setRequests((data ?? []) as RecentRequest[]));
  }, []);

  async function backup() {
    setOk('');
    setProblem('');
    setBackingUp(true);
    try {
      const data = await backupEverything(supabase);
      saveBlob(`byte-sized-buddies-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      setOk(d.backupDone);
    } catch {
      setProblem(d.backupFailed);
    }
    setBackingUp(false);
  }

  if (failed) return <p class="admin-message is-error" role="alert">{d.error}</p>;
  if (!counts) return <p role="status">{d.loading}</p>;

  const stats: { n: number; label: string; href: string; icon: IconName }[] = [
    { n: counts.newTickets, label: d.stats.newTickets(counts.newTickets), href: '/admin/tickets', icon: 'question' },
    { n: counts.inProgress, label: d.stats.inProgress(counts.inProgress), href: '/admin/tickets', icon: 'pen' },
    { n: counts.newRequests, label: d.stats.newRequests(counts.newRequests), href: '/admin/inbox#requests', icon: 'home' },
    { n: counts.unreadEmails, label: d.stats.unreadEmails(counts.unreadEmails), href: '/admin/inbox#emails', icon: 'mail' },
  ];
  const waiting = counts.newTickets > 0 || counts.newRequests > 0 || counts.unreadEmails > 0 || counts.failedEmails > 0;
  const firstSlide = week?.slides?.slides?.[0];

  return (
    <div class="dash">
      <h2 class="visually-hidden">{d.statsLabel}</h2>
      <ul class="stat-grid">
        {stats.map((s) => (
          <li key={s.label}>
            <a class="stat-tile" href={s.href}>
              <span class="icon-circle icon-circle--tint">
                <Icon name={s.icon} size={26} />
              </span>
              <span>
                <strong class="stat-number">{s.n}</strong>
                <span class="stat-label">{s.label}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div class="dash-columns">
        <div class="dash-col">
          <section class="admin-box" aria-labelledby="week-title">
            <h2 id="week-title">{d.weekHeading}</h2>
            {week === undefined ? null : week === null ? (
              <p>{d.weekNone}</p>
            ) : (
              <>
                <p class="counter">{d.weekLabel(week.week_number, week.title)}</p>
                {firstSlide && (
                  <div class="dash-slide" role="img" aria-label={d.slidePreview(week.title)}>
                    <SlideFrame>
                      <SlideCanvas slide={firstSlide} lessonName={week.title} imageUrl={(file) => imageUrlFor({ slug: week.slug, files: week.files }, file)} />
                    </SlideFrame>
                  </div>
                )}
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

          <section class="admin-box" aria-labelledby="next-title">
            <h2 id="next-title">{d.nextHeading}</h2>
            {waiting ? (
              <ul class="check-list">
                {counts.newTickets > 0 && (
                  <li>
                    <Icon name="question" size={24} /> <a href="/admin/tickets">{d.nextTickets}</a>
                  </li>
                )}
                {counts.newRequests > 0 && (
                  <li>
                    <Icon name="home" size={24} /> <a href="/admin/inbox#requests">{d.nextRequests}</a>
                  </li>
                )}
                {counts.unreadEmails > 0 && (
                  <li>
                    <Icon name="mail" size={24} /> <a href="/admin/inbox#emails">{d.nextEmails}</a>
                  </li>
                )}
                {counts.failedEmails > 0 && (
                  <li>
                    <Icon name="alert" size={24} /> <a href="/admin/inbox#emails">{d.nextFailed(counts.failedEmails)}</a>
                  </li>
                )}
              </ul>
            ) : (
              <p>{d.nextNothing}</p>
            )}
          </section>
        </div>

        <div class="dash-col">
          <section class="admin-box" aria-labelledby="recent-tickets-title">
            <div class="box-head">
              <h2 id="recent-tickets-title">{d.recentTickets}</h2>
              <a href="/admin/tickets">{d.seeAll}</a>
            </div>
            {tickets === null ? null : tickets.length === 0 ? (
              <p>{d.recentTicketsEmpty}</p>
            ) : (
              <ul class="recent-list">
                {tickets.map((row) => (
                  <li key={row.id}>
                    <p class="recent-title">
                      <strong>{row.requester_name}</strong>{' '}
                      <span class="status-pill">{a.words.ticketStatus[row.status as keyof typeof a.words.ticketStatus] ?? row.status}</span>
                    </p>
                    <p class="recent-text">{snippet(row.question)}</p>
                    <p class="caption">{formatWhen(row.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section class="admin-box" aria-labelledby="recent-requests-title">
            <div class="box-head">
              <h2 id="recent-requests-title">{d.recentRequests}</h2>
              <a href="/admin/inbox#requests">{d.seeAll}</a>
            </div>
            {requests === null ? null : requests.length === 0 ? (
              <p>{d.recentRequestsEmpty}</p>
            ) : (
              <ul class="recent-list">
                {requests.map((row) => (
                  <li key={row.id}>
                    <p class="recent-title">
                      <strong>{row.facility}</strong>{' '}
                      <span class="status-pill">{a.words.requestStatus[row.status as keyof typeof a.words.requestStatus] ?? row.status}</span>
                    </p>
                    <p class="caption">
                      {row.contact_name} · {formatWhen(row.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div class="dash-columns">
        <section class="admin-box" aria-labelledby="quick-title">
          <h2 id="quick-title">{d.quickHeading}</h2>
          <ul class="quick-grid">
            {d.quick.map((q) => (
              <li key={q.href}>
                <a class="quick-link" href={q.href}>
                  <Icon name={q.icon as IconName} size={28} />
                  <span>{q.label}</span>
                </a>
              </li>
            ))}
          </ul>
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
    </div>
  );
}
