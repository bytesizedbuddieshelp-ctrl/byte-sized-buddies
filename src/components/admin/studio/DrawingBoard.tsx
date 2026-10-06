import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Icon } from '../../forms/Icon';
import { adminCopy as a } from '../../../content/adminCopy';
import { brandColor } from '../../../lib/backgrounds';
import { fadeOpacity, INK_COLORS, renderStrokes, TOOL_KEYS, TOOLS, toCanvasPoint, type InkColor, type Stroke, type Tool } from '../../../lib/drawing';
import type { IconName } from '../../../lib/icons';

const t = a.studio.board;
const toolIcons: Record<Tool, IconName> = { pen: 'pen', highlighter: 'highlighter', arrow: 'pointer', circle: 'oval' };

// While the main part records: the owner's screen as it is being recorded, to draw on.
// `picture` is the recording itself (drawn by the studio). `layer` is the see-through drawing layer that the
// recording copies on top of the screen 30 times a second.
// The pad opens in its own browser tab (/admin/annotate) as soon as the board appears, so the owner can switch
// tabs to draw. The tab has no code of its own: this page puts the pad into it. If the tab is blocked or closed,
// the pad stays here, where "Draw full screen" (F) makes it fill the screen.
const TAB_NAME = 'bsb-drawing';

interface Props {
  picture: HTMLCanvasElement;
  layer: HTMLCanvasElement;
  /** Words about the recording (countdown, time), shown in the drawing tab. */
  status: string;
  /** Stops the recording. The drawing tab has its own Stop button. */
  onStop: () => void;
}

export function DrawingBoard({ picture, layer, status, onStop }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<{ win: Window; root: HTMLElement } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<InkColor>('sunshine');
  const [fade, setFade] = useState(true);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [full, setFull] = useState(false);
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

  // Put the recording's picture in the pad.
  useEffect(() => {
    const box = holder.current;
    if (!box) return;
    picture.classList.add('draw-picture');
    picture.setAttribute('role', 'img');
    picture.setAttribute('aria-label', t.label);
    box.appendChild(picture);
  }, [picture, tab]);

  // Open the drawing tab and wait for its page, then move the pad into it.
  function openTab() {
    const win = window.open('/admin/annotate', TAB_NAME);
    if (!win) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    let tries = 0;
    const timer = window.setInterval(() => {
      tries++;
      let root: HTMLElement | null = null;
      try {
        if (win.location.pathname.startsWith('/admin/annotate') && win.document.readyState === 'complete') root = win.document.getElementById('annotate-root');
      } catch {
        // still loading
      }
      if (root) {
        window.clearInterval(timer);
        root.replaceChildren();
        win.document.title = `${t.heading} | Byte-Sized Buddies`;
        win.document.body.classList.add('annotate-live');
        // If the owner closes the tab, the picture comes home and the pad shows here again.
        win.addEventListener('pagehide', () => {
          if (picture.ownerDocument !== document) document.adoptNode(picture);
          setTab(null);
        });
        setTab({ win, root });
      } else if (tries > 150 || win.closed) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  // Right away: the tab opens as soon as the board appears (screen sharing has started).
  useEffect(() => {
    openTab();
  }, []);

  // If the tab is closed (Chrome doesn't always say so), bring the picture home and show the pad here again.
  useEffect(() => {
    if (!tab) return;
    const check = window.setInterval(() => {
      if (!tab.win.closed) return;
      if (picture.ownerDocument !== document) document.adoptNode(picture);
      setTab(null);
    }, 500);
    return () => window.clearInterval(check);
  }, [tab]);

  // The drawing tab closes when the recording stops.
  useEffect(() => () => tab?.win.close(), [tab]);

  // Drawing with the mouse, trackpad, or pen.
  useEffect(() => {
    const el = picture;
    const point = (e: PointerEvent) => toCanvasPoint(e.clientX, e.clientY, el.getBoundingClientRect(), el);
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Drawing still works without it; the line only stops at the edge of the picture.
      }
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
    // Dragging on the pad draws. It never selects, drags, or scrolls anything.
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('dragstart', block);
    el.addEventListener('wheel', block, { passive: false });
    el.addEventListener('touchmove', block, { passive: false });
    return () => {
      el.removeEventListener('dragstart', block);
      el.removeEventListener('wheel', block);
      el.removeEventListener('touchmove', block);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [picture]);

  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void padRef.current?.requestFullscreen().catch(() => {});
  }

  // Follow full screen on and off (Esc also leaves full screen).
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === padRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement === padRef.current) void document.exitFullscreen();
    };
  }, []);

  // Keyboard shortcuts. Typing in a box is left alone.
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
      else if (key === 'f' && e.view === window) toggleFull();
      else if (['1', '2', '3'].includes(key)) setColor(INK_COLORS[Number(key) - 1]);
      else return;
      e.preventDefault();
    };
    const windows = tab ? [window, tab.win] : [window];
    windows.forEach((w) => w.addEventListener('keydown', onKey));
    return () => windows.forEach((w) => w.removeEventListener('keydown', onKey));
  }, [tab]);

  // The drawings leave the recording when the board closes.
  useEffect(() => () => layer.getContext('2d')!.clearRect(0, 0, layer.width, layer.height), [layer]);

  const pad = (
      <div class={`draw-pad${full ? ' is-full' : ''}${tab ? ' is-tab' : ''}`} ref={padRef}>
        {tab && (
          <div class="draw-tabbar">
            <p class="draw-status" role="status">{status}</p>
            <button type="button" class="button button-primary" onClick={onStop}>
              <Icon name="stop" size={24} /> {t.stop}
            </button>
          </div>
        )}
        <div class="draw-holder" ref={holder} />
        <div class="draw-toolbar">
          {!tab && (
            <button type="button" class="draw-button draw-full-button" aria-keyshortcuts="F" onClick={toggleFull}>
              <Icon name="expand" size={24} />
              <span>{full ? t.exitFull : t.full}</span>
            </button>
          )}
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
        {/* One fixed line, so the picture never moves when this text changes. */}
        <p class="caption draw-keys">
          <span>{tab ? t.keysTab : t.keys}</span> <span role="status">{t.count(strokes.length)}</span>
        </p>
      </div>
  );

  return (
    <section class="draw-board" aria-labelledby="draw-title">
      <h3 id="draw-title">{t.heading}</h3>
      <ol class="draw-steps">
        {t.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {tab ? (
        <div class="button-row draw-tab-row">
          <p class="draw-tab-note">{t.tabOpen}</p>
          <button type="button" class="button button-primary" onClick={() => tab.win.focus()}>{t.goTab}</button>
          <button type="button" class="button button-secondary" onClick={() => tab.win.close()}>{t.closeTab}</button>
        </div>
      ) : (
        <>
          {blocked && (
            <p class="admin-message is-error" role="alert">
              <Icon name="alert" size={24} /> {t.tabBlocked}
            </p>
          )}
          <button type="button" class="button button-primary" onClick={openTab}>{t.openTab}</button>
        </>
      )}
      {tab ? createPortal(pad, tab.root) : pad}
    </section>
  );
}
