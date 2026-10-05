import { useEffect, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { adminCopy as a } from '../../content/adminCopy';

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
  return (
    <div>
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
    </div>
  );
}
