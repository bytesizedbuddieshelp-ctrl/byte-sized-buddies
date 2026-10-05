import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConfirmDialog } from '../ConfirmDialog';
import { Notices } from '../Notices';
import { Icon } from '../../forms/Icon';
import { adminCopy as a, formatWhen } from '../../../content/adminCopy';
import type { VideoSegment } from '../../../lib/lessons';
import { PARTS, buildSegments, settingVideoId, type Part } from '../../../lib/studio';

const t = a.studio;

export interface StudioLesson {
  id: string;
  title: string;
  week_number: number | null;
  status: 'draft' | 'published';
  video_script_md: string | null;
  video_ids: VideoSegment[];
}

interface OpenTicket {
  id: string;
  requester_name: string;
  question: string;
}

interface SavedVideo {
  id: string;
  title: string;
  kind: string;
  segments: VideoSegment[];
  created_at: string;
}

type Target = 'lesson' | 'ticket' | 'none';
type Standard = 'opener' | 'closer';
type Problem = { id: string; message: string };

const labels: Record<Part, string> = { opener: t.partShort.opener, main: t.partShort.main, closer: t.partShort.closer };

// Step 4: the owner pastes the YouTube links, chooses where the video plays, and saves it.
export function PublishVideo({
  supabase,
  lessons,
  lessonId,
  title,
  script,
  onStandards,
}: {
  supabase: SupabaseClient;
  lessons: StudioLesson[];
  lessonId: string;
  title: string;
  script: string;
  onStandards: (value: Record<Standard, string | null>) => void;
}) {
  const [videoTitle, setVideoTitle] = useState('');
  const [target, setTarget] = useState<Target>('none');
  const [pickLesson, setPickLesson] = useState('');
  const [pickTicket, setPickTicket] = useState('');
  const [links, setLinks] = useState<Record<Part, string>>({ opener: '', main: '', closer: '' });
  const [makeStandard, setMakeStandard] = useState<Record<Standard, boolean>>({ opener: false, closer: false });
  const [standards, setStandards] = useState<Record<Standard, string | null>>({ opener: null, closer: null });
  const [tickets, setTickets] = useState<OpenTicket[]>([]);
  const [saved, setSaved] = useState<SavedVideo[] | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(0);
  const [deleting, setDeleting] = useState<SavedVideo | null>(null);

  // Follow the lesson chosen in step 1.
  useEffect(() => {
    setVideoTitle(title);
    setPickLesson(lessonId);
    setTarget(lessonId ? 'lesson' : 'none');
  }, [lessonId, title]);

  async function loadStandards() {
    const { data } = await supabase.from('settings').select('key, value').in('key', ['opener_video', 'closer_video']);
    const find = (key: string) => settingVideoId(data?.find((r) => r.key === key)?.value);
    const next = { opener: find('opener_video'), closer: find('closer_video') };
    setStandards(next);
    onStandards(next);
  }

  async function loadSaved() {
    const { data, error } = await supabase.from('videos').select('id, title, kind, segments, created_at').order('created_at', { ascending: false }).limit(50);
    setSaved(error ? [] : (data as SavedVideo[]));
  }

  useEffect(() => {
    loadStandards().catch(() => {});
    loadSaved().catch(() => setSaved([]));
    supabase
      .from('tickets')
      .select('id, requester_name, question')
      .in('status', ['new', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setTickets((data ?? []) as OpenTicket[]));
  }, []);

  function check(): { segments: VideoSegment[] } | null {
    const found: Problem[] = [];
    if (!videoTitle.trim()) found.push({ id: 'pub-title', message: t.titleMissing });
    if (target === 'lesson' && !pickLesson) found.push({ id: 'pub-lesson', message: t.lessonMissing });
    if (target === 'ticket' && !pickTicket) found.push({ id: 'pub-ticket', message: t.ticketMissing });
    const { segments, problems: linkProblems } = buildSegments(links, labels);
    for (const p of linkProblems) found.push({ id: `pub-${p.field}`, message: p.kind === 'missing' ? t.mainMissing : `${t.linkLabel[p.field]}: ${t.linkBad}` });
    setProblems(found);
    if (found.length) {
      window.setTimeout(() => document.getElementById('pub-problems')?.focus(), 0);
      return null;
    }
    return { segments };
  }

  function askToSave() {
    setOk('');
    setProblem('');
    if (!check()) return;
    const lesson = lessons.find((l) => l.id === pickLesson);
    const existing = target === 'lesson' ? lesson?.video_ids?.length ?? 0 : 0;
    if (existing > 0) return setConfirmReplace(existing);
    void save();
  }

  async function save() {
    setConfirmReplace(0);
    const result = check();
    if (!result) return;
    const { segments } = result;
    const main = segments.find((s) => s.label === labels.main)!;
    setBusy(true);
    try {
      const kind = target === 'lesson' ? 'lesson' : target === 'ticket' ? 'ticket_answer' : 'other';
      const insert = await supabase.from('videos').insert({
        title: videoTitle.trim().slice(0, 200),
        kind,
        lesson_id: target === 'lesson' ? pickLesson : null,
        ticket_id: target === 'ticket' ? pickTicket : null,
        segments,
        script_md: script.trim() || null,
      });
      if (insert.error) throw insert.error;

      let message: string = t.savedNone;
      if (target === 'lesson') {
        const { error } = await supabase.from('lessons').update({ video_ids: segments }).eq('id', pickLesson);
        if (error) throw error;
        const lesson = lessons.find((l) => l.id === pickLesson);
        if (lesson) lesson.video_ids = segments;
        message = lesson?.status === 'published' ? t.savedLesson : t.savedLessonDraft;
      } else if (target === 'ticket') {
        const { error } = await supabase.from('tickets').update({ answer_video_youtube_id: main.youtube_id }).eq('id', pickTicket);
        if (error) throw error;
        message = t.savedTicket;
      }

      const changes = (['opener', 'closer'] as Standard[]).filter((p) => makeStandard[p] && segments.some((s) => s.label === labels[p]));
      for (const p of changes) {
        const id = segments.find((s) => s.label === labels[p])!.youtube_id;
        const { error } = await supabase.from('settings').upsert({ key: `${p}_video`, value: id, is_public: true });
        if (error) throw error;
      }
      if (changes.length) {
        await loadStandards();
        message = `${message} ${t.standardUpdated}`;
      }

      setLinks({ opener: '', main: '', closer: '' });
      setMakeStandard({ opener: false, closer: false });
      setOk(message);
      await loadSaved();
    } catch {
      setProblem(t.saveError);
    }
    setBusy(false);
  }

  async function removeStandard(p: Standard) {
    setOk('');
    setProblem('');
    const { error } = await supabase.from('settings').upsert({ key: `${p}_video`, value: null, is_public: true });
    if (error) return setProblem(t.saveError);
    await loadStandards();
    setOk(t.standardUpdated);
  }

  async function removeSaved(video: SavedVideo) {
    setDeleting(null);
    const { error } = await supabase.from('videos').delete().eq('id', video.id);
    if (error) return setProblem(t.saveError);
    setOk(t.deletedVideo);
    await loadSaved();
  }

  const lessonTitle = (id: string) => lessons.find((l) => l.id === id)?.title ?? '';

  return (
    <section class="admin-box" aria-labelledby="publish-title">
      <h2 id="publish-title">{t.publishHeading}</h2>
      <ol>
        {t.publishSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Notices ok={ok} problem={problem} />
      {ok.startsWith(t.savedTicket) && (
        <p>
          <a class="button button-secondary" href="/admin/tickets">{t.openTickets}</a>
        </p>
      )}

      {problems.length > 0 && (
        <div id="pub-problems" class="admin-message is-error" role="alert" tabIndex={-1}>
          <p>
            <Icon name="alert" size={24} /> {t.fixFirst}
          </p>
          <ul class="problem-list">
            {problems.map((p) => (
              <li key={p.id}>
                <a href={`#${p.id}`}>{p.message}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div class="field">
        <label class="field-label" for="pub-title">{t.titleLabel}</label>
        <p class="field-helper" id="pub-title-help">{t.titleHelp}</p>
        <input id="pub-title" class="field-control" maxLength={200} aria-describedby="pub-title-help" value={videoTitle} onInput={(e) => setVideoTitle(e.currentTarget.value)} />
      </div>

      <fieldset class="choice-group">
        <legend>{t.attachLabel}</legend>
        {(['lesson', 'ticket', 'none'] as Target[]).map((value) => (
          <label class="choice" key={value}>
            <input type="radio" name="pub-target" value={value} checked={target === value} onChange={() => setTarget(value)} />
            <span>{t.attach[value]}</span>
          </label>
        ))}
      </fieldset>

      {target === 'lesson' && (
        <div class="field">
          <label class="field-label" for="pub-lesson">{t.lessonPick}</label>
          <select id="pub-lesson" class="field-control" value={pickLesson} onChange={(e) => setPickLesson(e.currentTarget.value)}>
            <option value="">{t.choose}</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.week_number ? `Week ${l.week_number}: ` : ''}
                {l.title}
              </option>
            ))}
          </select>
        </div>
      )}
      {target === 'ticket' &&
        (tickets.length === 0 ? (
          <p>{t.noTickets}</p>
        ) : (
          <div class="field">
            <label class="field-label" for="pub-ticket">{t.ticketPick}</label>
            <select id="pub-ticket" class="field-control" value={pickTicket} onChange={(e) => setPickTicket(e.currentTarget.value)}>
              <option value="">{t.choose}</option>
              {tickets.map((k) => (
                <option key={k.id} value={k.id}>{t.ticketOption(k.requester_name, k.question)}</option>
              ))}
            </select>
          </div>
        ))}

      {PARTS.map((p) => {
        const standard = p === 'main' ? null : standards[p];
        return (
          <div class="field" key={p}>
            <label class="field-label" for={`pub-${p}`}>{t.linkLabel[p]}</label>
            <p class="field-helper" id={`pub-${p}-help`}>{t.linkHelp}</p>
            <input
              id={`pub-${p}`}
              class="field-control"
              inputMode="url"
              autoComplete="off"
              aria-describedby={`pub-${p}-help`}
              value={links[p]}
              onInput={(e) => setLinks({ ...links, [p]: e.currentTarget.value })}
            />
            {p !== 'main' && (
              <div class="button-row studio-link-tools">
                {standard && (
                  <button type="button" class="button button-secondary" onClick={() => setLinks({ ...links, [p]: standard })}>
                    {t.useStandard(t.partShort[p].toLowerCase())}
                  </button>
                )}
                <label class="choice">
                  <input
                    type="checkbox"
                    checked={makeStandard[p as Standard]}
                    onChange={(e) => setMakeStandard({ ...makeStandard, [p]: e.currentTarget.checked })}
                  />
                  <span>{t.makeStandard(t.partShort[p].toLowerCase())}</span>
                </label>
              </div>
            )}
          </div>
        );
      })}

      <button type="button" class="button button-primary" disabled={busy} onClick={askToSave}>
        {busy ? t.saving : t.save}
      </button>

      <h3>{t.standardHeading}</h3>
      <p class="caption">{t.standardHelp}</p>
      <dl class="detail-grid">
        {(['opener', 'closer'] as Standard[]).map((p) => (
          <Fragment key={p}>
            <dt>{t.partShort[p]}</dt>
            <dd>
              {standards[p] ? (
                <>
                  <a href={`https://www.youtube.com/watch?v=${standards[p]}`} target="_blank" rel="noopener noreferrer">
                    {t.standardWatch}
                  </a>{' '}
                  <button type="button" class="button button-secondary" onClick={() => removeStandard(p)}>
                    {t.removeStandard(t.partShort[p].toLowerCase())}
                  </button>
                </>
              ) : (
                t.standardNone
              )}
            </dd>
          </Fragment>
        ))}
      </dl>

      <h3>{t.savedHeading}</h3>
      {saved === null ? (
        <p role="status">{t.savedLoading}</p>
      ) : saved.length === 0 ? (
        <p>{t.savedEmpty}</p>
      ) : (
        <ul class="reply-history">
          {saved.map((v) => (
            <li key={v.id}>
              <p class="reply-body">
                <strong>{v.title}</strong>
              </p>
              <p class="meta">
                <span class="status-pill">{t.kind[v.kind] ?? v.kind}</span> {t.savedRow(v.segments.length, formatWhen(v.created_at))}
              </p>
              <button type="button" class="button button-secondary" onClick={() => setDeleting(v)}>{t.deleteVideo}</button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmReplace > 0}
        title={t.confirmReplaceTitle}
        confirmLabel={t.replace}
        cancelLabel={t.cancel}
        onConfirm={() => void save()}
        onCancel={() => setConfirmReplace(0)}
      >
        <p>{t.confirmReplaceText(confirmReplace)}</p>
        <p>{lessonTitle(pickLesson)}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting !== null}
        danger
        title={t.confirmDeleteVideoTitle}
        confirmLabel={t.deleteVideo}
        cancelLabel={t.cancel}
        onConfirm={() => deleting && removeSaved(deleting)}
        onCancel={() => setDeleting(null)}
      >
        <p>{t.confirmDeleteVideoText}</p>
      </ConfirmDialog>
    </section>
  );
}
