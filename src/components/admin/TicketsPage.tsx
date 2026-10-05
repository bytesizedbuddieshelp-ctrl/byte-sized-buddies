import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { ConfirmDialog } from './ConfirmDialog';
import { Notices } from './Notices';
import { Icon } from '../forms/Icon';
import { adminCopy as a, formatWhen } from '../../content/adminCopy';
import { renderMarkdown } from '../../lib/markdown';
import { parseYouTubeId } from '../../lib/youtube';

type Status = 'new' | 'in_progress' | 'answered' | 'closed';
const statuses: Status[] = ['new', 'in_progress', 'answered', 'closed'];

interface Row {
  id: string;
  created_at: string;
  status: Status;
  requester_name: string;
  facility: string | null;
  urgency: keyof typeof a.words.urgency;
  device: string | null;
  question: string;
}

interface Ticket extends Row {
  token: string;
  requester_email: string | null;
  internal_notes: string | null;
  answer_md: string | null;
  answer_video_youtube_id: string | null;
  answered_at: string | null;
}

const t = a.tickets;
const listColumns = 'id, created_at, status, requester_name, facility, urgency, device, question';

export default function TicketsPage() {
  return (
    <AdminShell current="tickets" title={t.title}>
      {(supabase) => <Tickets supabase={supabase} />}
    </AdminShell>
  );
}

function siteBase(): string {
  return (import.meta.env.PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '');
}

