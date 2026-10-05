import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { Icon } from '../forms/Icon';
import { adminCopy as a } from '../../content/adminCopy';
import { EVENTS, clockMood, clockNow, formatClock, normalizeCode, parseState, type RemoteState } from '../../lib/remote';
import { openRemote, type LinkStatus, type RemoteLink } from '../../lib/remoteChannel';

const t = a.remote;
const STALE_MS = 13_000; // the presenter sends a message every 5 seconds

export default function RemotePage() {
  return (
    <AdminShell current="remote" title={t.title} bare>
      {(supabase) => <Remote supabase={supabase} />}
    </AdminShell>
  );
}

function saved(): string | null {
  try {
    return window.sessionStorage.getItem('bsb-remote-code');
  } catch {
    return null;
  }
}
function remember(code: string | null) {
  try {
    if (code) window.sessionStorage.setItem('bsb-remote-code', code);
    else window.sessionStorage.removeItem('bsb-remote-code');
  } catch {
    /* private browsing: the code just is not remembered */
  }
}

function Remote({ supabase }: { supabase: SupabaseClient }) {
  const [code, setCode] = useState<string | null>(() => normalizeCode(saved() ?? ''));
  const [error, setError] = useState('');

  function onSubmit(event: JSX.TargetedEvent<HTMLFormElement, Event>) {
    event.preventDefault();
    const typed = String(new FormData(event.currentTarget).get('code') ?? '');
    const clean = normalizeCode(typed);
    if (!clean) return setError(t.badCode);
    setError('');
    remember(clean);
    setCode(clean);
  }

  if (!code) {
    return (
      <form onSubmit={onSubmit} noValidate>
        <p class="lead">{t.intro}</p>
        <div class="field">
          <label class="field-label" for="code">{t.codeLabel}</label>
          <p class="field-helper" id="code-help">{t.codeHelp}</p>
          <input
            id="code"
            name="code"
            class="field-control remote-input"
            type="text"
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellcheck={false}
            aria-describedby={error ? 'code-help code-error' : 'code-help'}
            aria-invalid={error ? 'true' : undefined}
          />
          {error && (
            <p id="code-error" class="field-error" role="alert">
              <Icon name="alert" size={24} />
              <span>{error}</span>
            </p>
          )}
        </div>
        <button type="submit" class="button button-primary">{t.connect}</button>
      </form>
    );
  }
  return (
    <Connected
      supabase={supabase}
      code={code}
      onLeave={() => {
        remember(null);
        setCode(null);
      }}
    />
  );
}

