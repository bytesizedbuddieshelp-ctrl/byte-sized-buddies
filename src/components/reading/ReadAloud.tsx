import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../forms/Icon';
import { copy } from '../../content/copy';
import { speakableText, splitForSpeech } from '../../lib/readAloud';

const t = copy.readAloud;
type Mode = 'idle' | 'reading' | 'paused';

// A button that reads part of the page out loud, using the voice already on the device.
// `target` is a CSS selector for the part to read. Nothing is sent over the internet.
export default function ReadAloud({ target, label = t.start }: { target: string; label?: string }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [mode, setMode] = useState<Mode>('idle');
  const [speed, setSpeed] = useState('1');
  const [message, setMessage] = useState('');
  const run = useRef(0); // lets an old reading know it has been stopped

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, []);

  if (!supported) return <p class="caption">{t.unsupported}</p>;

  function start() {
    const root = document.querySelector(target);
    if (!root) return;
    const pieces = splitForSpeech(speakableText(root));
    if (pieces.length === 0) return;
    window.speechSynthesis.cancel();
    const id = ++run.current;
    pieces.forEach((piece, index) => {
      const utterance = new SpeechSynthesisUtterance(piece);
      utterance.rate = Number(speed);
      utterance.lang = document.documentElement.lang || 'en';
      if (index === pieces.length - 1) {
        utterance.onend = () => {
          if (run.current !== id) return;
          setMode('idle');
          setMessage(t.done);
        };
      }
      utterance.onerror = () => {
        if (run.current === id) setMode('idle');
      };
      window.speechSynthesis.speak(utterance);
    });
    setMessage(t.reading);
    setMode('reading');
  }

  function pause() {
    window.speechSynthesis.pause();
    setMode('paused');
    setMessage(t.paused);
  }
  function resume() {
    window.speechSynthesis.resume();
    setMode('reading');
    setMessage(t.reading);
  }
  function stop() {
    run.current++;
    window.speechSynthesis.cancel();
    setMode('idle');
    setMessage('');
  }

  return (
    <div class="read-aloud no-read">
      <div class="button-row">
        {mode === 'idle' && (
          <button type="button" class="button button-secondary" onClick={start}>
            <Icon name="play" size={24} /> {label}
          </button>
        )}
        {mode === 'reading' && (
          <button type="button" class="button button-secondary" onClick={pause}>
            {t.pause}
          </button>
        )}
        {mode === 'paused' && (
          <button type="button" class="button button-secondary" onClick={resume}>
            {t.resume}
          </button>
        )}
        {mode !== 'idle' && (
          <button type="button" class="button button-secondary" onClick={stop}>
            {t.stop}
          </button>
        )}
        <label class="read-aloud-speed">
          <span>{t.speed}</span>
          <select class="field-control" value={speed} disabled={mode !== 'idle'} onChange={(e) => setSpeed(e.currentTarget.value)}>
            {t.speeds.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p class="caption" role="status">
        {message || t.help}
      </p>
    </div>
  );
}
