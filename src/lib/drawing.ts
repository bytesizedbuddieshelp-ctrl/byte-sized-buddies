// Drawing on the screen recording (the studio's main part): pen, highlighter, arrow, and circle.
// Points are in the recording's own pixels, so a drawing lands exactly where it was made.

export type Tool = 'pen' | 'highlighter' | 'arrow' | 'circle';
export const TOOLS: Tool[] = ['pen', 'highlighter', 'arrow', 'circle'];
export type InkColor = 'sunshine' | 'forest' | 'paper';
export const INK_COLORS: InkColor[] = ['sunshine', 'forest', 'paper'];

export type Point = [number, number];

export interface Stroke {
  tool: Tool;
  color: InkColor;
  points: Point[];
  /** When the stroke was finished (milliseconds), for fading lines. */
  at?: number;
  /** 0 (gone) to 1 (fully drawn). */
  opacity?: number;
}

/** Fading lines stay for HOLD_MS, then fade out over FADE_MS. */
export const HOLD_MS = 3000;
export const FADE_MS = 800;

/** How visible a fading line is, by its age: 1 while it holds, then down to 0. */
export function fadeOpacity(ageMs: number, hold = HOLD_MS, fade = FADE_MS): number {
  if (ageMs <= hold) return 1;
  return Math.max(0, 1 - (ageMs - hold) / fade);
}

/** The keyboard shortcuts on the drawing pad. */
export const TOOL_KEYS: Record<string, Tool> = { p: 'pen', h: 'highlighter', a: 'arrow', c: 'circle' };

/** Line widths grow with the size of the recording, so they look the same at any size. */
export function lineWidth(tool: Tool, canvasWidth: number): number {
  const base = Math.max(4, canvasWidth * 0.006);
  return tool === 'highlighter' ? base * 6 : base;
}

/** The two back corners of an arrow head at `to`, pointing away from `from`. */
export function arrowHead(from: Point, to: Point, size: number): [Point, Point] {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const spread = Math.PI / 7;
  return [
    [to[0] - size * Math.cos(angle - spread), to[1] - size * Math.sin(angle - spread)],
    [to[0] - size * Math.cos(angle + spread), to[1] - size * Math.sin(angle + spread)],
  ];
}

/** A circle (an ellipse) that fits the box dragged from one corner to the other. */
export function ellipseIn(a: Point, b: Point): { cx: number; cy: number; rx: number; ry: number } {
  return { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, rx: Math.abs(b[0] - a[0]) / 2, ry: Math.abs(b[1] - a[1]) / 2 };
}

/** Converts a pointer position on the shown picture into the recording's pixels. */
export function toCanvasPoint(clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }, canvas: { width: number; height: number }): Point {
  return [((clientX - box.left) / box.width) * canvas.width, ((clientY - box.top) / box.height) * canvas.height];
}

function path(g: CanvasRenderingContext2D, stroke: Stroke, headSize: number) {
  const pts = stroke.points;
  g.beginPath();
  if (stroke.tool === 'circle') {
    const e = ellipseIn(pts[0], pts[pts.length - 1]);
    g.ellipse(e.cx, e.cy, Math.max(1, e.rx), Math.max(1, e.ry), 0, 0, Math.PI * 2);
    return;
  }
  const from = pts[0];
  const to = pts[pts.length - 1];
  if (stroke.tool === 'arrow') {
    g.moveTo(from[0], from[1]);
    g.lineTo(to[0], to[1]);
    const [l, r] = arrowHead(from, to, headSize);
    g.moveTo(l[0], l[1]);
    g.lineTo(to[0], to[1]);
    g.lineTo(r[0], r[1]);
    return;
  }
  g.moveTo(from[0], from[1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
}

/**
 * Draws every stroke onto the (transparent) drawing layer. colors maps each ink to a real color.
 * Pens, arrows, and circles get a thin dark outline, so yellow and white show up on light screens too.
 */
export function renderStrokes(g: CanvasRenderingContext2D, strokes: Stroke[], colors: Record<InkColor, string>, outline: string): void {
  const { width, height } = g.canvas;
  g.clearRect(0, 0, width, height);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const stroke of strokes) {
    const visible = stroke.opacity ?? 1;
    if (stroke.points.length === 0 || visible <= 0) continue;
    const w = lineWidth(stroke.tool, width);
    if (stroke.tool === 'highlighter') {
      g.globalAlpha = 0.35 * visible;
      g.lineWidth = w;
      g.strokeStyle = colors[stroke.color];
      path(g, stroke, w * 5);
      g.stroke();
      g.globalAlpha = 1;
      continue;
    }
    g.lineWidth = w + Math.max(2, w * 0.6);
    // The same head size for the outline and the color, so the outline stays a thin edge.
    g.globalAlpha = visible;
    g.strokeStyle = outline;
    path(g, stroke, w * 5);
    g.stroke();
    g.lineWidth = w;
    g.strokeStyle = colors[stroke.color];
    path(g, stroke, w * 5);
    g.stroke();
    g.globalAlpha = 1;
  }
}