function Connected({ supabase, code, onLeave }: { supabase: SupabaseClient; code: string; onLeave: () => void }) {
  const [link, setLink] = useState<LinkStatus>('connecting');
  const [state, setState] = useState<RemoteState | null>(null);
  const [seenAt, setSeenAt] = useState(0);
  const [ended, setEnded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [awake, setAwake] = useState<boolean | null>(null);
  const remote = useRef<RemoteLink | null>(null);
  const connectedAt = useRef(0);

  // ---- The channel
  useEffect(() => {
    const opened = openRemote(
      supabase,
      code,
      (event, payload) => {
        if (event === EVENTS.state) {
          const next = parseState(payload);
          if (next) {
            setState(next);
            setSeenAt(Date.now());
            setEnded(false);
          }
        } else if (event === EVENTS.bye) {
          setEnded(true);
          setState(null);
        }
      },
      (status) => {
        setLink(status);
        if (status === 'connected') connectedAt.current = Date.now();
      },
    );
    remote.current = opened;
    return () => opened.close();
  }, [code]);

  // Say hello until the presenter answers, and keep asking if the connection comes back
  useEffect(() => {
    if (link !== 'connected') return;
    const hello = () => remote.current?.send(EVENTS.hello);
    hello();
    const id = window.setInterval(() => {
      if (!state || Date.now() - seenAt > STALE_MS) hello();
    }, 3000);
    return () => window.clearInterval(id);
  }, [link, state === null, seenAt === 0]);

  // A ticking clock so "time left" moves smoothly, and so a silent presenter is noticed
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // ---- Keep the screen awake
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    async function ask() {
      if (!('wakeLock' in navigator)) return setAwake(false);
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
        if (!cancelled) setAwake(true);
      } catch {
        if (!cancelled) setAwake(false);
      }
    }
    void ask();
    const again = () => {
      if (document.visibilityState === 'visible') void ask();
    };
    document.addEventListener('visibilitychange', again);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', again);
      void lock?.release();
    };
  }, []);

  const fresh = state !== null && now - seenAt < STALE_MS;
  const live = link === 'connected' && fresh && !ended;
  const waited = link === 'connected' && now - connectedAt.current > 6000;

  let words: string = t.connecting;
  if (link === 'denied') words = t.denied;
  else if (ended) words = t.ended;
  else if (link === 'retrying') words = t.retrying;
  else if (link === 'connecting') words = t.connecting;
  else if (live) words = t.live;
  else words = waited ? t.noPresenter : t.looking;

  function press(event: string, payload?: Record<string, unknown>) {
    navigator.vibrate?.(30);
    remote.current?.send(event, payload);
  }

  const left = state ? clockNow(state.clock, seenAt, now) : null;
  const tryLeft = state?.tryTimer ? Math.max(0, clockNow(state.tryTimer, seenAt, now)) : null;
  const mood = left === null ? 'fine' : clockMood(left);

  return (
    <div class="remote">
      <p class="remote-status" role="status">
        <span class="label">{t.status}:</span> {words}
      </p>
      {!live && (
        <div class="button-row">
          <button type="button" class="button button-secondary" onClick={() => remote.current?.reconnect()}>
            {t.reconnect}
          </button>
          <button type="button" class="button button-secondary" onClick={onLeave}>
            {t.newCode}
          </button>
        </div>
      )}
      <p class="caption">
        {t.keepOpen} {awake === true ? t.awake : awake === false ? t.awakeNo : ''}
      </p>

      {state && (
        <div>
          <h2 class="remote-title">
            {t.slide(state.index + 1, state.total)}: {state.title}
          </h2>
          {left !== null && (
            <p class={`remote-clock mood-${mood}`}>
              <span class="label">{t.timeLeft}:</span> {formatClock(left)}
              {mood === 'warning' && ` (${a.present.clockWarn})`}
              {mood === 'over' && ` (${a.present.clockOver})`}
            </p>
          )}
          {state.tryTimer && tryLeft !== null && (
            <p class="remote-clock">
              <span class="label">{t.practiceLeft}:</span> {formatClock(tryLeft)}
            </p>
          )}
          <h3>{t.notes}</h3>
          <p class="remote-notes">{state.notes || t.noNotes}</p>
          <p class="caption">{state.next ? `${t.upNext}: ${state.next}` : a.present.endOfLesson}</p>
        </div>
      )}

      <div class="remote-bar">
        {state?.tryTimer && (
          <button
            type="button"
            class="button button-primary remote-practice"
            disabled={!live || (tryLeft ?? 0) <= 0}
            onClick={() => press(state.tryTimer?.running ? EVENTS.tryPause : EVENTS.tryStart)}
          >
            {state.tryTimer.running ? t.practicePause : t.practiceStart(state.tryTimer.minutes)}
          </button>
        )}
        <div class="remote-small">
          <button type="button" class="button button-secondary" disabled={!live} onClick={() => press(EVENTS.blank)}>
            {state?.blank ? t.unblank : t.blank}
          </button>
          <button
            type="button"
            class="button button-secondary"
            disabled={!live}
            onClick={() => press(state?.clock.running ? EVENTS.timerPause : EVENTS.timerStart)}
          >
            {state?.clock.running ? t.timerPause : t.timerStart}
          </button>
        </div>
        <div class="remote-big">
          <button type="button" class="button button-secondary" disabled={!live || state?.index === 0} onClick={() => press(EVENTS.prev)}>
            <Icon name="arrow-left" size={40} /> {t.back}
          </button>
          <button type="button" class="button button-primary" disabled={!live || state?.index === (state?.total ?? 1) - 1} onClick={() => press(EVENTS.next)}>
            {t.next} <Icon name="arrow-right" size={40} />
          </button>
        </div>
      </div>
    </div>
  );
}
