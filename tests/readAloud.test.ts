import { describe, expect, it } from 'vitest';
import { splitForSpeech } from '../src/lib/readAloud';

describe('splitForSpeech', () => {
  it('returns nothing for empty text', () => {
    expect(splitForSpeech('   ')).toEqual([]);
  });
  it('keeps short text together', () => {
    expect(splitForSpeech('Hello there. Welcome.')).toEqual(['Hello there. Welcome.']);
  });
  it('splits long text at sentence ends, never past the limit', () => {
    const text = Array.from({ length: 20 }, (_, i) => `This is sentence number ${i + 1}.`).join(' ');
    const pieces = splitForSpeech(text, 100);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((p) => p.length <= 100)).toBe(true);
    expect(pieces.join(' ')).toBe(text);
  });
  it('cuts one very long sentence at spaces', () => {
    const long = 'word '.repeat(120).trim() + '.';
    const pieces = splitForSpeech(long, 80);
    expect(pieces.every((p) => p.length <= 80)).toBe(true);
    expect(pieces.join(' ').replace(/\s+/g, ' ')).toBe(long);
  });
});
