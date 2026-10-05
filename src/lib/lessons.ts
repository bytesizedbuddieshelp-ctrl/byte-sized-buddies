import { supabaseUrl } from './config';
import { restGet } from './publicApi';
import type { SlideDeck } from './slides';

export const BUCKET = 'lesson-files';
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // the free plan holds about 1 GB

export interface StoredFile {
  path: string;
  bytes: number;
}

export interface LessonFiles {
  worksheet?: StoredFile;
  handout?: StoredFile;
  answer_key?: StoredFile;
  teacher_guide_pdf?: StoredFile;
  images?: (StoredFile & { name: string })[];
}

export interface VideoSegment {
  youtube_id: string;
  label: string;
}

export interface Lesson {
  id: string;
  slug: string;
  week_number: number | null;
  title: string;
  summary: string | null;
  topic: string | null;
  devices: string[];
  level: 'beginner' | 'intermediate';
  duration_minutes: number;
  objectives: string[];
  slides: SlideDeck;
  teacher_guide_md: string | null;
  video_script_md: string | null;
  files: LessonFiles;
  video_ids: VideoSegment[];
  license: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The public web address of a file in the lesson-files bucket. */
export function fileUrl(path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function lessonFolder(slug: string): string {
  return `lessons/${slug}`;
}

export function imageUrlFor(lesson: Pick<Lesson, 'slug' | 'files'>, file: string): string {
  const found = lesson.files.images?.find((image) => image.name === file);
  return fileUrl(found ? found.path : `${lessonFolder(lesson.slug)}/${file}`);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface Download {
  key: 'teacher_guide_pdf' | 'worksheet' | 'handout' | 'answer_key';
  label: string;
  file: StoredFile;
}

const downloadLabels: Record<Download['key'], string> = {
  teacher_guide_pdf: 'Teacher guide',
  worksheet: 'Worksheet',
  handout: 'Handout',
  answer_key: 'Answer key',
};

export function downloadsFor(files: LessonFiles): Download[] {
  return (['teacher_guide_pdf', 'worksheet', 'handout', 'answer_key'] as const).flatMap((key) =>
    files[key] ? [{ key, label: downloadLabels[key], file: files[key]! }] : [],
  );
}

/** All the bytes this lesson keeps in storage. */
export function lessonBytes(files: LessonFiles): number {
  const slots = (['worksheet', 'handout', 'answer_key', 'teacher_guide_pdf'] as const).reduce((sum, key) => sum + (files[key]?.bytes ?? 0), 0);
  return slots + (files.images ?? []).reduce((sum, image) => sum + image.bytes, 0);
}

export const deviceWords: Record<string, string> = { iphone: 'iPhone', android: 'Android', any: 'Any device' };
export const levelWords: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate' };

export function sortByWeek<T extends { week_number: number | null; title: string }>(lessons: T[]): T[] {
  return [...lessons].sort((a, b) => (a.week_number ?? 999) - (b.week_number ?? 999) || a.title.localeCompare(b.title));
}

/** Published lessons, as a stranger sees them. */
export async function fetchPublishedLessons(limit = 200): Promise<Lesson[]> {
  const rows = await restGet<Lesson[]>(`lessons?select=*&status=eq.published&order=week_number.asc&limit=${limit}`);
  return sortByWeek(rows);
}

export async function fetchPublishedLesson(slug: string): Promise<Lesson | null> {
  const rows = await restGet<Lesson[]>(`lessons?select=*&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`);
  return rows[0] ?? null;
}

/** Lessons whose devices include this one (a lesson for "any" device matches every device). */
export function matchesDevice(lesson: Pick<Lesson, 'devices'>, device: string): boolean {
  return lesson.devices.includes(device) || lesson.devices.includes('any');
}
