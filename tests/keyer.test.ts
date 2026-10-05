import { describe, expect, it } from 'vitest';
import { applyKey, averageColor, keepAmount, keyDistance, toKeyColor, type RGB } from '../src/lib/keyer';

const wall: RGB = [150, 180, 210]; // a pale blue wall
const key = toKeyColor(wall);
const pixels = (...colors: RGB[]) => new Uint8ClampedArray(colors.flatMap((c) => [...c, 255]));

describe('wall color key', () => {
  it('sees the wall as the wall, even in shadow', () => {
    expect(keyDistance(...wall, key)).toBeCloseTo(0, 5);
    const shadow = keyDistance(105, 126, 147, key); // the same wall at 70% brightness
    const skin = keyDistance(224, 172, 140, key);
    expect(shadow).toBeLessThan(25);
    expect(skin).toBeGreaterThan(40);
  });

  it('keeps the person, removes the wall, and blends the edge', () => {
    expect(keepAmount(5, 20, 10)).toBe(0);
    expect(keepAmount(25, 20, 10)).toBeCloseTo(0.5);
    expect(keepAmount(40, 20, 10)).toBe(1);
  });

  it('puts the background where the wall was', () => {
    const camera = pixels(wall, [224, 172, 140]);
    const background = pixels([250, 247, 240], [250, 247, 240]);
    const out = new Uint8ClampedArray(camera.length);
    applyKey(camera, background, out, key, 20, 10);
    expect([...out.slice(0, 4)]).toEqual([250, 247, 240, 255]);
    expect([...out.slice(4, 8)]).toEqual([224, 172, 140, 255]);
  });

  it('averages a small square to pick the wall color', () => {
    const data = pixels([100, 100, 100], [200, 200, 200], [100, 100, 100], [200, 200, 200]);
    expect(averageColor(data, 2, 2, 0, 0, 1)).toEqual([150, 150, 150]);
  });
});
