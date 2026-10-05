import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Icon } from '../../forms/Icon';
import { adminCopy as a } from '../../../content/adminCopy';
import { brandColor } from '../../../lib/backgrounds';
import { fadeOpacity, INK_COLORS, renderStrokes, TOOL_KEYS, TOOLS, toCanvasPoint, type InkColor, type Stroke, type Tool } from '../../../lib/drawing';
import type { IconName } from '../../../lib/icons';

const t = a.studio.board;
const toolIcons: Record<Tool, IconName> = { pen: 'pen', highlighter: 'highlighter', arrow: 'pointer', circle: 'oval' };

// Chrome and Edge can open a small window that stays on top of every other window ("Document Picture-in-Picture").
interface PipApi {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
}
const pipApi = (): PipApi | undefined => (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;

/** Copies the page's styles into the floating window, so the pad looks the same there. */
function copyStyles(to: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = to.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
      to.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = to.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        to.head.appendChild(link);
      }
    }
  }
}

// While the main part records: the owner's screen as it is being recorded, to draw on.
// `picture` is the recording itself (drawn by the studio). `layer` is the see-through drawing layer that the
// recording copies on top of the screen 30 times a second.
export function DrawingBoard({ picture, layer }: { picture: HTMLCanvasElement; layer: HTMLCanvasElement }) {
  const holder = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<InkColor>('sunshine');
  const [fade, setFade] = useState(true);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [pip, setPip] = useState<{ win: Window; root: HTMLElement } | null>(null);
  const drawing = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  // The pointer handlers read the current tool and color at the moment drawing starts, so a quick key press counts.
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const fadeRef = useRef(fade);
  fadeRef.current = fade;
  const [colors] = useState(() => ({ sunshine: brandColor('sunshine'), forest: brandColor('forest'), paper: brandColor('paper') }));
  const [outline] = useState(() => brandColor('ink'));
  const canFloat = Boolean(pipApi());

  // Paints the finished strokes (fading the old ones) plus the one being drawn.
  const paint = () => {
    const now = Date.now();
    const shown = strokesRef.current.map((s) => (fadeRef.current && s.at ? { ...s, opacity: fadeOpacity(now - s.at) } : s));
    renderStrokes(layer.getContext('2d')!, drawing.current ? [...shown, drawing.current] : shown, colors, outline);
  };

  useEffect(paint, [strokes, fade]);

  // A steady clock (it keeps going when this tab is in the background) fades lines and removes the gone ones.
  useEffect(() => {
    if (!fade) return;
    const clock = new Worker('/studio-timer.js');
    clock.onmessage = () => {
      if (!strokesRef.current.length) return;
      paint();
      const now = Date.now();
      if (strokesRef.current.some((s) => s.at && fadeOpacity(now - s.at) <= 0)) {
        setStrokes((list) => list.filter((s) => !s.at || fadeOpacity(now - s.at) > 0));
      }
    };
    clock.postMessage(1000 / 30);
    return () => clock.terminate();
  }, [fade]);

  // Put the recording's picture in the pad (on this page, or in the floating window).
  useEffect(() => {
    const box = holder.current;
    if (!box) return;
    picture.classList.add('draw-picture');
    picture.setAttribute('role', 'img');
    picture.setAttribute('aria-label', t.label);
    box.appendChild(picture);
  }, [picture, pip]);

  // Drawing with the mouse, trackpad, or pen.
  useEffect(() => {
    const el = picture;
    const point = (e: PointerEvent) => toCanvasPoint(e.clientX, e.clientY, el.getBoundingClientRect(), el);
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      drawing.current = { tool: toolRef.current, color: colorRef.current, points: [point(e), point(e)] };
    };
    const move = (e: PointerEvent) => {
      const stroke = drawing.current;
      if (!stroke) return;
      if (stroke.tool === 'pen' || stroke.tool === 'highlighter') stroke.points.push(point(e));
      else stroke.points[1] = point(e);
      paint();
    };
    const up = () => {
      const stroke = drawing.current;
      drawing.current = null;
      if (stroke) setStrokes((list) => [...list, { ...stroke, at: Date.now() }]);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [picture]);

  // Keyboard shortcuts, on this page and in the floating window. Typing in a box is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || target?.closest?.('input, textarea, select')) return;
      const key = e.key.toLowerCase();
      if (TOOL_KEYS[key]) toolRef.current = TOOL_KEYS[key];
      else if (['1', '2', '3'].includes(key)) colorRef.current = INK_COLORS[Number(key) - 1];
      if (TOOL_KEYS[key]) setTool(TOOL_KEYS[key]);
      else if (key === 'z') setStrokes((list) => list.slice(0, -1));
      else if (key === 'x') setStrokes([]);
      else if (['1', '2', '3'].includes(key)) setColor(INK_COLORS[Number(key) - 1]);
      else return;
      e.preventDefault();
    };
    const windows = pip ? [window, pip.win] : [window];
    windows.forEach((w) => w.addEventListener('keydown', onKey));
    return () => windows.forEach((w) => w.removeEventListener('keydown', onKey));
  }, [pip]);

  async function float() {
    const api = pipApi();
    if (!api) return;
    const win = await api.requestWindow({ width: 720, height: 560 });
    copyStyles(win.document);
    win.document.title = t.heading;
    win.document.body.classList.add('draw-pip');
    const root = win.document.createElement('div');
    win.document.body.appendChild(root);
    // When the floating window closes, bring the picture home first, then the pad.
    win.addEventListener('pagehide', () => {
      document.adoptNode(picture);
      setPip(null);
    });
    setPip({ win, root });
  }

  function bringBack() {
    pip?.win.close();
  }

  // The floating window closes when recording stops.
  useEffect(() => () => pip?.win.close(), [pip]);
  // The drawings leave the recording when the board closes.
  useEffect(() => () => layer.getContext('2d')!.clearRect(0, 0, layer.width, layer.height), [layer]);

  const pad = (
    <div class={`draw-pad${pip ? ' is-floating' : ''}`}>
      <div class="draw-toolbar">
        <div class="draw-group" role="group" aria-label={t.tools}>
          {TOOLS.map((x) => (
            <button key={x} type="button" class="draw-button" aria-pressed={tool === x} aria-keyshortcuts={t.toolKey[x]} onClick={() => setTool(x)}>
              <Icon name={toolIcons[x]} size={24} />
              <span>{t.tool[x]}</span>
            </button>
          ))}
        </div>
        <div class="draw-group" role="group" aria-label={t.colors}>
          {INK_COLORS.map((c, i) => (
            <button key={c} type="button" class="draw-button" aria-pressed={color === c} aria-keyshortcuts={String(i + 1)} onClick={() => setColor(c)}>
              <span class="draw-dot" style={{ background: colors[c] }} aria-hidden="true" />
              <span>{t.color[c]}</span>
            </button>
          ))}
        </div>
        <div class="draw-group">
          <button type="button" class="draw-button" disabled={strokes.length === 0} aria-keyshortcuts="Z" onClick={() => setStrokes((list) => list.slice(0, -1))}>
            <Icon name="undo" size={24} />
            <span>{t.undo}</span>
          </button>
          <button type="button" class="draw-button" disabled={strokes.length === 0} aria-keyshortcuts="X" onClick={() => setStrokes([])}>
            <Icon name="close" size={24} />
            <span>{t.clear}</span>
          </button>
        </div>
        <label class="draw-fade">
          <input type="checkbox" checked={fade} onChange={(e) => setFade(e.currentTarget.checked)} />
          <span>{t.fade}</span>
        </label>
      </div>
      <div class="draw-holder" ref={holder} />
      <p class="caption draw-keys">
        {t.keys} <span role="status">{t.count(strokes.length)}</span>
      </p>
    </div>
  );

  return (
    <section class="draw-board" aria-labelledby="draw-title">
      <h3 id="draw-title">{t.heading}</h3>
      {canFloat ? (
        <>
          <ol class="draw-steps">
            {t.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {pip ? (
            <p class="draw-floating">
              <Icon name="float" size={24} /> {t.floating}{' '}
              <button type="button" class="button button-secondary" onClick={bringBack}>{t.bringBack}</button>
            </p>
          ) : (
            <>
              <button type="button" class="button button-primary" onClick={() => void float()}>
                <Icon name="float" size={24} /> {t.float}
              </button>
              <p class="caption">{t.floatHelp}</p>
            </>
          )}
        </>
      ) : (
        <p class="caption">{t.noFloat}</p>
      )}
      {pip ? createPortal(pad, pip.root) : pad}
    </section>
  );
}
