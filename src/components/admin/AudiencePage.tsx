import { useEffect, useRef, useState } from 'preact/hooks';
import { Stage } from '../slides/Stage';
import { adminCopy as a } from '../../content/adminCopy';
import { countdownLeft, formatClock, localChannelFor, normalizeCode, type AudienceInit, type LocalMessage } from '../../lib/remote';
import { validateDeck, type Slide } from '../../lib/slides';

// The window you drag to the TV. It shows the slide and nothing else. It has no sign-in and no database:
// it only shows what the presenter window sends it, so it keeps working if the Wi-Fi drops.
export default function AudiencePage() {
  const code = normalizeCode(window.location.hash.replace('#', ''));
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [lessonName, setLessonName] = useState('');
  const [images, setImages] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [blank, setBlank] = useState(false);
  const [tryBase, setTryBase] = useState<number | null>(null);
  const [tryStartedAt, setTryStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [ended, setEnded] = useState(false);
  const [hint, setHint] = useState(true);
  const channel = useRef<BroadcastChannel | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${a.audience.title} | Byte-Sized Buddies`;
    if (!code || typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(localChannelFor(code));
    channel.current = bc;
    bc.onmessage = (event: MessageEvent<LocalMessage>) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'init') {
        const deck = validateDeck({ version: 1, slides: (message as AudienceInit).slides }).deck;
        if (!deck) return;
        setSlides(deck.slides);
        setLessonName(String(message.lessonName).slice(0, 200));
        setImages(typeof message.images === 'object' && message.images ? message.images : {});
        setIndex(Number.isInteger(message.index) ? message.index : 0);
        setBlank(Boolean(message.blank));
        setTryBase(typeof message.tryBase === 'number' ? message.tryBase : null);
        setTryStartedAt(typeof message.tryStartedAt === 'number' ? message.tryStartedAt : null);
        setEnded(false);
      } else if (message.type === 'update') {
        setIndex(Number.isInteger(message.index) ? message.index : 0);
        setBlank(Boolean(message.blank));
        setTryBase(typeof message.tryBase === 'number' ? message.tryBase : null);
        setTryStartedAt(typeof message.tryStartedAt === 'number' ? message.tryStartedAt : null);
      } else if (message.type === 'bye') {
        setEnded(true);
      }
    };
    // Ask for the slides now, and again every two seconds until they arrive (the presenter may still be loading).
    const ask = () => bc.postMessage({ type: 'hello' } satisfies LocalMessage);
    ask();
    const retry = window.setInterval(ask, 2000);
    const hide = window.setTimeout(() => setHint(false), 8000);
    return () => {
      window.clearInterval(retry);
      window.clearTimeout(hide);
      bc.close();
    };
  }, []);

  // This window keeps its own countdown from the start time, so it stays smooth even if the presenter window is in the background.
  useEffect(() => {
    if (tryStartedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    setNow(Date.now());
    return () => window.clearInterval(id);
  }, [tryStartedAt]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.();
  }

  // Keys pressed in this window go back to the presenter, so clicking the TV window never traps you.
  function onKeyDown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const send = (t: 'next' | 'prev' | 'blank' | 'first' | 'last') => channel.current?.postMessage({ type: 'cmd', t } satisfies LocalMessage);
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': send('next'); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': send('prev'); break;
      case 'Home': send('first'); break;
      case 'End': send('last'); break;
      case 'b': case 'B': send('blank'); break;
      case 'f': case 'F': toggleFullscreen(); break;
      default: return;
    }
    event.preventDefault();
  }

  const current = slides ? slides[Math.min(index, slides.length - 1)] : null;
  const tryText = tryBase === null ? null : formatClock(Math.max(0, countdownLeft(tryBase, tryStartedAt, now)));

  return (
    <main id="main" tabIndex={-1} class="audience" ref={root} onKeyDown={onKeyDown} onDblClick={toggleFullscreen}>
      <h1 class="visually-hidden">{a.audience.title}</h1>
      {current && !ended ? (
        <Stage slide={current} lessonName={lessonName} imageUrl={(file) => images[file] ?? ''} blank={blank} tryText={tryText}>
          {hint && <p class="audience-hint" role="note">{a.audience.fullscreenHint}</p>}
        </Stage>
      ) : (
        <div class="audience-wait">
          <p role="status">{ended ? a.audience.ended : a.audience.waiting}</p>
          {!ended && <p>{a.audience.waitingHelp}</p>}
        </div>
      )}
    </main>
  );
}
