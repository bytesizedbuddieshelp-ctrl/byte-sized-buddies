import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { Icon } from '../forms/Icon';
import { PrintSlides, printSlides } from '../slides/SlideViewer';
import { SlideCanvas, SlideFrame } from '../slides/SlideCanvas';
import { Stage } from '../slides/Stage';
import { adminCopy as a } from '../../content/adminCopy';
import { imageUrlFor, sortByWeek, type Lesson } from '../../lib/lessons';
import { validateDeck, type Slide } from '../../lib/slides';
import {
  EVENTS,
  clockMood,
  countdownLeft,
  formatClock,
  localChannelFor,
  makeRemoteCode,
  parseCommand,
  type AudienceInit,
  type Command,
  type LocalMessage,
  type RemoteState,
} from '../../lib/remote';
import { linkWords, openRemote, type LinkStatus, type RemoteLink } from '../../lib/remoteChannel';

const t = a.present;

// A countdown that works from the real clock. It remembers when it started, so slow or late ticks never make it drift.
// The functions never change, so messages that arrive later can use them safely.
function useCountdown(initial: number) {
  const [s, setS] = useState<{ base: number; startedAt: number | null }>({ base: initial, startedAt: null });
  const [now, setNow] = useState(() => Date.now());
  const latest = useRef(s);
  latest.current = s;
  useEffect(() => {
    if (s.startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [s.startedAt]);
  const api = useRef({
    start() {
      const c = latest.current;
      if (c.startedAt !== null) return;
      const at = Date.now();
      setNow(at);
      setS({ base: c.base, startedAt: at });
    },
    pause() {
      const c = latest.current;
      if (c.startedAt === null) return;
      setS({ base: countdownLeft(c.base, c.startedAt, Date.now()), startedAt: null });
    },
    reset(base: number) {
      setS({ base, startedAt: null });
    },
  }).current;
  return { remaining: countdownLeft(s.base, s.startedAt, now), running: s.startedAt !== null, base: s.base, startedAt: s.startedAt, ...api };
}

export default function PresentPage() {
  return (
    <AdminShell current="present" title={t.title} bare>
      {(supabase) => <Present supabase={supabase} />}
    </AdminShell>
  );
}

function Present({ supabase }: { supabase: SupabaseClient }) {
  const slug = new URLSearchParams(window.location.search).get('slug');
  return slug ? <Loader supabase={supabase} slug={slug} /> : <Picker supabase={supabase} />;
}

// ---- Choose a lesson
function Picker({ supabase }: { supabase: SupabaseClient }) {
  const [lessons, setLessons] = useState<Pick<Lesson, 'id' | 'slug' | 'title' | 'week_number' | 'status' | 'slides'>[] | null>(null);
  useEffect(() => {
    supabase
      .from('lessons')
      .select('id, slug, title, week_number, status, slides')
      .then(({ data }) => setLessons(sortByWeek((data ?? []) as never[]).filter((l: { slides?: { slides?: unknown[] } }) => (l.slides?.slides?.length ?? 0) > 0)));
  }, []);
  return (
    <div>
      <a class="button button-secondary" href="/admin/lessons">
        <Icon name="arrow-left" size={24} /> {t.back}
      </a>
      <p class="lead" style="margin-top: 16px;">{t.pickIntro}</p>
      {lessons === null ? (
        <p role="status">{t.loading}</p>
      ) : lessons.length === 0 ? (
        <p>{t.pickEmpty}</p>
      ) : (
        <ul class="admin-list">
          {lessons.map((lesson) => (
            <li key={lesson.id} class="admin-box" style="margin-bottom: 16px;">
              <p style="margin-bottom: 8px;">
                <span class="badge badge-sunshine">{lesson.week_number === null ? 'No week' : `Week ${lesson.week_number}`}</span>{' '}
                <span class="status-pill">{lesson.status === 'published' ? a.lessons.published : a.lessons.draft}</span>
              </p>
              <h2 style="margin: 0 0 12px;">{lesson.title}</h2>
              <a class="button button-primary" href={`/admin/present?slug=${encodeURIComponent(lesson.slug)}`}>
                <Icon name="play" size={24} /> {t.pickButton}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Load one lesson
function Loader({ supabase, slug }: { supabase: SupabaseClient; slug: string }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'empty' | 'ready'>('loading');
  useEffect(() => {
    supabase
      .from('lessons')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setState('missing');
        const row = data as Lesson;
        const deck = validateDeck(row.slides).deck;
        if (!deck || deck.slides.length === 0) {
          setLesson(row);
          return setState('empty');
        }
        setLesson({ ...row, slides: deck });
        setState('ready');
      });
  }, [slug]);

  if (state === 'loading') return <p role="status">{t.loading}</p>;
  if (state === 'missing' || !lesson) return <p class="admin-message is-error" role="alert">{t.notFound}</p>;
  if (state === 'empty') {
    return (
      <div>
        <p class="admin-message" role="status">{t.noSlides}</p>
        <a class="button button-secondary" href={`/admin/lesson-edit?slug=${encodeURIComponent(lesson.slug)}`}>{a.lessons.edit}</a>
      </div>
    );
  }
  return <Controls supabase={supabase} lesson={lesson} />;
}

// ---- The presenter's control window
function Controls({ supabase, lesson }: { supabase: SupabaseClient; lesson: Lesson }) {
  const slides: Slide[] = lesson.slides.slides;
  const total = slides.length;
  const code = useMemo(() => makeRemoteCode(), []);
  const clockTotal = Math.max(1, lesson.duration_minutes) * 60;

  const [index, setIndex] = useState(0);
  const [blank, setBlank] = useState(false);
  const [single, setSingle] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [link, setLink] = useState<LinkStatus>('connecting');
  const [full, setFull] = useState(false);
  const [announce, setAnnounce] = useState('');

  const slide = slides[index];
  const upNext = slides[index + 1] ?? null;
  const tryMinutes = slide.layout === 'tryit' ? slide.timer_minutes : undefined;
  const clockCd = useCountdown(clockTotal);
  const tryCd = useCountdown(0);
  const remaining = clockCd.remaining;
  const running = clockCd.running;
  const tryRemaining: number | null = tryMinutes ? Math.max(0, tryCd.remaining) : null;
  const tryRunning = tryCd.running && tryRemaining !== null && tryRemaining > 0;
  const tryText = tryRemaining === null ? null : formatClock(tryRemaining);

  const images = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of slides) if (s.image) map[s.image.file] = imageUrlFor(lesson, s.image.file);
    return map;
  }, [lesson]);
  const imageUrl = (file: string) => images[file] ?? '';

  // The newest values, for messages that arrive later (a phone press, a key in the audience window).
  const tryBase = tryMinutes ? tryCd.base : null;
  const live = useRef({ index, blank, remaining, running, tryBase, tryStartedAt: tryCd.startedAt, tryRemaining, tryRunning, tryMinutes });
  live.current = { index, blank, remaining, running, tryBase, tryStartedAt: tryCd.startedAt, tryRemaining, tryRunning, tryMinutes };
  const bc = useRef<BroadcastChannel | null>(null);
  const remote = useRef<RemoteLink | null>(null);
  const audienceWindow = useRef<Window | null>(null);

  // ---- Commands from the keyboard, the audience window, or the phone all end up here
  function apply(command: Command | { t: 'first' } | { t: 'last' }) {
    switch (command.t) {
      case 'next': setIndex((i) => Math.min(i + 1, total - 1)); setBlank(false); break;
      case 'prev': setIndex((i) => Math.max(i - 1, 0)); setBlank(false); break;
      case 'first': setIndex(0); setBlank(false); break;
      case 'last': setIndex(total - 1); setBlank(false); break;
      case 'goto': setIndex(Math.min(Math.max(command.n, 0), total - 1)); setBlank(false); break;
      case 'blank': setBlank((b) => !b); break;
      case 'timer': if (command.run) clockCd.start(); else clockCd.pause(); break;
      case 'trytimer': if (command.run) tryCd.start(); else tryCd.pause(); break;
    }
  }

  function stateForPhone(): RemoteState {
    const now = live.current;
    const current = slides[now.index];
    return {
      index: now.index,
      total,
      title: current.title,
      next: slides[now.index + 1]?.title ?? null,
      notes: current.notes ?? '',
      blank: now.blank,
      clock: { total: clockTotal, remaining: now.remaining, running: now.running },
      tryTimer: now.tryMinutes && now.tryRemaining !== null ? { minutes: now.tryMinutes, remaining: now.tryRemaining, running: now.tryRunning } : null,
    };
  }
  const sendStateToPhone = () => remote.current?.send(EVENTS.state, stateForPhone() as unknown as Record<string, unknown>);

  // ---- Talk to the audience window (same computer) and to the phone (over the internet)
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(localChannelFor(code));
      bc.current = channel;
      channel.onmessage = (event: MessageEvent<LocalMessage>) => {
        const message = event.data;
        if (!message || typeof message !== 'object') return;
        if (message.type === 'hello') {
          const init: AudienceInit = { type: 'init', slides, lessonName: lesson.title, images, index: live.current.index, blank: live.current.blank, tryBase: live.current.tryBase, tryStartedAt: live.current.tryStartedAt };
          channel.postMessage(init);
        } else if (message.type === 'cmd') apply({ t: message.t } as Command);
      };
    }
    const remoteLink = openRemote(
      supabase,
      code,
      (event, payload) => {
        if (event === EVENTS.hello) return sendStateToPhone();
        const command = parseCommand(event, payload, total);
        if (command) apply(command);
      },
      setLink,
    );
    remote.current = remoteLink;
    const heartbeat = window.setInterval(sendStateToPhone, 5000);
    const goodbye = () => {
      bc.current?.postMessage({ type: 'bye' } satisfies LocalMessage);
      remote.current?.send(EVENTS.bye);
    };
    window.addEventListener('beforeunload', goodbye);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('beforeunload', goodbye);
      goodbye();
      remoteLink.close();
      bc.current?.close();
    };
  }, []);

  // Tell the audience window and the phone whenever something they show changes
  useEffect(() => {
    bc.current?.postMessage({ type: 'update', index, blank, tryBase, tryStartedAt: tryCd.startedAt } satisfies LocalMessage);
  }, [index, blank, tryBase, tryCd.startedAt]);
  useEffect(() => {
    sendStateToPhone();
  }, [index, blank, running, link, tryRunning, tryMinutes]);

  // ---- Clocks (see useCountdown: they follow the real clock, so they cannot drift)
  useEffect(() => {
    if (remaining === 300 && running) setAnnounce(t.clockWarn);
    if (remaining === 0 && running) setAnnounce(t.clockOver);
  }, [remaining]);

  // A new slide starts with a fresh, stopped practice timer
  useEffect(() => {
    tryCd.reset(tryMinutes ? tryMinutes * 60 : 0);
    setAnnounce(a.present.slideCounter(index + 1, total) + ': ' + slide.title);
  }, [index, tryMinutes]);
  // The practice timer stops by itself at zero
  useEffect(() => {
    if (tryCd.running && tryCd.remaining <= 0) tryCd.pause();
  }, [tryCd.remaining, tryCd.running]);

  // ---- Windows
  useEffect(() => {
    const id = window.setInterval(() => setAudienceOpen(Boolean(audienceWindow.current && !audienceWindow.current.closed)), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  // Save the pictures in this browser now, so the slides still work if the Wi-Fi drops
  useEffect(() => {
    Object.values(images).forEach((src) => {
      const picture = new Image();
      picture.src = src;
    });
  }, [images]);

  function openAudience() {
    if (audienceWindow.current && !audienceWindow.current.closed) {
      audienceWindow.current.focus();
      return;
    }
    const opened = window.open(`/admin/present-screen#${code}`, 'bsb-audience', 'popup,width=1280,height=720');
    audienceWindow.current = opened;
    setPopupBlocked(!opened);
    setAudienceOpen(Boolean(opened));
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  function enterSingle() {
    setSingle(true);
    void document.documentElement.requestFullscreen?.();
  }
  function leaveSingle() {
    setSingle(false);
    if (document.fullscreenElement) void document.exitFullscreen();
  }

  // ---- Keyboard (not while typing in a field, and Space still presses a focused button)
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      const onControl = Boolean(target.closest('button, a'));
      switch (event.key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': apply({ t: 'next' }); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': apply({ t: 'prev' }); break;
        case ' ': if (onControl) return; apply({ t: 'next' }); break;
        case 'Home': apply({ t: 'first' }); break;
        case 'End': apply({ t: 'last' }); break;
        case 'b': case 'B': apply({ t: 'blank' }); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'Escape': if (single) { leaveSingle(); break; } return;
        default: return;
      }
      event.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [single, total]);

  const mood = clockMood(remaining);

  if (single) {
    return (
      <Stage slide={slide} lessonName={lesson.title} imageUrl={imageUrl} blank={blank} tryText={tryText}>
        <button type="button" class="button button-secondary stage-exit" onClick={leaveSingle}>
          {t.singleBack}
        </button>
      </Stage>
    );
  }

  return (
    <div>
      <div class="screen-only present">
        <div class="present-top">
          <a class="button button-secondary" href="/admin/lessons">
            <Icon name="arrow-left" size={24} /> {t.back}
          </a>
          <h2>{lesson.title}</h2>
        </div>

        <div class="button-row" role="group" aria-label={t.controlsLabel}>
          <button type="button" class="button button-primary" onClick={openAudience}>
            <Icon name="play" size={24} /> {audienceOpen ? t.focusAudience : t.openAudience}
          </button>
          <button type="button" class="button button-secondary" onClick={() => apply({ t: 'blank' })}>
            {blank ? t.unblank : t.blank}
          </button>
          <button type="button" class="button button-secondary" onClick={toggleFullscreen}>
            {full ? t.exitFullscreen : t.fullscreen}
          </button>
          <button type="button" class="button button-secondary" onClick={enterSingle}>
            {t.single}
          </button>
          <button type="button" class="button button-secondary" onClick={() => void printSlides()}>
            <Icon name="download" size={24} /> {t.print}
          </button>
        </div>
        <p class="caption">
          {audienceOpen ? t.audienceOpen : t.audienceClosed}. {t.audienceHelp}
        </p>
        {popupBlocked && <p class="admin-message is-error" role="alert">{t.audienceBlocked}</p>}
        {blank && <p class="admin-message" role="status">{t.blankOn}</p>}

        <div class="present-grid">
          <section aria-labelledby="now-title">
            <h3 id="now-title">
              {t.current}: {t.slideCounter(index + 1, total)}
            </h3>
            <SlideFrame>
              <SlideCanvas slide={slide} lessonName={lesson.title} imageUrl={imageUrl} timerText={tryText ?? undefined} />
            </SlideFrame>
            <div class="button-row" style="margin-top: 16px;">
              <button type="button" class="button button-secondary" disabled={index === 0} onClick={() => apply({ t: 'prev' })}>
                <Icon name="arrow-left" size={24} /> {t.prev}
              </button>
              <button type="button" class="button button-primary" disabled={index === total - 1} onClick={() => apply({ t: 'next' })}>
                {t.next} <Icon name="arrow-right" size={24} />
              </button>
              {tryMinutes && tryRemaining !== null && (
                <button type="button" class="button button-secondary" disabled={tryRemaining <= 0} onClick={() => (tryRunning ? tryCd.pause() : tryCd.start())}>
                  {tryRunning ? t.tryTimerPause : t.tryTimerStart(tryMinutes)}
                </button>
              )}
            </div>
            <section class="present-notes-box" aria-labelledby="notes-title">
              <h3 id="notes-title">{t.notes}</h3>
              <p class="present-notes">{slide.notes || t.noNotes}</p>
            </section>
          </section>

          <aside>
            <section aria-labelledby="next-title" class="admin-box">
              <h3 id="next-title">{t.upNext}</h3>
              {upNext ? (
                <SlideFrame>
                  <SlideCanvas slide={upNext} lessonName={lesson.title} imageUrl={imageUrl} />
                </SlideFrame>
              ) : (
                <p>{t.endOfLesson}</p>
              )}
            </section>

            <section aria-labelledby="clock-title" class="admin-box">
              <h3 id="clock-title">{t.clockHeading}</h3>
              <p class={`present-clock mood-${mood}`} aria-label={`${t.clockHeading}: ${formatClock(remaining)}`}>
                {formatClock(remaining)}
              </p>
              {mood !== 'fine' ? (
                <p class={`present-mood mood-${mood}`} role="status">
                  <Icon name="alert" size={24} /> {mood === 'warning' ? t.clockWarn : t.clockOver}
                </p>
              ) : (
                <p class="caption">{t.clockFine}</p>
              )}
              <div class="button-row">
                <button type="button" class="button button-primary" onClick={() => (running ? clockCd.pause() : clockCd.start())}>
                  {running ? t.clockPause : t.clockStart}
                </button>
                <button type="button" class="button button-secondary" onClick={() => clockCd.reset(clockTotal)}>
                  {t.clockReset}
                </button>
              </div>
            </section>

            <section aria-labelledby="remote-title" class="admin-box">
              <h3 id="remote-title">{t.remoteHeading}</h3>
              <p class="label">{t.remoteCode}</p>
              <p class="remote-code">
                <span class="visually-hidden">{code.split('').join(', ')}</span>
                <span aria-hidden="true">{code}</span>
              </p>
              <p role="status">{linkWords[link]}</p>
              <p class="caption">{link === 'denied' ? t.remoteOffline : t.remoteHelp}</p>
            </section>
          </aside>
        </div>

        <section aria-labelledby="strip-title">
          <h3 id="strip-title">{t.strip}</h3>
          <ol class="strip clean-list">
            {slides.map((s, i) => (
              <li key={i}>
                <button type="button" class="strip-item" aria-current={i === index ? 'true' : undefined} aria-label={t.stripItem(i + 1, s.title)} onClick={() => apply({ t: 'goto', n: i })}>
                  <span aria-hidden="true" class="strip-thumb">
                    <SlideFrame>
                      <SlideCanvas slide={s} lessonName={lesson.title} imageUrl={imageUrl} />
                    </SlideFrame>
                  </span>
                  <span aria-hidden="true" class="strip-number">{i + 1}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <p class="caption">{t.keys}</p>
        <p class="caption">{t.printHelp} {t.imagesPreloaded}</p>
        <p class="visually-hidden" aria-live="polite">{announce}</p>
      </div>
      <PrintSlides slides={slides} lessonName={lesson.title} imageUrl={imageUrl} />
    </div>
  );
}
