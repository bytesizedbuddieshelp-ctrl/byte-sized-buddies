import { describe, expect, it } from 'vitest';
import { countWords, imageFilesIn, parseDeckText, validateDeck } from '../src/lib/slides';

const ok = (slides: unknown[]) => validateDeck({ version: 1, slides });

describe('validateDeck', () => {
  it('accepts a deck that uses every layout', () => {
    const result = ok([
      { layout: 'title', title: 'Calling a Friend', subtitle: 'Week 1', notes: 'Welcome everyone.' },
      { layout: 'idea', title: 'The green phone', body: ['It opens your calls.'], image: { file: 'phone-home.png', alt: 'A phone home screen' } },
      { layout: 'step', step: 1, title: 'Tap Contacts', body: ['Find the person icon.'], image: { file: 'contacts.png', alt: 'Contacts' } },
      { layout: 'tryit', title: 'Try it now', body: ['Find a name. Tap it.'], timer_minutes: 5 },
      { layout: 'recap', title: 'Today you learned', bullets: ['Open Contacts.', 'Tap a name.'] },
      { layout: 'keepit', title: 'Keep it', body: ['Take your handout home.'] },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.deck?.slides).toHaveLength(6);
    expect(imageFilesIn(result.deck!)).toEqual(['phone-home.png', 'contacts.png']);
  });

  it('names the slide number in every error', () => {
    const result = ok([
      { layout: 'idea', title: 'Fine', body: ['ok'] },
      { layout: 'idea', title: '' },
      { layout: 'step', title: 'No number', body: ['x'] },
      { layout: 'recap', title: 'Too many', bullets: ['a', 'b', 'c', 'd', 'e'] },
      { layout: 'banner', title: 'Mystery' },
    ]);
    expect(result.deck).toBeNull();
    const text = result.errors.join('\n');
    expect(text).toContain('Slide 2');
    expect(text).toContain('Slide 3');
    expect(text).toContain('Slide 4');
    expect(text).toContain('Slide 5');
    expect(text).not.toContain('Slide 1 ');
  });

  it('warns, but does not fail, for long bodies and missing alt text', () => {
    const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
    const result = ok([
      { layout: 'idea', title: 'Long', body: [long], image: { file: 'a.png', alt: '' } },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toContain('30 words');
    expect(result.warnings.join('\n')).toContain('no alt text');
  });

  it('refuses unsafe image names', () => {
    for (const file of ['../secret.png', 'a b.png', 'script.js', 'folder/x.png', 'x.png.exe']) {
      const result = ok([{ layout: 'idea', title: 'T', body: ['b'], image: { file, alt: 'x' } }]);
      expect(result.errors.length, file).toBeGreaterThan(0);
    }
  });

  it('checks the top of the deck', () => {
    expect(validateDeck(null).errors).toHaveLength(1);
    expect(validateDeck({ version: 2, slides: [] }).errors.join()).toContain('version');
    expect(validateDeck({ version: 1 }).errors.join()).toContain('"slides"');
    expect(ok(Array.from({ length: 61 }, () => ({ layout: 'title', title: 'x' }))).errors.join()).toContain('61 slides');
  });

  it('drops keys it does not know', () => {
    const deck = ok([{ layout: 'title', title: 'Hi', onclick: 'steal()', body: undefined }]).deck!;
    expect(Object.keys(deck.slides[0]).sort()).toEqual(['layout', 'title']);
  });

  it('limits the timer to whole minutes on tryit slides', () => {
    expect(ok([{ layout: 'tryit', title: 'T', body: ['b'], timer_minutes: 0 }]).errors.join()).toContain('timer_minutes');
    expect(ok([{ layout: 'tryit', title: 'T', body: ['b'], timer_minutes: 2.5 }]).errors.join()).toContain('timer_minutes');
    expect(ok([{ layout: 'idea', title: 'T', body: ['b'], timer_minutes: 5 }]).warnings.join()).toContain('ignored');
  });
});

describe('parseDeckText', () => {
  it('turns a typing mistake into plain words', () => {
    const result = parseDeckText('{"version": 1, "slides": [,]}');
    expect(result.deck).toBeNull();
    expect(result.errors[0]).toContain('typing mistake');
    expect(result.errors[0]).not.toContain('Unexpected');
  });
  it('reads good text', () => {
    expect(parseDeckText('{"version":1,"slides":[{"layout":"title","title":"Hi"}]}').deck?.slides).toHaveLength(1);
  });
});

describe('countWords', () => {
  it('counts across lines', () => expect(countWords(['one two', ' three  '])).toBe(3));
  it('handles nothing', () => expect(countWords(undefined)).toBe(0));
});
