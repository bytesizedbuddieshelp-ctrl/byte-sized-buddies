import { describe, expect, it } from 'vitest';
import { pagePictureName } from '../src/lib/pdfPages';

describe('pagePictureName', () => {
  it('names each page after its PDF', () => {
    expect(pagePictureName('my-handout.pdf', 2)).toBe('my-handout-page-2.png');
  });
  it('cleans names the website would refuse', () => {
    expect(pagePictureName('Week 1 Handout (final).PDF', 1)).toBe('Week-1-Handout-final-page-1.png');
  });
});
