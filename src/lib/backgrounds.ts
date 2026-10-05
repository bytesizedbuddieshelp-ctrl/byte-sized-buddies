// Backgrounds for the studio's "Replace my wall" option, drawn in the brand style: flat shapes, no gradients.
// Colors come from the brand tokens (brand/tokens.css) and the logo comes from its file, never redrawn.

export type BackgroundKind = 'garden' | 'forest' | 'cream' | 'custom';
export const BACKGROUND_KINDS: BackgroundKind[] = ['garden', 'forest', 'cream', 'custom'];

/** A brand color from the page's CSS variables, for example brandColor('forest'). */
export function brandColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

const marks: Partial<Record<'light' | 'dark', Promise<HTMLImageElement>>> = {};
function mark(onDark: boolean): Promise<HTMLImageElement> {
  const key = onDark ? 'dark' : 'light';
  marks[key] ??= loadImage(onDark ? '/logos/byte-sized-buddies-mark-reversed.svg' : '/logos/byte-sized-buddies-mark.svg');
  return marks[key]!;
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** Draws a background onto a canvas of any size. "custom" needs the owner's picture. */
export async function drawBackground(canvas: HTMLCanvasElement, kind: BackgroundKind, custom?: HTMLImageElement | null): Promise<void> {
  const g = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  if (kind === 'custom' && custom) {
    // Fill the frame, cropping the picture's edges if its shape is different.
    const scale = Math.max(w / custom.naturalWidth, h / custom.naturalHeight);
    const cw = custom.naturalWidth * scale;
    const ch = custom.naturalHeight * scale;
    g.drawImage(custom, (w - cw) / 2, (h - ch) / 2, cw, ch);
    return;
  }

  // The dark background uses --forest, the same green as the square in the reversed logo file, so they blend.
  const dark = kind === 'forest';
  g.fillStyle = brandColor(dark ? 'forest' : 'cream');
  g.fillRect(0, 0, w, h);

  if (kind !== 'cream') {
    const shape = brandColor(dark ? 'forest-deep' : 'forest-tint');
    // Two big soft shapes in opposite corners, leaving the middle calm for the person.
    circle(g, w * 0.02, h * 1.02, h * 0.55, shape);
    circle(g, w * 1.0, h * -0.05, h * 0.42, shape);
    circle(g, w * 0.86, h * 0.3, h * 0.045, brandColor('sunshine'));
  }

  // The logo mark, top left, with clear space around it.
  try {
    const logo = await mark(dark);
    const size = Math.round(h * 0.11);
    const margin = Math.round(h * 0.05);
    g.drawImage(logo, margin, margin, size, size);
  } catch {
    // A background without the logo is still fine.
  }
}