function Tickets({ supabase }: { supabase: SupabaseClient }) {
  const [filter, setFilter] = useState<Status>('new');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  function say(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function loadList(which: Status = filter) {
    setLoadFailed(false);
    const [list, all] = await Promise.all([
      supabase.from('tickets').select(listColumns).eq('status', which).order('created_at', { ascending: false }).limit(100),
      supabase.from('tickets').select('status').limit(1000),
    ]);
    if (list.error || all.error) return setLoadFailed(true);
    setRows(list.data as Row[]);
    const tally: Record<string, number> = {};
    for (const row of all.data ?? []) tally[row.status] = (tally[row.status] ?? 0) + 1;
    setCounts(tally);
  }

  useEffect(() => {
    loadList().catch(() => setLoadFailed(true));
  }, [filter]);

  if (openId) {
    return (
      <TicketDetail
        supabase={supabase}
        id={openId}
        siteBase={siteBase()}
        onBack={(note) => {
          setOpenId(null);
          if (note) say(note);
          loadList().catch(() => setLoadFailed(true));
        }}
      />
    );
  }

  return (
    <div>
      <Notices ok={isError ? '' : message} problem={isError ? message : ''} />
      <fieldset class="chips">
        <legend>{t.filterLabel}</legend>
        {statuses.map((s) => (
          <button key={s} type="button" class="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {a.words.ticketStatus[s]} ({counts[s] ?? 0})
          </button>
        ))}
      </fieldset>
      {loadFailed ? (
        <p class="admin-message is-error" role="alert">
          {t.loadError}
        </p>
      ) : rows === null ? (
        <p role="status">{t.loading}</p>
      ) : rows.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul class="admin-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" class="admin-row" onClick={() => setOpenId(row.id)}>
                <strong>{row.requester_name}</strong>
                <span class="meta">
                  {row.facility || a.words.noFacility} · {a.words.urgency[row.urgency]} ·{' '}
                  {a.words.device[row.device ?? 'not_sure']} · {formatWhen(row.created_at)}
                </span>
                <span class="snippet">{row.question.length > 140 ? `${row.question.slice(0, 140)}…` : row.question}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketDetail({
  supabase,
  id,
  siteBase,
  onBack,
}: {
  supabase: SupabaseClient;
  id: string;
  siteBase: string;
  onBack: (note?: string) => void;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [failed, setFailed] = useState(false);
  const [notes, setNotes] = useState('');
  const [answer, setAnswer] = useState('');
  const [video, setVideo] = useState('');
  const [videoError, setVideoError] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [confirm, setConfirm] = useState<'send' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  function say(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('tickets').select('*').eq('id', id).single();
      if (error || !data) return setFailed(true);
      const row = data as Ticket;
      setTicket(row);
      setNotes(row.internal_notes ?? '');
      setAnswer(row.answer_md ?? '');
      setVideo(row.answer_video_youtube_id ?? '');
    })().catch(() => setFailed(true));
  }, [id]);

  const preview = useMemo(() => renderMarkdown(answer), [answer]);

  if (failed) {
    return (
      <div>
        <p class="admin-message is-error" role="alert">{t.loadError}</p>
        <button type="button" class="button button-secondary" onClick={() => onBack()}>{t.back}</button>
      </div>
    );
  }
  if (!ticket) return <p role="status">{t.loading}</p>;

  const link = `${siteBase}/answer?t=${ticket.token}`;
  const isAnswered = ticket.answered_at !== null;

  // Reads the video box. An empty box means "no video". A box we can't read is a problem the owner should fix.
  function readVideo(): { ok: boolean; id: string | null } {
    const trimmed = video.trim();
    if (!trimmed) {
      setVideoError('');
      return { ok: true, id: null };
    }
    const parsed = parseYouTubeId(trimmed);
    setVideoError(parsed ? '' : t.videoBad);
    return { ok: parsed !== null, id: parsed };
  }

  async function update(changes: Record<string, unknown>): Promise<boolean> {
    const { error } = await supabase.from('tickets').update(changes).eq('id', ticket!.id);
    if (error) {
      say(t.saveError, true);
      return false;
    }
    setTicket({ ...ticket!, ...changes } as Ticket);
    return true;
  }

  async function saveNotes() {
    setBusy(true);
    if (await update({ internal_notes: notes })) say(t.notesSaved);
    setBusy(false);
  }

  async function saveDraft() {
    const v = readVideo();
    if (!v.ok) return;
    setBusy(true);
    if (await update({ answer_md: answer || null, answer_video_youtube_id: v.id })) {
      say(isAnswered ? t.notesSaved : t.draftSaved);
    }
    setBusy(false);
  }

  function askToSend() {
    const v = readVideo();
    if (!v.ok) return;
    if (!answer.trim() && !v.id) return say(t.needAnswer, true);
    setConfirm('send');
  }

  async function sendAnswer() {
    setConfirm(null);
    const v = readVideo();
    if (!v.ok) return;
    setBusy(true);
    const saved = await update({
      status: 'answered',
      answered_at: new Date().toISOString(),
      answer_md: answer || null,
      answer_video_youtube_id: v.id,
    });
    if (saved) {
      if (ticket!.requester_email) {
        const { error } = await supabase.from('outbox').insert({
          kind: 'ticket_answered',
          to_email: ticket!.requester_email,
          subject: 'Your answer is ready',
          body_text: `Hello ${ticket!.requester_name},\n\nYour answer is ready at the link below. If it doesn't help, reply to this email and we'll try again.\n\n${link}\n\nByte-Sized Buddies\nLearn it. Try it. Keep it.`,
        });
        say(error ? t.answerSentEmailFailed : `${t.answerSent} ${t.emailQueued}`, Boolean(error));
      } else {
        say(`${t.answerSent} ${t.noEmail}`);
      }
    }
    setBusy(false);
  }

  async function changeStatus(next: Status) {
    setBusy(true);
    if (await update({ status: next })) say(t.statusChanged(a.words.ticketStatus[next].toLowerCase()));
    setBusy(false);
  }

  async function deleteTicket() {
    setConfirm(null);
    setBusy(true);
    const { error } = await supabase.from('tickets').delete().eq('id', ticket!.id);
    setBusy(false);
    if (error) return say(t.saveError, true);
    onBack(t.deleted);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      say(t.copied);
    } catch {
      say(link);
    }
  }

  return (
    <div>
      <button type="button" class="button button-secondary" onClick={() => onBack()}>
        <Icon name="arrow-left" size={24} /> {t.back}
      </button>
      <h2>{ticket.requester_name}</h2>
      <Notices ok={isError ? '' : message} problem={isError ? message : ''} />

      <dl class="detail-grid">
        <dt>{t.facility}</dt>
        <dd>{ticket.facility || a.words.none}</dd>
        <dt>{t.email}</dt>
        <dd>{ticket.requester_email || a.words.none}</dd>
        <dt>{t.device}</dt>
        <dd>{a.words.device[ticket.device ?? 'not_sure']}</dd>
        <dt>{t.urgency}</dt>
        <dd>{a.words.urgency[ticket.urgency]}</dd>
        <dt>{t.asked}</dt>
        <dd>{formatWhen(ticket.created_at)}</dd>
        <dt>Status</dt>
        <dd>
          <span class="status-pill">{a.words.ticketStatus[ticket.status]}</span>
        </dd>
      </dl>

      <section class="admin-box" aria-labelledby="q-title">
        <h2 id="q-title">{t.question}</h2>
        <p style="white-space: pre-wrap;">{ticket.question}</p>
      </section>

      <section class="admin-box" aria-labelledby="link-title">
        <h2 id="link-title">{t.privateLink}</h2>
        <p class="caption">{t.privateLinkHelp}</p>
        <input class="field-control" type="text" readOnly value={link} aria-labelledby="link-title" onFocus={(e) => e.currentTarget.select()} />
        <div class="actions">
          <button type="button" class="button button-secondary" onClick={copyLink}>
            <Icon name="copy" size={24} /> {t.copy}
          </button>
          <a class="button button-secondary" href={link} target="_blank" rel="noopener noreferrer">
            {t.openAsPerson}
          </a>
        </div>
      </section>

      <section class="admin-box" aria-labelledby="notes-title">
        <h2 id="notes-title">{t.notes}</h2>
        <div class="field">
          <label class="field-label" for="notes">{t.notes}</label>
          <p class="field-helper">{t.notesHelp}</p>
          <textarea id="notes" class="field-control" rows={4} value={notes} onInput={(e) => setNotes(e.currentTarget.value)} />
        </div>
        <button type="button" class="button button-secondary" disabled={busy} onClick={saveNotes}>{t.saveNotes}</button>
      </section>

      <section class="admin-box" aria-labelledby="answer-title">
        <h2 id="answer-title">{t.answerHeading}</h2>
        {isAnswered && <p class="admin-message">{t.answeredWarning}</p>}
        <div class="field">
          <label class="field-label" for="answer">{t.answerLabel}</label>
          <p class="field-helper">{t.answerHelp}</p>
          <textarea id="answer" class="field-control" rows={9} value={answer} onInput={(e) => setAnswer(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label class="field-label" for="video">{t.videoLabel}</label>
          <p class="field-helper" id="video-help">{t.videoHelp}</p>
          <input
            id="video"
            class="field-control"
            type="text"
            value={video}
            aria-describedby={videoError ? 'video-help video-error' : 'video-help'}
            aria-invalid={videoError ? 'true' : undefined}
            onInput={(e) => setVideo(e.currentTarget.value)}
          />
          {videoError && (
            <p id="video-error" class="field-error">
              <Icon name="alert" size={24} />
              <span>{videoError}</span>
            </p>
          )}
        </div>
        <h3>{t.previewHeading}</h3>
        <div class="preview" aria-live="off">
          {answer.trim() ? <div dangerouslySetInnerHTML={{ __html: preview }} /> : <p class="caption">{t.previewEmpty}</p>}
        </div>
        <div class="button-row">
          <button type="button" class="button button-secondary" disabled={busy} onClick={saveDraft}>{t.saveDraft}</button>
          <button type="button" class="button button-primary" disabled={busy} onClick={askToSend}>{t.sendAnswer}</button>
        </div>
      </section>

      <section class="admin-box" aria-labelledby="actions-title">
        <h2 id="actions-title">{t.actionsHeading}</h2>
        <div class="button-row">
          {ticket.status !== 'in_progress' && ticket.status !== 'closed' && (
            <button type="button" class="button button-secondary" disabled={busy} onClick={() => changeStatus('in_progress')}>{t.markInProgress}</button>
          )}
          {ticket.status !== 'closed' && (
            <button type="button" class="button button-secondary" disabled={busy} onClick={() => changeStatus('closed')}>{t.close}</button>
          )}
          {(ticket.status === 'closed' || ticket.status === 'answered') && (
            <button type="button" class="button button-secondary" disabled={busy} onClick={() => changeStatus('in_progress')}>{t.reopen}</button>
          )}
          <button type="button" class="button button-danger" disabled={busy} onClick={() => setConfirm('delete')}>{t.delete}</button>
        </div>
      </section>

      <ConfirmDialog
        open={confirm === 'send'}
        title={t.confirmSendTitle}
        confirmLabel={t.sendAnswer}
        cancelLabel={t.confirmCancel}
        onConfirm={sendAnswer}
        onCancel={() => setConfirm(null)}
      >
        <p>{t.confirmSendText}</p>
        {ticket.requester_email && <p>{t.confirmSendEmail}</p>}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        danger
        title={t.confirmDeleteTitle}
        confirmLabel={t.delete}
        cancelLabel={t.confirmCancel}
        onConfirm={deleteTicket}
        onCancel={() => setConfirm(null)}
      >
        <p>{t.confirmDeleteText}</p>
      </ConfirmDialog>
    </div>
  );
}
