import { useEffect, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { ConfirmDialog } from './ConfirmDialog';
import { Notices } from './Notices';
import { InboxEmails } from './InboxEmails';
import { ReplyComposer } from './ReplyComposer';
import { Icon } from '../forms/Icon';
import { adminCopy as a, formatWhen } from '../../content/adminCopy';
import { replySubject } from '../../lib/validators';

type Status = 'new' | 'replied' | 'scheduled' | 'closed';
const statuses: Status[] = ['new', 'replied', 'scheduled', 'closed'];

interface Request {
  id: string;
  created_at: string;
  status: Status;
  contact_name: string;
  facility: string;
  role: string | null;
  email: string;
  phone: string | null;
  learner_count: string | null;
  devices: string[];
  preferred_times: string | null;
  message: string | null;
  internal_notes: string | null;
}

const t = a.inbox;

type View = 'emails' | 'requests';

// "Contact exchange": emails from the owner's Gmail (through the bridge) and requests from senior homes.
export default function InboxPage() {
  return (
    <AdminShell current="inbox" title={t.title}>
      {(supabase) => <Exchange supabase={supabase} />}
    </AdminShell>
  );
}

function Exchange({ supabase }: { supabase: SupabaseClient }) {
  const [view, setView] = useState<View>(() => (location.hash === '#requests' ? 'requests' : 'emails'));
  const [unread, setUnread] = useState(0);
  const [newRequests, setNewRequests] = useState(0);

  async function loadCounts() {
    const head = { count: 'exact' as const, head: true };
    const [emails, requests] = await Promise.all([
      supabase.from('inbox_messages').select('id', head).eq('is_read', false),
      supabase.from('contact_requests').select('id', head).eq('status', 'new'),
    ]);
    setUnread(emails.count ?? 0);
    setNewRequests(requests.count ?? 0);
  }

  useEffect(() => {
    loadCounts().catch(() => {});
  }, [view]);

  function choose(next: View) {
    setView(next);
    history.replaceState(null, '', next === 'requests' ? '#requests' : '#emails');
  }

  return (
    <div>
      <fieldset class="chips">
        <legend>{t.viewLabel}</legend>
        <button type="button" class="chip" aria-pressed={view === 'emails'} onClick={() => choose('emails')}>
          {t.viewEmails(unread)}
        </button>
        <button type="button" class="chip" aria-pressed={view === 'requests'} onClick={() => choose('requests')}>
          {t.viewRequests(newRequests)}
        </button>
      </fieldset>
      {view === 'emails' ? (
        <InboxEmails supabase={supabase} onChange={() => loadCounts().catch(() => {})} />
      ) : (
        <Requests supabase={supabase} onChange={() => loadCounts().catch(() => {})} />
      )}
    </div>
  );
}

function Requests({ supabase, onChange }: { supabase: SupabaseClient; onChange: () => void }) {
  const [filter, setFilter] = useState<Status>('new');
  const [rows, setRows] = useState<Request[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function load(which: Status = filter) {
    setFailed(false);
    const [list, all] = await Promise.all([
      supabase.from('contact_requests').select('*').eq('status', which).order('created_at', { ascending: false }).limit(100),
      supabase.from('contact_requests').select('status').limit(1000),
    ]);
    if (list.error || all.error) return setFailed(true);
    setRows(list.data as Request[]);
    const tally: Record<string, number> = {};
    for (const row of all.data ?? []) tally[row.status] = (tally[row.status] ?? 0) + 1;
    setCounts(tally);
  }

  useEffect(() => {
    load().catch(() => setFailed(true));
  }, [filter]);

  const open = rows?.find((r) => r.id === openId);
  const detail = open ? (
      <RequestDetail
        key={open.id}
        supabase={supabase}
        request={open}
        onBack={(msg) => {
          setOpenId(null);
          setNote(msg ?? '');
          load().catch(() => setFailed(true));
          onChange();
        }}
      />
  ) : null;

  // Wide screens show the list and the open item side by side. Phones show one at a time.
  return (
    <div class={`master-detail${open ? ' has-open' : ''}`}>
      <div class="md-list">
      <Notices ok={note} problem="" />
      <h2>{t.requestsHeading}</h2>
      <fieldset class="chips">
        <legend>{t.filterLabel}</legend>
        {statuses.map((s) => (
          <button key={s} type="button" class="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {a.words.requestStatus[s]} ({counts[s] ?? 0})
          </button>
        ))}
      </fieldset>
      {failed ? (
        <p class="admin-message is-error" role="alert">{t.loadError}</p>
      ) : rows === null ? (
        <p role="status">{t.loading}</p>
      ) : rows.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul class="admin-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" class="admin-row" aria-current={row.id === openId ? 'true' : undefined} onClick={() => setOpenId(row.id)}>
                <strong>{row.facility}</strong>
                <span class="meta">
                  {row.contact_name} · {formatWhen(row.created_at)}
                </span>
                {row.message && <span class="snippet">{row.message.length > 140 ? `${row.message.slice(0, 140)}…` : row.message}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
      <div class="md-detail">
        {detail ?? (
          <div class="md-empty">
            <p class="md-empty-title">{t.pickRequest}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestDetail({
  supabase,
  request,
  onBack,
}: {
  supabase: SupabaseClient;
  request: Request;
  onBack: (note?: string) => void;
}) {
  const [current, setCurrent] = useState(request);
  const [notes, setNotes] = useState(request.internal_notes ?? '');
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function update(changes: Partial<Request>): Promise<boolean> {
    setOk('');
    setProblem('');
    const { error } = await supabase.from('contact_requests').update(changes).eq('id', current.id);
    if (error) {
      setProblem(t.saveError);
      return false;
    }
    setCurrent({ ...current, ...changes });
    return true;
  }

  async function setStatus(next: Status) {
    setBusy(true);
    if (await update({ status: next })) setOk(t.statusChanged(a.words.requestStatus[next].toLowerCase()));
    setBusy(false);
  }

  async function saveNotes() {
    setBusy(true);
    if (await update({ internal_notes: notes })) setOk(t.notesSaved);
    setBusy(false);
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy(true);
    const { error } = await supabase.from('contact_requests').delete().eq('id', current.id);
    setBusy(false);
    if (error) return setProblem(t.saveError);
    onBack(t.deleted);
  }

  const subject = replySubject(t.replySubject, t.replyFallbackSubject);
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(current.email)}&su=${encodeURIComponent(subject)}`;

  // The first reply to a new request marks it Replied.
  async function afterReply(): Promise<string | void> {
    if (current.status === 'new' && (await update({ status: 'replied' }))) return a.inbox.reply.queuedReplied;
  }
  const devices = current.devices.length ? current.devices.map((d) => a.words.device[d] ?? d).join(', ') : a.words.none;

  return (
    <div>
      <button type="button" class="button button-secondary" onClick={() => onBack()}>
        <Icon name="arrow-left" size={24} /> {t.back}
      </button>
      <h2>{current.facility}</h2>
      <Notices ok={ok} problem={problem} />

      <dl class="detail-grid">
        <dt>{t.contact}</dt>
        <dd>{current.contact_name}</dd>
        <dt>{t.role}</dt>
        <dd>{current.role || a.words.none}</dd>
        <dt>{t.email}</dt>
        <dd>{current.email}</dd>
        <dt>{t.phone}</dt>
        <dd>{current.phone || a.words.none}</dd>
        <dt>{t.learners}</dt>
        <dd>{current.learner_count || a.words.none}</dd>
        <dt>{t.devices}</dt>
        <dd>{devices}</dd>
        <dt>{t.times}</dt>
        <dd>{current.preferred_times || a.words.none}</dd>
        <dt>{t.message}</dt>
        <dd>{current.message || a.words.none}</dd>
        <dt>{t.received}</dt>
        <dd>{formatWhen(current.created_at)}</dd>
        <dt>Status</dt>
        <dd>
          <span class="status-pill">{a.words.requestStatus[current.status]}</span>
        </dd>
      </dl>

      <ReplyComposer supabase={supabase} toEmail={current.email} subject={subject} threadId={null} onQueued={afterReply} />
      <p>
        <a href={gmail} target="_blank" rel="noopener noreferrer">{t.replyGmail}</a> <span class="caption">{t.replyNote}</span>
      </p>

      <fieldset class="chips">
        <legend>{t.statusHeading}</legend>
        {statuses.map((s) => (
          <button key={s} type="button" class="chip" aria-pressed={current.status === s} disabled={busy} onClick={() => setStatus(s)}>
            {a.words.requestStatus[s]}
          </button>
        ))}
      </fieldset>

      <section class="admin-box" aria-labelledby="notes-title">
        <h2 id="notes-title">{t.notes}</h2>
        <div class="field">
          <label class="field-label" for="notes">{t.notes}</label>
          <p class="field-helper">{t.notesHelp}</p>
          <textarea id="notes" class="field-control" rows={4} value={notes} onInput={(e) => setNotes(e.currentTarget.value)} />
        </div>
        <button type="button" class="button button-secondary" disabled={busy} onClick={saveNotes}>{t.saveNotes}</button>
      </section>

      <div class="button-row">
        <button type="button" class="button button-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>{t.delete}</button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title={t.confirmDeleteTitle}
        confirmLabel={t.delete}
        cancelLabel={t.confirmCancel}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        <p>{t.confirmDeleteText}</p>
      </ConfirmDialog>
    </div>
  );
}
