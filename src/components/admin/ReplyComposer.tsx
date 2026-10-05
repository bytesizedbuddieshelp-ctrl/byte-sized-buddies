import { useEffect, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConfirmDialog } from './ConfirmDialog';
import { Notices } from './Notices';
import { Icon } from '../forms/Icon';
import { adminCopy as a, formatWhen } from '../../content/adminCopy';

const t = a.inbox.reply;
const SLOW_MINUTES = 15;

interface Sent {
  id: string;
  status: 'queued' | 'sent' | 'error';
  error: string | null;
  body_text: string;
  created_at: string;
  sent_at: string | null;
}

interface Props {
  supabase: SupabaseClient;
  toEmail: string;
  subject: string;
  /** Set for Gmail emails, so the reply joins the same conversation. Empty for senior-home requests. */
  threadId: string | null;
  /** Runs after a reply is queued. May return a message to show instead of the usual one. */
  onQueued?: () => Promise<string | void>;
}

// Writes a reply into the outbox. The Gmail bridge sends it from the owner's Gmail within about 5 minutes.
export function ReplyComposer({ supabase, toEmail, subject, threadId, onQueued }: Props) {
  const [body, setBody] = useState('');
  const [history, setHistory] = useState<Sent[] | null>(null);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadHistory() {
    let query = supabase
      .from('outbox')
      .select('id, status, error, body_text, created_at, sent_at')
      .eq('kind', 'reply')
      .order('created_at', { ascending: false })
      .limit(20);
    query = threadId ? query.eq('gmail_thread_id', threadId) : query.eq('to_email', toEmail).is('gmail_thread_id', null);
    const { data, error } = await query;
    setHistory(error ? [] : (data as Sent[]));
  }

  useEffect(() => {
    loadHistory().catch(() => setHistory([]));
  }, [threadId, toEmail]);

  function askToSend() {
    setOk('');
    setProblem('');
    if (!body.trim()) return setProblem(t.empty);
    if (body.length > 10000) return setProblem(t.tooLong);
    setConfirm(true);
  }

  async function send() {
    setConfirm(false);
    setBusy(true);
    const { error } = await supabase.from('outbox').insert({
      kind: 'reply',
      to_email: toEmail,
      subject,
      body_text: body,
      gmail_thread_id: threadId,
    });
    if (error) {
      setBusy(false);
      return setProblem(t.failed);
    }
    setBody('');
    const message = onQueued ? await onQueued() : undefined;
    setOk(message || t.queued);
    await loadHistory().catch(() => {});
    setBusy(false);
  }

  const slowAfter = Date.now() - SLOW_MINUTES * 60 * 1000;

  return (
    <section class="admin-box" aria-labelledby="reply-title">
      <h2 id="reply-title">{t.heading}</h2>
      <Notices ok={ok} problem={problem} />
      <div class="field">
        <label class="field-label" for="reply-body">{t.label}</label>
        <p class="field-helper" id="reply-help">{t.help}</p>
        <textarea
          id="reply-body"
          class="field-control"
          rows={8}
          aria-describedby="reply-help"
          value={body}
          onInput={(e) => setBody(e.currentTarget.value)}
        />
      </div>
      <button type="button" class="button button-primary" disabled={busy} onClick={askToSend}>{t.send}</button>

      {history && history.length > 0 && (
        <>
          <h3>{t.historyHeading}</h3>
          <ul class="reply-history">
            {history.map((r) => (
              <li key={r.id}>
                <p class="meta">
                  <span class={`status-pill${r.status === 'error' ? ' is-error' : ''}`}>{t.state[r.status]}</span>{' '}
                  {r.sent_at ? t.sentAt(formatWhen(r.sent_at)) : t.queuedAt(formatWhen(r.created_at))}
                </p>
                {r.status === 'error' && r.error && <p class="reply-reason"><Icon name="alert" size={24} /> {t.reason(r.error)}</p>}
                {r.status === 'queued' && new Date(r.created_at).getTime() < slowAfter && <p class="reply-reason"><Icon name="alert" size={24} /> {t.slow}</p>}
                <p class="reply-body">{r.body_text}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={confirm}
        title={t.confirmTitle}
        confirmLabel={t.send}
        cancelLabel={t.cancel}
        onConfirm={send}
        onCancel={() => setConfirm(false)}
      >
        <p>{t.confirmText(toEmail)}</p>
      </ConfirmDialog>
    </section>
  );
}
