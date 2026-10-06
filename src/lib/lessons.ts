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
  /** Extra worksheets for when there is time left over, in order. */
  extras?: ExtraFile[];
}

export interface ExtraFile extends StoredFile {
  name: string;
  title: string;
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

/** The lesson's extra worksheets, skipping anything that doesn't look right. */
export function extrasFor(files: LessonFiles): ExtraFile[] {
  return Array.isArray(files.extras) ? files.extras.filter((e) => e && typeof e.path === 'string' && typeof e.title === 'string') : [];
}

/** All the bytes this lesson keeps in storage. */
export function lessonBytes(files: LessonFiles): number {
  const slots = (['worksheet', 'handout', 'answer_key', 'teacher_guide_pdf'] as const).reduce((sum, key) => sum + (files[key]?.bytes ?? 0), 0);
  const extras = extrasFor(files).reduce((sum, extra) => sum + extra.bytes, 0);
  return slots + extras + (files.images ?? []).reduce((sum, image) => sum + image.bytes, 0);
}

export const deviceWords: Record<string, string> = { iphone: 'iPhone', android: 'Android', any: 'Any device' };
export const levelWords: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate' };

export function sortByWeek<T extends { week_number: number | null; title: string }>(lessons: T[]): T[] {
  return [...lessons].sort((a, b) => (a.week_number ?? 999) - (b.week_number ?? 999) || a.title.localeCompare(b.title));
}

/** The light version of a lesson: enough for cards, filters, and next/previous links, without the slides or the guide. */
export type LessonSummary = Pick<
  Lesson,
  'id' | 'slug' | 'week_number' | 'title' | 'summary' | 'topic' | 'devices' | 'level' | 'duration_minutes' | 'objectives' | 'published_at'
>;

const summaryColumns = 'id,slug,week_number,title,summary,topic,devices,level,duration_minutes,objectives,published_at';

/** Every published lesson, in light form. Much smaller than fetchPublishedLessons, so lists load fast. */
export async function fetchLessonIndex(limit = 200): Promise<LessonSummary[]> {
  const rows = await restGet<LessonSummary[]>(`lessons?select=${summaryColumns}&status=eq.published&order=week_number.asc&limit=${limit}`);
  return sortByWeek(rows);
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

/** What is still missing before a lesson is ready to teach. Words for the owner, in the order to fix them. */
export function missingParts(
  lesson: Pick<Lesson, 'summary' | 'objectives' | 'teacher_guide_md' | 'files'> & { slides?: SlideDeck | null },
): string[] {
  const missing: string[] = [];
  if (!lesson.summary?.trim()) missing.push('a one-line summary');
  if (!lesson.objectives || lesson.objectives.length === 0) missing.push('"What you\'ll be able to do" list');
  if (!lesson.slides?.slides?.length) missing.push('slides');
  if (!lesson.teacher_guide_md?.trim()) missing.push('a teacher guide');
  if (!lesson.files?.handout) missing.push('a handout');
  if (!lesson.files?.worksheet) missing.push('a worksheet');
  return missing;
}

/** A web address for a copy of a lesson that nothing else uses: week-01-copy, then week-01-copy-2, and so on. */
export function copySlug(slug: string, taken: string[]): string {
  const base = `${slug.replace(/-copy(-\d+)?$/, '')}-copy`.slice(0, 70);
  if (!taken.includes(base)) return base;
  for (let n = 2; n < 1000; n++) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now()}`;
}

/** The same files record, pointing at a different lesson folder. */
export function moveFilePaths(files: LessonFiles, from: string, to: string): LessonFiles {
  const folder = (slug: string) => `lessons/${slug}/`;
  const move = <T extends StoredFile>(file: T): T => ({ ...file, path: file.path.startsWith(folder(from)) ? folder(to) + file.path.slice(folder(from).length) : file.path });
  const out: LessonFiles = {};
  for (const key of ['worksheet', 'handout', 'answer_key', 'teacher_guide_pdf'] as const) if (files[key]) out[key] = move(files[key]!);
  if (files.images) out.images = files.images.map(move);
  if (files.extras) out.extras = files.extras.map(move);
  return out;
}
