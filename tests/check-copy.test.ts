import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain JavaScript file
import { findBanned } from '../scripts/check-copy.mjs';

const words = (text: string, ext = '.astro') => findBanned(text, ext).map((hit: { word: string }) => hit.word.toLowerCase());

describe('findBanned', () => {
  it('finds the banned words, in any case', () => {
    expect(words('<p>It is Easy. Just tap it. Simply do it, easily. Obviously. Basically.</p>')).toEqual([
      'easy', 'just', 'simply', 'easily', 'obviously', 'basically',
    ]);
  });
  it('finds words we never use for older adults', () => {
    expect(words('Seniors and elderly people. Not tech illiterate.')).toEqual(['seniors', 'elderly', 'tech illiterate']);
  });
  it('allows "senior homes"', () => expect(words('For senior homes')).toEqual([]));
  it('ignores whole-word lookalikes and code names', () => {
    expect(words('justify-content: center; const isSimple = 1; user.easy; my_just')).toEqual([]);
  });
  it('ignores comments', () => {
    expect(words('<!-- easy -->\n/* simple */\n// just a note')).toEqual([]);
    expect(words('<!-- just a note -->', '.md')).toEqual([]);
  });
  it('keeps web addresses safe from the comment rule', () => {
    expect(words('Visit https://example.com/just-now just now')).toEqual(['just']);
  });
  it('reports the right line number', () => {
    expect(findBanned('one\ntwo\nthree is easy', '.md')[0].line).toBe(3);
  });
});
