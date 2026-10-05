import { useEffect, useRef, useState } from 'preact/hooks';
import { adminCopy as a } from '../../../content/adminCopy';
import { brandColor } from '../../../lib/backgrounds';
import { INK_COLORS, TOOLS, renderStrokes, toCanvasPoint, type InkColor, type Stroke, type Tool } from '../../../lib/drawing';

const t = a.studio.board;

// While the main part records: the owner's screen as it is being recorded, to draw on.
// `picture` is the recording itself (drawn by the studio). `layer` is the see-through drawing layer that the
// recording copies on top of the screen 30 times a second.
export function DrawingBoard({ picture, layer }: { picture: HTMLCanvasElement; layer: HTMLCanvasElement }) {
  const holder = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<InkColor>('sunshine');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const [colors] = useState(() => ({ sunshine: brandColor('sunshine'), forest: brandColor('forest'), paper: brandColor('paper') }));
  const [outline] = useState(() => brandColor('ink'));

  const paint = (list: Stroke[]) => renderStrokes(layer.getContext('2d')!, list, colors, outline);

  // Show the recording's picture on the page. It is the same canvas that is recorded.
  useEffect(() => {
    const box = holder.current;
    if (!box) return;
    picture.classList.add('draw-picture');
    picture.setAttribute('role', 'img');
    picture.setAttribute('aria-label', t.label);
    box.appendChild(picture);
    return () => {
      picture.remove();
    };
  }, [picture]);

  useEffect(() => paint(strokes), [strokes]);

  useEffect(() => {
    const el = picture;
    const point = (e: PointerEvent) => toCanvasPoint(e.clientX, e.clientY, el.getBoundingClientRect(), el);
    const down = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      drawing.current = { tool, color, points: [point(e), point(e)] };
    };
    const move = (e: PointerEvent) => {
      const stroke = drawing.current;
      if (!stroke) return;
      if (stroke.tool === 'pen' || stroke.tool === 'highlighter') stroke.points.push(point(e));
      else stroke.points[1] = point(e);
      paint([...strokes, stroke]);
    };
    const up = () => {
      const stroke = drawing.current;
      drawing.current = null;
      if (stroke) setStrokes((list) => [...list, stroke]);
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
  }, [picture, tool, color, strokes]);

  // The drawings leave the recording when the board closes.
  useEffect(() => () => layer.getContext('2d')!.clearRect(0, 0, layer.width, layer.height), [layer]);

  return (
    <section class="draw-board" aria-labelledby="draw-title">
      <h3 id="draw-title">{t.heading}</h3>
      <p class="caption">{t.tip}</p>
      <div class="draw-tools">
        <fieldset class="chips">
          <legend>{t.tools}</legend>
          {TOOLS.map((x) => (
            <button key={x} type="button" class="chip" aria-pressed={tool === x} onClick={() => setTool(x)}>
              {t.tool[x]}
            </button>
          ))}
        </fieldset>
        <fieldset class="chips">
          <legend>{t.colors}</legend>
          {INK_COLORS.map((c) => (
            <button key={c} type="button" class="chip draw-color" aria-pressed={color === c} onClick={() => setColor(c)}>
              <span class="draw-dot" style={{ background: colors[c] }} aria-hidden="true" /> {t.color[c]}
            </button>
          ))}
        </fieldset>
        <div class="button-row">
          <button type="button" class="button button-secondary" disabled={strokes.length === 0} onClick={() => setStrokes((list) => list.slice(0, -1))}>
            {t.undo}
          </button>
          <button type="button" class="button button-primary" disabled={strokes.length === 0} onClick={() => setStrokes([])}>
            {t.clear}
          </button>
        </div>
        <p class="caption" role="status">{t.count(strokes.length)}</p>
      </div>
      <div class="draw-holder" ref={holder} />
    </section>
  );
}
