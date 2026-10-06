import { useEffect, useState } from 'preact/hooks';
import { copy } from '../content/copy';
import { isConfigured } from '../lib/config';
import { callRpc, restGet } from '../lib/publicApi';
import { renderMarkdown } from '../lib/markdown';
import { settingVideoId } from '../lib/studio';
import type { VideoSegment } from '../lib/lessons';
import { PlaylistPlayer } from './video/PlaylistPlayer';
import ReadAloud from './reading/ReadAloud';

interface Ticket {
  status: 'new' | 'in_progress' | 'answered' | 'closed';
  requester_name: string;
  question: string;
  answer_md: string | null;
  answer_video_youtube_id: string | null;
  answered_at: string | null;
  created_at: string;
}

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'off' } | { kind: 'ready'; ticket: Ticket };

const t = copy.answer;

// The owner's standard opener and closer (public settings) play around a video answer, when they are set.
async function answerSegments(mainId: string): Promise<VideoSegment[]> {
  const main = { youtube_id: mainId, label: t.videoMain };
  try {
    const rows = await restGet<{ key: string; value: unknown }[]>('settings?select=key,value&key=in.(opener_video,closer_video)');
    const find = (key: string) => settingVideoId(rows.find((r) => r.key === key)?.value);
    const opener = find('opener_video');
    const closer = find('closer_video');
    return [
      ...(opener ? [{ youtube_id: opener, label: t.videoOpener }] : []),
      main,
      ...(closer ? [{ youtube_id: closer, label: t.videoCloser }] : []),
    ];
  } catch {
    return [main];
  }
}

// The private answer page. It looks up one ticket by the token in the link, and nothing else.
export default function AnswerView() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [segments, setSegments] = useState<VideoSegment[]>([]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t') ?? '';
    if (!isConfigured) return setState({ kind: 'off' });
    if (!/^[0-9a-f]{64,128}$/.test(token)) return setState({ kind: 'missing' });
    callRpc<Ticket[]>('get_ticket', { p_token: token })
      .then(async (rows) => {
        const videoId = rows[0]?.answered_at ? rows[0].answer_video_youtube_id : null;
        if (videoId) setSegments(await answerSegments(videoId));
        setState(rows.length ? { kind: 'ready', ticket: rows[0] } : { kind: 'missing' });
      })
      .catch(() => setState({ kind: 'error' }));
  }, []);

  if (state.kind === 'loading') return <p role="status">{t.loading}</p>;
  if (state.kind === 'off') return <p role="status">{t.notConfigured}</p>;
  if (state.kind === 'error') return <p role="alert">{t.errorText}</p>;
  if (state.kind === 'missing') {
    return (
      <div>
        <h2>{t.notFoundTitle}</h2>
        <p class="lead">{t.notFoundText}</p>
        <div class="actions">
          <a class="button button-primary" href="/ask">
            {t.askAgain}
          </a>
        </div>
      </div>
    );
  }

  const { ticket } = state;
  const answered = ticket.answered_at !== null && Boolean(ticket.answer_md || ticket.answer_video_youtube_id);
  const asked = new Date(ticket.created_at).toLocaleDateString(undefined, { dateStyle: 'long' });

  return (
    <div>
      <p class="lead">{t.greeting(ticket.requester_name)}</p>
      <p>
        <span class="caption">{t.statusLabel}: </span>
        <span class="status-pill">{t.status[ticket.status]}</span>
      </p>

      <h2>{t.questionHeading}</h2>
      <p class="caption">{asked}</p>
      <p style="white-space: pre-wrap;">{ticket.question}</p>

      {answered ? (
        <section aria-labelledby="answer-title">
          <h2 id="answer-title">{t.answerHeading}</h2>
          {ticket.answer_md && <ReadAloud target="#answer-body" />}
          {ticket.answer_md && <div id="answer-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(ticket.answer_md) }} />}
          {segments.length > 0 && (
            <div>
              <h3>{t.videoTitle}</h3>
              <PlaylistPlayer segments={segments} title={t.videoTitle} />
            </div>
          )}
        </section>
      ) : (
        <p class="form-done">{t.waiting}</p>
      )}
    </div>
  );
}
