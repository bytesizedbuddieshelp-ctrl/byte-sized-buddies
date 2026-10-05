import { useEffect, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Notices } from './Notices';
import { ReplyComposer } from './ReplyComposer';
import { Icon } from '../forms/Icon';
import { adminCopy as a, formatWhen } from '../../content/adminCopy';
import { replySubject } from '../../lib/validators';

const t = a.inbox;

interface Email {
  id: string;
  gmail_thread_id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  is_read: boolean;
  handled: boolean;
}

interface Failed {
  id: string;
  to_email: string;
  subject: string;
  error: string | null;
}

type Filter = 'open' | 'handled';

// Emails the Gmail bridge copied from the owner's Gmail (label BSB), and replies to them.
export function InboxEmails({ supabase, onChange }: { supabase: SupabaseClient; onChange: () => void }) {
  const [filter, setFilter] = useState<Filter>('open');
  const [rows, setRows] = useState<Email[] | null>(null);
  const [failedMail, setFailedMail] = useState<Failed[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');

  async function load(which: Filter = filter) {
    setLoadFailed(false);
    const [list, failed] = await Promise.all([
      supabase.from('inbox_messages').select('*').eq('handled', which === 'handled').order('received_at', { ascending: false }).limit(100),
      supabase.from('outbox').select('id, to_email, subject, error').eq('status', 'error').order('created_at', { ascending: false }).limit(20),
    ]);
    if (list.error) return setLoadFailed(true);
    setRows(list.data as Email[]);
    setFailedMail(failed.error ? [] : (failed.data as Failed[]));
  }

  useEffect(() => {
    load().catch(() => setLoadFailed(true));
  }, [filter]);

  async function retry(id: string) {
    setOk('');
    setProblem('');
    const { error } = await supabase.from('outbox').update({ status: 'queued', error: null }).eq('id', id);
    if (error) return setProblem(t.saveError);
    setOk(t.retried);
    load().catch(() => setLoadFailed(true));
    onChange();
  }

  async function removeFailed(id: string) {
    setOk('');
    setProblem('');
    const { error } = await supabase.from('outbox').delete().eq('id', id);
    if (error) return setProblem(t.saveError);
    setOk(t.removedFailed);
    load().catch(() => setLoadFailed(true));
    onChange();
  }

  const open = rows?.find((r) => r.id === openId);
  if (open) {
    return (
      <EmailDetail
        supabase={supabase}
        email={open}
        onBack={(msg) => {
          setOpenId(null);
          setOk(msg ?? '');
          setProblem('');
          load().catch(() => setLoadFailed(true));
          onChange();
        }}
      />
    );
  }

  return (
    <div>
      <p class="caption">{t.gmailNote}</p>
      <Notices ok={ok} problem={problem} />

      {failedMail.length > 0 && (
        <section class="admin-box" aria-labelledby="failed-title">
          <h2 id="failed-title">
            <Icon name="alert" size={28} /> {t.failedHeading}
          </h2>
          <p>{t.failedHelp}</p>
          <ul class="reply-history">
            {failedMail.map((f) => (
              <li key={f.id}>
                <p class="reply-body">{t.failedTo(f.to_email, f.subject)}</p>
                {f.error && <p class="reply-reason"><Icon name="alert" size={24} /> {a.inbox.reply.reason(f.error)}</p>}
                <div class="button-row">
                  <button type="button" class="button button-secondary" onClick={() => retry(f.id)}>{t.retry}</button>
                  <button type="button" class="button button-secondary" onClick={() => removeFailed(f.id)}>{t.removeFailed}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2>{t.emailsHeading}</h2>
      <fieldset class="chips">
        <legend>{t.emailFilterLabel}</legend>
        {(['open', 'handled'] as Filter[]).map((f) => (
          <button key={f} type="button" class="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t.emailFilter[f]}
          </button>
        ))}
      </fieldset>
      {loadFailed ? (
        <p class="admin-message is-error" role="alert">{t.emailsLoadError}</p>
      ) : rows === null ? (
        <p role="status">{t.emailsLoading}</p>
      ) : rows.length === 0 ? (
        <>
          <p>{t.emailsEmpty}</p>
          {filter === 'open' && <p class="caption">{t.emailsEmptyHelp}</p>}
        </>
      ) : (
        <ul class="admin-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" class={`admin-row${row.is_read ? '' : ' is-unread'}`} onClick={() => setOpenId(row.id)}>
                {!row.is_read && <span class="status-pill is-unread">{t.unread}</span>} <strong>{row.subject || t.noSubject}</strong>
                <span class="meta">
                  {row.from_name || row.from_email} · {formatWhen(row.received_at)}
                </span>
                {row.body_text && <span class="snippet">{snippet(row.body_text)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
}

function EmailDetail({ supabase, email, onBack }: { supabase: SupabaseClient; email: Email; onBack: (note?: string) => void }) {
  const [current, setCurrent] = useState(email);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  async function update(changes: Partial<Email>): Promise<boolean> {
    const { error } = await supabase.from('inbox_messages').update(changes).eq('id', current.id);
    if (error) return false;
    setCurrent((c) => ({ ...c, ...changes }));
    return true;
  }

  // Opening an email marks it read.
  useEffect(() => {
    if (!email.is_read) update({ is_read: true }).catch(() => {});
  }, [email.id]);

  async function change(changes: Partial<Email>, message: string, leave: boolean) {
    setOk('');
    setProblem('');
    setBusy(true);
    const saved = await update(changes);
    setBusy(false);
    if (!saved) return setProblem(t.saveError);
    if (leave) return onBack(message);
    setOk(message);
  }

  const to = current.from_email ?? '';
  const subject = replySubject(current.subject, t.replyFallbackSubject);
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`;

  return (
    <div>
      <button type="button" class="button button-secondary" onClick={() => onBack()}>
        <Icon name="arrow-left" size={24} /> {t.backEmails}
      </button>
      <h2>{current.subject || t.noSubject}</h2>
      <Notices ok={ok} problem={problem} />

      <dl class="detail-grid">
        <dt>{t.from}</dt>
        <dd>{current.from_name && current.from_name !== to ? `${current.from_name} (${to})` : to}</dd>
        <dt>{t.received}</dt>
        <dd>{formatWhen(current.received_at)}</dd>
        <dt>Status</dt>
        <dd>
          <span class="status-pill">{current.handled ? t.emailFilter.handled : t.emailFilter.open}</span>
        </dd>
      </dl>

      <div class="email-body">{current.body_text || ''}</div>

      <div class="button-row">
        {current.handled ? (
          <button type="button" class="button button-secondary" disabled={busy} onClick={() => change({ handled: false }, t.openOk, false)}>
            {t.markOpen}
          </button>
        ) : (
          <button type="button" class="button button-primary" disabled={busy} onClick={() => change({ handled: true }, t.handledOk, true)}>
            <Icon name="check" size={24} /> {t.markHandled}
          </button>
        )}
        <button type="button" class="button button-secondary" disabled={busy} onClick={() => change({ is_read: false }, t.unreadOk, true)}>
          {t.markUnread}
        </button>
      </div>

      {to && <ReplyComposer supabase={supabase} toEmail={to} subject={subject} threadId={current.gmail_thread_id} />}

      <p>
        <a href={gmail} target="_blank" rel="noopener noreferrer">{t.replyGmail}</a> <span class="caption">{t.replyNote}</span>
      </p>
    </div>
  );
}
