// Pure helpers for the video studio (no camera or browser needed, so they can be tested).
import { slugify, type VideoSegment } from './lessons';
import { parseYouTubeId } from './youtube';

export type Part = 'opener' | 'main' | 'closer';
export const PARTS: Part[] = ['opener', 'main', 'closer'];

// MP4 first: it plays on any computer (QuickTime, Windows) and YouTube accepts it.
// Older Chrome and Firefox only record WebM, which YouTube also accepts.
export const MIME_CHOICES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickMimeType(isSupported: (type: string) => boolean): string | null {
  return MIME_CHOICES.find((type) => isSupported(type)) ?? null;
}

export function extensionFor(mime: string): 'mp4' | 'webm' {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

/** For example "week-3-photos-opener-take-2.mp4". */
export function takeFileName(base: string, part: Part, take: number, mime: string): string {
  const name = slugify(base) || 'video';
  return `${name}-${part}-take-${take}.${extensionFor(mime)}`;
}

/** 65000 -> "1:05". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface Support {
  /** Can record from the camera and microphone. */
  camera: boolean;
  /** Can also record the screen (desktop browsers only). */
  screen: boolean;
}

export function studioSupport(env: { MediaRecorder?: unknown; mediaDevices?: { getUserMedia?: unknown; getDisplayMedia?: unknown } }): Support {
  const camera = typeof env.MediaRecorder === 'function' && typeof env.mediaDevices?.getUserMedia === 'function';
  return { camera, screen: camera && typeof env.mediaDevices?.getDisplayMedia === 'function' };
}

export type Loudness = 'silent' | 'quiet' | 'good' | 'loud';

/** level is the microphone's loudness from 0 (silence) to 1 (as loud as it goes). */
export function loudness(level: number): Loudness {
  if (level < 0.02) return 'silent';
  if (level < 0.08) return 'quiet';
  if (level < 0.6) return 'good';
  return 'loud';
}

/** Where the small round camera picture sits on a screen recording: bottom right, with a margin. */
export function bubbleRect(width: number, height: number): { x: number; y: number; size: number } {
  const size = Math.round(Math.min(width, height) * 0.25);
  const margin = Math.round(Math.min(width, height) * 0.04);
  return { x: width - size - margin, y: height - size - margin, size };
}

export interface PublishInput {
  opener: string;
  main: string;
  closer: string;
}

export type PublishProblem = { field: Part; kind: 'bad' | 'missing' };

/** Turns the three link boxes into an ordered list of parts. Only the main part is required. */
export function buildSegments(input: PublishInput, labels: Record<Part, string>): { segments: VideoSegment[]; problems: PublishProblem[] } {
  const segments: VideoSegment[] = [];
  const problems: PublishProblem[] = [];
  for (const part of PARTS) {
    const text = input[part].trim();
    if (!text) {
      if (part === 'main') problems.push({ field: part, kind: 'missing' });
      continue;
    }
    const id = parseYouTubeId(text);
    if (!id) problems.push({ field: part, kind: 'bad' });
    else segments.push({ youtube_id: id, label: labels[part] });
  }
  return { segments, problems };
}

/** A setting from the database holds a YouTube ID as a JSON string, or null. Anything else counts as "not set". */
export function settingVideoId(value: unknown): string | null {
  return typeof value === 'string' ? parseYouTubeId(value) : null;
}
