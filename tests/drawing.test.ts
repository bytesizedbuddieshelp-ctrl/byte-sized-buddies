import { describe, expect, it } from 'vitest';
import { arrowHead, ellipseIn, lineWidth, toCanvasPoint } from '../src/lib/drawing';

describe('drawing on the recording', () => {
  it('maps a click on the small picture to the recording pixels', () => {
    const box = { left: 100, top: 50, width: 640, height: 360 };
    expect(toCanvasPoint(420, 230, box, { width: 1920, height: 1080 })).toEqual([960, 540]);
  });

  it('points the arrow head back along the arrow', () => {
    const [l, r] = arrowHead([0, 0], [100, 0], 20);
    expect(l[0]).toBeLessThan(100);
    expect(r[0]).toBeLessThan(100);
    expect(l[1]).toBeCloseTo(-r[1]);
  });

  it('fits a circle in the dragged box, whichever way it was dragged', () => {
    expect(ellipseIn([10, 20], [110, 80])).toEqual({ cx: 60, cy: 50, rx: 50, ry: 30 });
    expect(ellipseIn([110, 80], [10, 20])).toEqual({ cx: 60, cy: 50, rx: 50, ry: 30 });
  });

  it('makes the highlighter wider than the pen, and lines grow with the picture', () => {
    expect(lineWidth('highlighter', 1920)).toBeGreaterThan(lineWidth('pen', 1920));
    expect(lineWidth('pen', 3840)).toBeGreaterThan(lineWidth('pen', 1920));
  });
});
