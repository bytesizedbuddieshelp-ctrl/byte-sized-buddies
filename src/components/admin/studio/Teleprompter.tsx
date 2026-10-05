import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from '../../forms/Icon';
import { adminCopy as a } from '../../../content/adminCopy';
import { renderMarkdown } from '../../../lib/markdown';

const t = a.studio;
const SIZES = [40, 48, 56, 64, 72, 88];

// The script in big text, scrolling at a speed the owner chooses. It only moves after Start is pressed.
export function Teleprompter({ script, onScript }: { script: string; onScript: (text: string) => void }) {
  const [sizeIndex, setSizeIndex] = useState(2);
  const [speed, setSpeed] = useState(3);
  const [running, setRunning] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const html = useMemo(() => (script.trim() ? renderMarkdown(script, { demoteHeadings: true }) : ''), [script]);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let frame = 0;
    let carry = 0;
    const step = (now: number) => {
      const el = box.current;
      if (!el) return;
      carry += ((now - last) / 1000) * speed * 12;
      last = now;
      const whole = Math.floor(carry);
      if (whole > 0) {
        el.scrollTop += whole;
        carry -= whole;
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return setRunning(false);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, speed]);

  function toTop() {
    setRunning(false);
    if (box.current) box.current.scrollTop = 0;
  }

  return (
    <section class="admin-box" aria-labelledby="prompt-title">
      <h2 id="prompt-title">{t.promptHeading}</h2>
      <div class="prompt-controls">
        <button type="button" class="button button-primary" disabled={!html} onClick={() => setRunning(!running)}>
          <Icon name={running ? 'pause' : 'play'} size={24} /> {running ? t.pauseScroll : t.startScroll}
        </button>
        <button type="button" class="button button-secondary" disabled={!html} onClick={toTop}>
          {t.top}
        </button>
        <div class="prompt-size" role="group" aria-label={t.textSize}>
          <button type="button" class="button button-secondary" disabled={sizeIndex === 0} onClick={() => setSizeIndex(sizeIndex - 1)}>
            {t.smaller}
          </button>
          <span class="caption">{t.sizeValue(SIZES[sizeIndex])}</span>
          <button type="button" class="button button-secondary" disabled={sizeIndex === SIZES.length - 1} onClick={() => setSizeIndex(sizeIndex + 1)}>
            {t.bigger}
          </button>
        </div>
        <div class="field prompt-speed">
          <label class="field-label" for="prompt-speed">{t.speed}: {speed}</label>
          <input id="prompt-speed" type="range" min={1} max={10} step={1} value={speed} onInput={(e) => setSpeed(Number(e.currentTarget.value))} />
        </div>
      </div>

      {html ? (
        <div
          ref={box}
          class="prompt-text"
          tabIndex={0}
          aria-label={t.promptHeading}
          style={{ fontSize: `${SIZES[sizeIndex]}px`, lineHeight: 1.35 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p>{t.emptyScript}</p>
      )}

      <details class="prompt-edit">
        <summary>{t.editScript}</summary>
        <div class="field">
          <label class="field-label" for="prompt-script">{t.scriptLabel}</label>
          <p class="field-helper" id="prompt-script-help">{t.scriptHelp}</p>
          <textarea
            id="prompt-script"
            class="field-control"
            rows={5}
            aria-describedby="prompt-script-help"
            value={script}
            onInput={(e) => onScript(e.currentTarget.value)}
          />
        </div>
      </details>
    </section>
  );
}
