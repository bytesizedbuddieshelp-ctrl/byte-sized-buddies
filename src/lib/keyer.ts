// Replacing a plain wall behind the owner with a background picture (a "color key"), without a green screen.
// Pure functions on pixel arrays (RGBA, 4 numbers per pixel), so they can be tested without a camera.
//
// Each pixel is compared with the wall's color by its *color* (Cb and Cr in the YCbCr color space) more than
// by its brightness (Y). A wall with a shadow is darker but still the same color, so it is still removed.

export type RGB = [number, number, number];
export interface KeyColor {
  y: number;
  cb: number;
  cr: number;
}

/** Brightness matters less than color, so shadows on the wall are still removed. */
const BRIGHTNESS_WEIGHT = 0.3;

export function toKeyColor([r, g, b]: RGB): KeyColor {
  return {
    y: 0.299 * r + 0.587 * g + 0.114 * b,
    cb: 128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
    cr: 128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
  };
}

/** How different a pixel is from the wall: 0 means the same; bigger means more different. */
export function keyDistance(r: number, g: number, b: number, key: KeyColor): number {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return Math.hypot(cb - key.cb, cr - key.cr) + BRIGHTNESS_WEIGHT * Math.abs(y - key.y);
}

/**
 * How much of the person to keep at this pixel: 0 = all background, 1 = all person.
 * tolerance: distances up to this are wall. softness: the width of the soft edge after that.
 */
export function keepAmount(distance: number, tolerance: number, softness: number): number {
  if (distance <= tolerance) return 0;
  if (distance >= tolerance + softness) return 1;
  return (distance - tolerance) / softness;
}

/** Writes camera pixels over background pixels into out, removing everything close to the wall color. */
export function applyKey(camera: Uint8ClampedArray, background: Uint8ClampedArray, out: Uint8ClampedArray, key: KeyColor, tolerance: number, softness: number): void {
  const soft = Math.max(1, softness);
  for (let i = 0; i < camera.length; i += 4) {
    const r = camera[i];
    const g = camera[i + 1];
    const b = camera[i + 2];
    const keep = keepAmount(keyDistance(r, g, b, key), tolerance, soft);
    const away = 1 - keep;
    out[i] = r * keep + background[i] * away;
    out[i + 1] = g * keep + background[i + 1] * away;
    out[i + 2] = b * keep + background[i + 2] * away;
    out[i + 3] = 255;
  }
}

/** The average color of a small square around (x, y), to pick the wall color from a click. */
export function averageColor(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, radius = 6): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) {
      const i = (yy * width + xx) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [0, 0, 0];
}
