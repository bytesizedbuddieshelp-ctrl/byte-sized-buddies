import { describe, expect, it } from 'vitest';
import { parseYouTubeId, youTubeEmbedUrl } from '../src/lib/youtube';

const id = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it('accepts a bare ID', () => expect(parseYouTubeId(id)).toBe(id));
  it('accepts a watch link', () => expect(parseYouTubeId(`https://www.youtube.com/watch?v=${id}&t=10s`)).toBe(id));
  it('accepts a short link', () => expect(parseYouTubeId(`https://youtu.be/${id}?si=abc`)).toBe(id));
  it('accepts embed and shorts links', () => {
    expect(parseYouTubeId(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(parseYouTubeId(`https://youtube.com/shorts/${id}`)).toBe(id);
  });
  it('accepts a link typed without https', () => expect(parseYouTubeId(`youtu.be/${id}`)).toBe(id));
  it('rejects other websites', () => expect(parseYouTubeId(`https://evil.example/watch?v=${id}`)).toBeNull());
  it('rejects IDs of the wrong length or with odd characters', () => {
    expect(parseYouTubeId('short')).toBeNull();
    expect(parseYouTubeId('dQw4w9WgXc"><script>')).toBeNull();
  });
  it('treats empty input as no video', () => {
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
  });
});

describe('youTubeEmbedUrl', () => {
  it('uses the privacy-friendly address', () => expect(youTubeEmbedUrl(id)).toBe(`https://www.youtube-nocookie.com/embed/${id}`));
  it('refuses anything that is not an ID', () => expect(() => youTubeEmbedUrl('x" onload="y')).toThrow());
});
