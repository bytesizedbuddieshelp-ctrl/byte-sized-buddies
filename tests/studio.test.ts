import { describe, expect, it } from 'vitest';
import { bubbleRect, buildSegments, extensionFor, formatDuration, loudness, pickMimeType, settingVideoId, studioSupport, takeFileName } from '../src/lib/studio';

const labels = { opener: 'Opener', main: 'Main', closer: 'Closer' };
const A = 'dQw4w9WgXcQ';
const B = 'abcdefghijk';

describe('recording format', () => {
  it('prefers MP4, then falls back to WebM', () => {
    expect(pickMimeType(() => true)).toBe('video/mp4;codecs=avc1,mp4a.40.2');
    expect(pickMimeType((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus');
    expect(pickMimeType(() => false)).toBeNull();
  });
  it('names files by lesson, part, and take', () => {
    expect(takeFileName('Week 3: Photos', 'opener', 2, 'video/mp4')).toBe('week-3-photos-opener-take-2.mp4');
    expect(takeFileName('', 'main', 1, 'video/webm;codecs=vp9')).toBe('video-main-take-1.webm');
    expect(extensionFor('video/webm')).toBe('webm');
  });
  it('shows times as minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_400)).toBe('1:05');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('browser support', () => {
  it('needs a recorder and a camera for anything, and screen sharing for the main part', () => {
    const rec = function () {};
    const fn = () => {};
    expect(studioSupport({})).toEqual({ camera: false, screen: false });
    expect(studioSupport({ MediaRecorder: rec, mediaDevices: { getUserMedia: fn } })).toEqual({ camera: true, screen: false });
    expect(studioSupport({ MediaRecorder: rec, mediaDevices: { getUserMedia: fn, getDisplayMedia: fn } })).toEqual({ camera: true, screen: true });
  });
});

describe('sound level words', () => {
  it('turns a level into words', () => {
    expect(loudness(0)).toBe('silent');
    expect(loudness(0.05)).toBe('quiet');
    expect(loudness(0.3)).toBe('good');
    expect(loudness(0.9)).toBe('loud');
  });
});

describe('camera bubble', () => {
  it('sits inside the bottom-right corner', () => {
    const r = bubbleRect(1920, 1080);
    expect(r.size).toBe(270);
    expect(r.x + r.size).toBeLessThan(1920);
    expect(r.y + r.size).toBeLessThan(1080);
  });
});

describe('publishing links', () => {
  it('keeps the parts in order and skips empty ones', () => {
    const { segments, problems } = buildSegments({ opener: '', main: `https://youtu.be/${A}`, closer: B }, labels);
    expect(problems).toEqual([]);
    expect(segments).toEqual([
      { youtube_id: A, label: 'Main' },
      { youtube_id: B, label: 'Closer' },
    ]);
  });
  it('needs a main part and readable links', () => {
    expect(buildSegments({ opener: 'not a link', main: '', closer: '' }, labels).problems).toEqual([
      { field: 'opener', kind: 'bad' },
      { field: 'main', kind: 'missing' },
    ]);
  });
  it('reads saved standard videos safely', () => {
    expect(settingVideoId(A)).toBe(A);
    expect(settingVideoId(null)).toBeNull();
    expect(settingVideoId({ id: A })).toBeNull();
    expect(settingVideoId('<script>')).toBeNull();
  });
});
