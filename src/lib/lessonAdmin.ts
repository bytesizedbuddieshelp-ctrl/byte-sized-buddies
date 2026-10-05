// Owner-only helpers for lessons: uploads, deletes, and the kit zip. They use the signed-in client,
// and the database rules (and storage rules) decide what is allowed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET, fileUrl, lessonFolder, type Lesson, type LessonFiles, type StoredFile } from './lessons';
import { FILE_SLOTS, type FileSlot, type NormalizedLesson } from './kit';
import { makeZip } from './zip';

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export function contentTypeFor(name: string): string {
  return CONTENT_TYPES[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

export async function uploadLessonFile(supabase: SupabaseClient, slug: string, file: File): Promise<StoredFile> {
  const path = `${lessonFolder(slug)}/${file.name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: contentTypeFor(file.name), cacheControl: '3600' });
  if (error) throw new Error(`Could not upload ${file.name}.`);
  return { path, bytes: file.size };
}

export async function removeStoragePaths(supabase: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new Error('Could not remove old files.');
}

/** Every path a lesson's files record points at. */
export function pathsIn(files: LessonFiles): string[] {
  return [...FILE_SLOTS.flatMap((slot) => (files[slot] ? [files[slot]!.path] : [])), ...(files.images ?? []).map((image) => image.path)];
}

/** Removes files left in a lesson's folder that the lesson no longer uses. */
export async function removeStaleFiles(supabase: SupabaseClient, slug: string, keep: string[]): Promise<void> {
  const folder = lessonFolder(slug);
  const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 500 });
  const stale = (data ?? []).map((entry) => `${folder}/${entry.name}`).filter((path) => !keep.includes(path));
  await removeStoragePaths(supabase, stale);
}

/** Builds the files record for a lesson from the names that were uploaded. */
export function filesRecord(slots: Partial<Record<FileSlot, StoredFile>>, images: { name: string; path: string; bytes: number }[]): LessonFiles {
  const files: LessonFiles = {};
  for (const slot of FILE_SLOTS) if (slots[slot]) files[slot] = slots[slot];
  if (images.length) files.images = images;
  return files;
}

const baseName = (path: string) => path.split('/').pop() ?? path;

/** The kit.json for a lesson: the same format the importer reads (docs/KIT-FORMAT.md). */
export function kitFor(lesson: Lesson): { kit: Record<string, unknown>; fileList: { name: string; path: string }[] } {
  const fileList: { name: string; path: string }[] = [];
  const files: Record<string, string | null> = {};
  for (const slot of FILE_SLOTS) {
    const stored = lesson.files[slot];
    files[slot] = stored ? baseName(stored.path) : null;
    if (stored) fileList.push({ name: baseName(stored.path), path: stored.path });
  }
  const images = (lesson.files.images ?? []).map((image) => image.name);
  for (const image of lesson.files.images ?? []) fileList.push({ name: image.name, path: image.path });
  return {
    kit: {
      kit_version: 1,
      lesson: {
        slug: lesson.slug,
        week_number: lesson.week_number,
        title: lesson.title,
        summary: lesson.summary ?? '',
        topic: lesson.topic ?? '',
        devices: lesson.devices,
        level: lesson.level,
        duration_minutes: lesson.duration_minutes,
        objectives: lesson.objectives,
        license: lesson.license,
      },
      slides: lesson.slides,
      teacher_guide_md: lesson.teacher_guide_md ?? '',
      video_script_md: lesson.video_script_md ?? '',
      files,
      images,
    },
    fileList,
  };
}

export async function buildKitZip(lesson: Lesson): Promise<Uint8Array> {
  const { kit, fileList } = kitFor(lesson);
  const entries = [{ name: 'kit.json', data: new TextEncoder().encode(JSON.stringify(kit, null, 2) + '\n') }];
  for (const file of fileList) {
    const response = await fetch(fileUrl(file.path));
    if (!response.ok) throw new Error(`Could not fetch ${file.name}.`);
    entries.push({ name: file.name, data: new Uint8Array(await response.arrayBuffer()) });
  }
  return makeZip(entries);
}

export function saveBlob(filename: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The row to save for a lesson that came from a kit. */
export function rowFromKit(lesson: NormalizedLesson, files: LessonFiles) {
  return {
    slug: lesson.slug,
    week_number: lesson.week_number,
    title: lesson.title,
    summary: lesson.summary || null,
    topic: lesson.topic || null,
    devices: lesson.devices,
    level: lesson.level,
    duration_minutes: lesson.duration_minutes,
    objectives: lesson.objectives,
    slides: lesson.slides,
    teacher_guide_md: lesson.teacher_guide_md || null,
    video_script_md: lesson.video_script_md || null,
    files,
    license: lesson.license,
    status: 'draft' as const,
    published_at: null,
  };
}
