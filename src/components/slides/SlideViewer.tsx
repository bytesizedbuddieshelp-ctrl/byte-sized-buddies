import { useEffect, useRef, useState } from 'preact/hooks';
import type { Slide } from '../../lib/slides';
import { SlideCanvas, SlideFrame } from './SlideCanvas';
import { Icon } from '../forms/Icon';
import { copy } from '../../content/copy';

interface ViewerProps {
  slides: Slide[];
  lessonName: string;
  imageUrl: (file: string) => string;
  /** Show the speaker notes under the slide. Only the owner's presenter screen turns this on. */
  showNotes?: boolean;
  onPrint?: () => void;
}

const t = copy.viewer;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Click the slide, then use the keyboard: arrows, Space, Home, End, B (blank), F (full screen).
export function SlideViewer({ slides, lessonName, imageUrl, showNotes = false, onPrint }: ViewerProps) {
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [blank, setBlank] = useState(false);
  const [full, setFull] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const total = slides.length;
  const slide = slides[Math.min(index, Math.max(total - 1, 0))];
  const minutes = slide?.layout === 'tryit' ? slide.timer_minutes : undefined;

  // A new slide starts with a fresh, stopped timer.
  useEffect(() => {
    setRunning(false);
    setRemaining(minutes ? minutes * 60 : null);
    if (slide) setAnnouncement(t.announce(index + 1, total, slide.title));
  }, [index, total, minutes]);

  useEffect(() => {
    if (!running || remaining === null) return;
    if (remaining <= 0) {
      setRunning(false);
      setAnnouncement(t.timerDone);
      return;
    }
    const id = window.setTimeout(() => setRemaining((r) => (r === null ? r : r - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [running, remaining]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (total === 0) return <p>{t.noSlides}</p>;

  const go = (next: number) => {
    setIndex(Math.min(Math.max(next, 0), total - 1));
    setBlank(false);
  };
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.();
  };

  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const onControl = target.closest('button, a, input, textarea, select');
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
        go(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        go(index - 1);
        break;
      case ' ':
        if (onControl) return; // Space presses the focused button instead
        go(index + 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(total - 1);
        break;
      case 'b':
      case 'B':
        setBlank((b) => !b);
        break;
      case 'f':
      case 'F':
        toggleFull();
        break;
      case 'Escape':
        if (blank) setBlank(false);
        return;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div class="viewer" ref={root} tabIndex={0} role="group" aria-roledescription="slideshow" aria-label={`${t.label}: ${lessonName}`} onKeyDown={onKeyDown}>
      <div class="viewer-stage">
        <SlideFrame>
          <SlideCanvas slide={slide} lessonName={lessonName} imageUrl={imageUrl} timerText={remaining === null ? undefined : clock(remaining)} />
        </SlideFrame>
        {blank && (
          <div class="viewer-blank" role="status">
            {t.blankNote}
          </div>
        )}
      </div>
      <p class="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      <div class="viewer-progress" role="progressbar" aria-label={t.progress} aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1}>
        <div style={`width: ${((index + 1) / total) * 100}%`} />
      </div>

      <div class="viewer-bar">
        <button type="button" class="button button-secondary" onClick={() => go(index - 1)} disabled={index === 0}>
          <Icon name="arrow-left" size={24} /> {t.previous}
        </button>
        <span class="counter-text" aria-hidden="true">
          {t.counter(index + 1, total)}
        </span>
        <button type="button" class="button button-primary" onClick={() => go(index + 1)} disabled={index === total - 1}>
          {t.next} <Icon name="arrow-right" size={24} />
        </button>
      </div>
      <div class="viewer-bar" style="margin-top: 16px;">
        <button type="button" class="button button-secondary" onClick={toggleFull}>
          {full ? t.exitFullscreen : t.fullscreen}
        </button>
        <button type="button" class="button button-secondary" onClick={() => setBlank((b) => !b)}>
          {blank ? t.unblank : t.blank}
        </button>
        {minutes && remaining !== null && (
          <>
            <button type="button" class="button button-secondary" onClick={() => setRunning((r) => !r)} disabled={remaining <= 0}>
              {running ? t.timerPause : t.timerStart(minutes)}
            </button>
            <button type="button" class="button button-secondary" onClick={() => { setRunning(false); setRemaining(minutes * 60); }}>
              {t.timerReset}
            </button>
          </>
        )}
        {onPrint && (
          <button type="button" class="button button-secondary" onClick={onPrint}>
            <Icon name="download" size={24} /> {t.print}
          </button>
        )}
      </div>
      <p class="caption">{t.keys}</p>

      {showNotes && (
        <section class="viewer-notes" aria-label={t.notes}>
          <strong>{t.notes}</strong>
          <p>{slide.notes || t.noNotes}</p>
        </section>
      )}
    </div>
  );
}

/** Every slide at once, for printing. It stays hidden on screen. See slides.css. */
export function PrintSlides({ slides, lessonName, imageUrl }: Omit<ViewerProps, 'showNotes' | 'onPrint'>) {
  return (
    <div class="print-slides" aria-hidden="true">
      {slides.map((slide, i) => (
        <div class="print-page" key={i}>
          <div class="slide-scale">
            <SlideCanvas slide={slide} lessonName={lessonName} imageUrl={imageUrl} mode="print" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Opens the print window with only the slides showing, then puts the page back.
 * It waits until every picture is ready first, or a picture could be missing from the PDF.
 */
export async function printSlides() {
  const done = () => {
    document.body.classList.remove('print-slides-only');
    window.removeEventListener('afterprint', done);
  };
  document.body.classList.add('print-slides-only');
  window.addEventListener('afterprint', done);
  const pictures = Array.from(document.querySelectorAll<HTMLImageElement>('.print-slides img'));
  const ready = Promise.all(pictures.map((picture) => picture.decode().catch(() => undefined)));
  const giveUp = new Promise((resolve) => window.setTimeout(resolve, 4000)); // a slow connection should not block printing forever
  await Promise.race([ready, giveUp]);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.print();
}
