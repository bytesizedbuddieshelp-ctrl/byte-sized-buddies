import { useEffect, useRef, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { ConfirmDialog } from './ConfirmDialog';
import { Notices } from './Notices';
import { Teleprompter } from './studio/Teleprompter';
import { BackgroundControls } from './studio/BackgroundControls';
import { DrawingBoard } from './studio/DrawingBoard';
import { CameraKeyer } from '../../lib/cameraKeyer';
import { PublishVideo, type StudioLesson } from './studio/PublishVideo';
import { Icon } from '../forms/Icon';
import { adminCopy as a } from '../../content/adminCopy';
import { formatBytes, sortByWeek } from '../../lib/lessons';
import { PARTS, formatDuration, loudness, pickMimeType, studioSupport, takeFileName, type Part } from '../../lib/studio';
import { beep, listDevices, mediaProblem, mixMain, openCamera, openScreen, stopStream, watchLevel } from '../../lib/recorder';

const t = a.studio;

interface Take {
  id: number;
  part: Part;
  n: number;
  url: string;
  mime: string;
  bytes: number;
  ms: number;
  downloaded: boolean;
}

type Phase = { kind: 'idle' } | { kind: 'countdown'; count: number } | { kind: 'recording'; paused: boolean };

export default function StudioPage() {
  return (
    <AdminShell current="studio" title={t.title}>
      {(supabase) => <Studio supabase={supabase} />}
    </AdminShell>
  );
}

function Studio({ supabase }: { supabase: SupabaseClient }) {
  const [support] = useState(() => studioSupport({ MediaRecorder: (window as { MediaRecorder?: unknown }).MediaRecorder, mediaDevices: navigator.mediaDevices }));
  const [lessons, setLessons] = useState<StudioLesson[]>([]);
  const [lessonsFailed, setLessonsFailed] = useState(false);
  const [lessonId, setLessonId] = useState('');
  const [name, setName] = useState('');
  const [script, setScript] = useState('');
  const [standards, setStandards] = useState<Record<'opener' | 'closer', string | null>>({ opener: null, closer: null });

  useEffect(() => {
    supabase
      .from('lessons')
      .select('id, title, week_number, status, video_script_md, video_ids')
      .then(({ data, error }) => {
        if (error) return setLessonsFailed(true);
        setLessons(sortByWeek((data ?? []) as StudioLesson[]));
      });
  }, []);

  function chooseLesson(id: string) {
    setLessonId(id);
    const lesson = lessons.find((l) => l.id === id);
    setName(lesson ? (lesson.week_number ? `Week ${lesson.week_number} ${lesson.title}` : lesson.title) : '');
    setScript(lesson?.video_script_md ?? '');
  }

  if (!support.camera) {
    return (
      <p class="admin-message is-error" role="alert">
        <Icon name="alert" size={24} /> {t.unsupported}
      </p>
    );
  }

  return (
    <div>
      <p>{t.intro}</p>
      <p class="caption">{t.bestIn}</p>
      <aside class="callout callout-remember studio-checklist" aria-labelledby="checklist-title">
        <h2 id="checklist-title" class="callout-title">
          <Icon name="info" size={28} /> {t.checklistTitle}
        </h2>
        <ul class="check-list">
          {t.checklist.map((item) => (
            <li key={item}>
              <Icon name="check" size={24} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </aside>

      <section class="admin-box" aria-labelledby="lesson-title">
        <h2 id="lesson-title">{t.lessonHeading}</h2>
        {lessonsFailed && <p class="caption">{t.lessonsError}</p>}
        <div class="field">
          <label class="field-label" for="studio-lesson">{t.lessonLabel}</label>
          <p class="field-helper" id="studio-lesson-help">{t.lessonHelp}</p>
          <select id="studio-lesson" class="field-control" aria-describedby="studio-lesson-help" value={lessonId} onChange={(e) => chooseLesson(e.currentTarget.value)}>
            <option value="">{t.noLesson}</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.week_number ? `Week ${l.week_number}: ` : ''}
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="studio-name">{t.nameLabel}</label>
          <p class="field-helper" id="studio-name-help">{t.nameHelp}</p>
          <input id="studio-name" class="field-control" aria-describedby="studio-name-help" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </div>
      </section>

      {/* On a wide screen the teleprompter sits beside the camera, so the owner can read and see themselves at once. */}
      <div class="studio-workspace">
        <div class="studio-main">
          <Recorder name={name} canShare={support.screen} standards={standards} />
        </div>
        <div class="studio-side">
          <Teleprompter script={script} onScript={setScript} />
        </div>
      </div>

      <PublishVideo supabase={supabase} lessons={lessons} lessonId={lessonId} title={name} script={script} onStandards={setStandards} />
    </div>
  );
}

function Recorder({ name, canShare, standards }: { name: string; canShare: boolean; standards: Record<'opener' | 'closer', string | null> }) {
  // camera is the processed camera (with the wall replaced when that is on). rig holds the raw camera behind it.
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [keyer, setKeyer] = useState<CameraKeyer | null>(null);
  const rig = useRef<{ raw: MediaStream; keyer: CameraKeyer } | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [micId, setMicId] = useState('');
  const [level, setLevel] = useState(0);
  const [part, setPart] = useState<Part>('opener');
  const [bubble, setBubble] = useState(true);
  const [tabAudio, setTabAudio] = useState(false);
  const [drawOn, setDrawOn] = useState(true);
  const [board, setBoard] = useState<{ picture: HTMLCanvasElement; layer: HTMLCanvasElement } | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const [takes, setTakes] = useState<Take[]>([]);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');
  const [deleting, setDeleting] = useState<Take | null>(null);
  const preview = useRef<HTMLVideoElement>(null);

  // Everything about the recording in progress lives here, so stopping works from any callback.
  const live = useRef<{ recorder: MediaRecorder | null; cleanup: () => void; chunks: Blob[]; startedAt: number; pausedAt: number; pausedMs: number; cancelled: boolean; part: Part }>({
    recorder: null, cleanup: () => {}, chunks: [], startedAt: 0, pausedAt: 0, pausedMs: 0, cancelled: false, part: 'opener',
  });
  const counter = useRef<Record<Part, number>>({ opener: 0, main: 0, closer: 0 });
  const takesRef = useRef<Take[]>([]);
  takesRef.current = takes;

  useEffect(() => {
    if (preview.current) preview.current.srcObject = camera;
    if (!camera) return;
    return watchLevel(camera, setLevel);
  }, [camera]);

  // Ask before leaving with takes that were never downloaded. Clean up the camera and recordings on the way out.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (takesRef.current.some((take) => !take.downloaded)) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      live.current.cleanup();
      takesRef.current.forEach((take) => URL.revokeObjectURL(take.url));
    };
  }, []);

  function closeRig() {
    rig.current?.keyer.stop();
    stopStream(rig.current?.raw);
    rig.current = null;
  }

  useEffect(() => () => closeRig(), []);

  // The clock while recording. It follows the real time, so it stays right even if the tab is in the background.
  useEffect(() => {
    if (phase.kind !== 'recording') return;
    const tick = () => {
      const l = live.current;
      const now = phase.paused ? l.pausedAt : Date.now();
      setElapsed(now - l.startedAt - l.pausedMs);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  function say(message: string, bad = false) {
    setOk(bad ? '' : message);
    setProblem(bad ? message : '');
  }

  async function turnOn(nextCamera = cameraId, nextMic = micId) {
    say('');
    closeRig();
    try {
      const raw = await openCamera(nextCamera, nextMic);
      const processed = new CameraKeyer(raw);
      rig.current = { raw, keyer: processed };
      setKeyer(processed);
      setCamera(processed.stream);
      const found = await listDevices();
      setCameras(found.cameras);
      setMics(found.mics);
      setCameraId(raw.getVideoTracks()[0]?.getSettings().deviceId ?? nextCamera);
      setMicId(raw.getAudioTracks()[0]?.getSettings().deviceId ?? nextMic);
    } catch (error) {
      setCamera(null);
      setKeyer(null);
      const kind = mediaProblem(error);
      say(kind === 'denied' ? t.denied : kind === 'missing' ? t.noDevice : t.deviceBusy, true);
    }
  }

  function turnOff() {
    closeRig();
    setCamera(null);
    setKeyer(null);
    setLevel(0);
  }

  async function record() {
    say('');
    if (!camera) return say(t.needCamera, true);
    const mime = pickMimeType((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) return say(t.recordFailed, true);

    let stream = camera;
    let cleanup = () => {};
    if (part === 'main') {
      let screen: MediaStream;
      try {
        screen = await openScreen(tabAudio);
      } catch {
        return say(t.shareCancelled, true);
      }
      const layer = drawOn ? document.createElement('canvas') : null;
      const mix = mixMain(screen, camera, bubble ? camera : null, layer);
      stream = mix.stream;
      if (mix.canvas && layer) setBoard({ picture: mix.canvas, layer });
      cleanup = () => {
        setBoard(null);
        mix.stop();
        stopStream(screen);
      };
      // The browser's own "Stop sharing" button ends the recording (or the countdown).
      screen.getVideoTracks()[0]?.addEventListener('ended', () => {
        const recorder = live.current.recorder;
        if (!recorder) cancelCountdown();
        else if (recorder.state !== 'inactive') stop();
        say(t.shareStopped);
      });
    }

    const l = live.current;
    l.cleanup = cleanup;
    l.cancelled = false;
    l.part = part;

    // 3, 2, 1, with a beep each second. Recording starts after the third.
    for (const count of [3, 2, 1]) {
      if (l.cancelled) return;
      setPhase({ kind: 'countdown', count });
      beep();
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    if (l.cancelled) return;
    beep(true);
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    if (l.cancelled) return;

    try {
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
      l.recorder = recorder;
      l.chunks = [];
      l.pausedMs = 0;
      recorder.ondataavailable = (event) => {
        if (event.data.size) l.chunks.push(event.data);
      };
      recorder.onstop = () => finish(mime);
      recorder.start(1000);
      l.startedAt = Date.now();
      setElapsed(0);
      setPhase({ kind: 'recording', paused: false });
    } catch {
      cleanup();
      setPhase({ kind: 'idle' });
      say(t.recordFailed, true);
    }
  }

  function cancelCountdown() {
    live.current.cancelled = true;
    live.current.cleanup();
    live.current.cleanup = () => {};
    setPhase({ kind: 'idle' });
  }

  function togglePause() {
    const l = live.current;
    if (!l.recorder) return;
    if (l.recorder.state === 'recording') {
      l.recorder.pause();
      l.pausedAt = Date.now();
      setPhase({ kind: 'recording', paused: true });
    } else if (l.recorder.state === 'paused') {
      l.recorder.resume();
      l.pausedMs += Date.now() - l.pausedAt;
      setPhase({ kind: 'recording', paused: false });
    }
  }

  function stop() {
    const l = live.current;
    if (l.recorder && l.recorder.state !== 'inactive') {
      if (l.recorder.state === 'paused') l.pausedMs += Date.now() - l.pausedAt;
      l.recorder.stop();
    }
  }

  function finish(mime: string) {
    const l = live.current;
    const ms = Date.now() - l.startedAt - l.pausedMs;
    l.cleanup();
    l.cleanup = () => {};
    l.recorder = null;
    const blob = new Blob(l.chunks, { type: mime.split(';')[0] });
    l.chunks = [];
    const n = ++counter.current[l.part];
    const take: Take = { id: Date.now(), part: l.part, n, url: URL.createObjectURL(blob), mime, bytes: blob.size, ms, downloaded: false };
    setTakes((list) => [...list, take]);
    setPhase({ kind: 'idle' });
    say(t.takeReady(t.partShort[l.part], n));
  }

  function removeTake(take: Take) {
    URL.revokeObjectURL(take.url);
    setTakes((list) => list.filter((x) => x.id !== take.id));
    setDeleting(null);
  }

  const busy = phase.kind !== 'idle';
  const partTakes = takes.filter((x) => x.part === part);
  const word = loudness(level);
  const standard = part !== 'main' ? standards[part] : null;

  return (
    <>
      <section class="admin-box" aria-labelledby="devices-title">
        <h2 id="devices-title">{t.devicesHeading}</h2>
        {!camera ? (
          <>
            <p class="field-helper">{t.turnOnHelp}</p>
            <button type="button" class="button button-primary" onClick={() => turnOn()}>
              <Icon name="video" size={24} /> {t.turnOn}
            </button>
          </>
        ) : (
          <div class="studio-devices">
            <video ref={preview} class="studio-preview" autoPlay muted playsInline aria-label={t.previewLabel} />
            <p class="field-label studio-level" id="level-label">
              <Icon name="mic" size={24} /> {t.level}: <span>{t.levelWords[word]}</span>
            </p>
            <div class="meter-bar" aria-hidden="true">
              <div style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
            {keyer && <BackgroundControls keyer={keyer} preview={preview} disabled={busy} />}
            <details class="studio-settings">
              <summary>{t.deviceSettings}</summary>
              <div class="field">
                <label class="field-label" for="studio-camera">{t.cameraLabel}</label>
                <select id="studio-camera" class="field-control" value={cameraId} disabled={busy} onChange={(e) => turnOn(e.currentTarget.value, micId)}>
                  {cameras.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `${t.cameraLabel} ${i + 1}`}</option>
                  ))}
                </select>
              </div>
              <div class="field">
                <label class="field-label" for="studio-mic">{t.micLabel}</label>
                <select id="studio-mic" class="field-control" value={micId} disabled={busy} onChange={(e) => turnOn(cameraId, e.currentTarget.value)}>
                  {mics.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `${t.micLabel} ${i + 1}`}</option>
                  ))}
                </select>
              </div>
              <button type="button" class="button button-secondary" disabled={busy} onClick={turnOff}>{t.turnOff}</button>
            </details>
          </div>
        )}
      </section>

      <section class="admin-box" aria-labelledby="record-title">
        <h2 id="record-title">{t.recordHeading}</h2>
        <Notices ok={ok} problem={problem} />
        <fieldset class="chips">
          <legend>{t.partsLabel}</legend>
          {PARTS.map((p) => (
            <button key={p} type="button" class="chip" aria-pressed={part === p} disabled={busy} onClick={() => setPart(p)}>
              {t.partChip(t.parts[p], takes.filter((x) => x.part === p).length)}
            </button>
          ))}
        </fieldset>
        <p>{t.partHelp[part]}</p>
        {standard && <p class="caption">{t.hasStandard(t.partShort[part].toLowerCase())}</p>}

        {part === 'main' && !canShare && (
          <p class="admin-message is-error" role="alert">
            <Icon name="alert" size={24} /> {t.noScreen}
          </p>
        )}
        {part === 'main' && canShare && (
          <>
            <p class="callout callout-remember studio-warning">
              <Icon name="info" size={24} /> {t.teleprompterWarning}
            </p>
            <label class="choice">
              <input type="checkbox" checked={bubble} disabled={busy} onChange={(e) => setBubble(e.currentTarget.checked)} aria-describedby="studio-bubble-help" />
              <span>{t.bubble}</span>
            </label>
            <p class="field-helper" id="studio-bubble-help">{t.bubbleHelp}</p>
            <label class="choice">
              <input type="checkbox" checked={drawOn} disabled={busy} onChange={(e) => setDrawOn(e.currentTarget.checked)} aria-describedby="studio-draw-help" />
              <span>{t.draw}</span>
            </label>
            <p class="field-helper" id="studio-draw-help">{t.drawHelp}</p>
            <label class="choice">
              <input type="checkbox" checked={tabAudio} disabled={busy} onChange={(e) => setTabAudio(e.currentTarget.checked)} aria-describedby="studio-tab-help" />
              <span>{t.tabAudio}</span>
            </label>
            <p class="field-helper" id="studio-tab-help">{t.tabAudioHelp}</p>
          </>
        )}

        <div class="studio-status" aria-live="assertive">
          {phase.kind === 'countdown' && (
            <p class="studio-count">
              {t.getReady}: {phase.count}
            </p>
          )}
          {phase.kind === 'recording' && (
            <p class="studio-recording">
              <Icon name={phase.paused ? 'pause' : 'record'} size={28} /> {phase.paused ? t.paused(formatDuration(elapsed)) : t.recording(formatDuration(elapsed))}
            </p>
          )}
        </div>

        <div class="button-row">
          {phase.kind === 'idle' && (
            <button type="button" class="button button-primary" disabled={!camera || (part === 'main' && !canShare)} onClick={record}>
              <Icon name="record" size={24} /> {t.record(t.partShort[part])}
            </button>
          )}
          {phase.kind === 'countdown' && (
            <button type="button" class="button button-secondary" onClick={cancelCountdown}>{t.cancel}</button>
          )}
          {phase.kind === 'recording' && (
            <>
              <button type="button" class="button button-primary" onClick={stop}>
                <Icon name="stop" size={24} /> {t.stop}
              </button>
              <button type="button" class="button button-secondary" onClick={togglePause}>
                <Icon name={phase.paused ? 'record' : 'pause'} size={24} /> {phase.paused ? t.resume : t.pause}
              </button>
            </>
          )}
        </div>
        {phase.kind === 'idle' && <p class="caption">{t.beepNote}</p>}
        {board && (
          <DrawingBoard
            picture={board.picture}
            layer={board.layer}
            onStop={stop}
            status={
              phase.kind === 'countdown'
                ? `${t.getReady}: ${phase.count}`
                : phase.kind === 'recording'
                  ? phase.paused
                    ? t.paused(formatDuration(elapsed))
                    : t.recording(formatDuration(elapsed))
                  : ''
            }
          />
        )}

        <h3>{t.takesHeading}</h3>
        <p class="caption">{t.keepNote}</p>
        {partTakes.length === 0 ? (
          <p>{t.noTakes}</p>
        ) : (
          <ul class="take-list">
            {partTakes.map((take) => (
              <li key={take.id}>
                <p class="label">{t.take(take.n, formatDuration(take.ms), formatBytes(take.bytes))}</p>
                <video class="take-video" src={take.url} controls preload="metadata" aria-label={t.takeVideo(t.partShort[take.part], take.n)} />
                <div class="button-row">
                  <a
                    class="button button-primary"
                    href={take.url}
                    download={takeFileName(name, take.part, take.n, take.mime)}
                    onClick={() => setTakes((list) => list.map((x) => (x.id === take.id ? { ...x, downloaded: true } : x)))}
                  >
                    <Icon name={take.downloaded ? 'check' : 'download'} size={24} /> {take.downloaded ? t.downloaded : t.download}
                  </a>
                  <button type="button" class="button button-secondary" onClick={() => setDeleting(take)}>{t.deleteTake}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        danger
        title={t.confirmDeleteTitle}
        confirmLabel={t.deleteTake}
        cancelLabel={t.cancel}
        onConfirm={() => deleting && removeTake(deleting)}
        onCancel={() => setDeleting(null)}
      >
        <p>{t.confirmDeleteText}</p>
      </ConfirmDialog>
    </>
  );
}
