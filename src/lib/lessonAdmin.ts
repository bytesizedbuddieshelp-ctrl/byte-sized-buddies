// Owner-only helpers for lessons: uploads, deletes, and the kit zip. They use the signed-in client,
// and the database rules (and storage rules) decide what is allowed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET, bucketForSlot, copySlug, extrasFor, fileUrl, lessonFolder, moveFilePaths, PRIVATE_BUCKET, PRIVATE_SLOTS, type ExtraFile, type Lesson, type LessonFiles, type StoredFile } from './lessons';
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

/** Uploads one file. A private slot (the teacher guide PDF) goes to the private bucket. */
export async function uploadLessonFile(supabase: SupabaseClient, slug: string, file: File, slot?: FileSlot): Promise<StoredFile> {
  const path = `${lessonFolder(slug)}/${file.name}`;
  const bucket = bucketForSlot(slot);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: contentTypeFor(file.name), cacheControl: '3600' });
  if (error) throw new Error(`Could not upload ${file.name}.`);
  // An older copy may still sit in the public bucket from before guides were private. Take it down.
  if (bucket === PRIVATE_BUCKET) await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
  return { path, bytes: file.size };
}

/** Removes files from both buckets (a path that isn't there is skipped). */
export async function removeStoragePaths(supabase: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  for (const bucket of [BUCKET, PRIVATE_BUCKET]) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw new Error('Could not remove old files.');
  }
}

/** A short-lived web address for a private file, so the signed-in owner can open it. */
export async function privateFileUrl(supabase: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) throw new Error('Could not open the file.');
  return data.signedUrl;
}

/** The paths of a lesson's private files (the teacher guide PDF). */
export function privatePathsIn(files: LessonFiles): string[] {
  return PRIVATE_SLOTS.flatMap((slot) => (files[slot] ? [files[slot]!.path] : []));
}

/** Every path a lesson's files record points at, in both buckets. */
export function pathsIn(files: LessonFiles): string[] {
  return [
    ...FILE_SLOTS.flatMap((slot) => (files[slot] ? [files[slot]!.path] : [])),
    ...(files.images ?? []).map((image) => image.path),
    ...extrasFor(files).map((extra) => extra.path),
  ];
}

/** Removes files left in a lesson's folder (in either bucket) that the lesson no longer uses. */
export async function removeStaleFiles(supabase: SupabaseClient, slug: string, files: LessonFiles): Promise<void> {
  const folder = lessonFolder(slug);
  const privatePaths = privatePathsIn(files);
  const keep: Record<string, string[]> = {
    [BUCKET]: pathsIn(files).filter((path) => !privatePaths.includes(path)),
    [PRIVATE_BUCKET]: privatePaths,
  };
  for (const bucket of [BUCKET, PRIVATE_BUCKET]) {
    const { data } = await supabase.storage.from(bucket).list(folder, { limit: 500 });
    const stale = (data ?? []).map((entry) => `${folder}/${entry.name}`).filter((path) => !keep[bucket].includes(path));
    if (stale.length === 0) continue;
    const { error } = await supabase.storage.from(bucket).remove(stale);
    if (error) throw new Error('Could not remove old files.');
  }
}

/** Builds the files record for a lesson from the names that were uploaded. */
export function filesRecord(slots: Partial<Record<FileSlot, StoredFile>>, images: { name: string; path: string; bytes: number }[], extras: ExtraFile[] = []): LessonFiles {
  const files: LessonFiles = {};
  for (const slot of FILE_SLOTS) if (slots[slot]) files[slot] = slots[slot];
  if (images.length) files.images = images;
  if (extras.length) files.extras = extras;
  return files;
}

const baseName = (path: string) => path.split('/').pop() ?? path;

/** The kit.json for a lesson: the same format the importer reads (docs/KIT-FORMAT.md).
 *  Without includePrivate (the public zip), the teacher guide and its PDF are left out. */
export function kitFor(lesson: Lesson, includePrivate = false): { kit: Record<string, unknown>; fileList: { name: string; path: string; bucket: string }[] } {
  const fileList: { name: string; path: string; bucket: string }[] = [];
  const files: Record<string, string | null> = {};
  for (const slot of FILE_SLOTS) {
    const bucket = bucketForSlot(slot);
    const stored = bucket === PRIVATE_BUCKET && !includePrivate ? undefined : lesson.files[slot];
    files[slot] = stored ? baseName(stored.path) : null;
    if (stored) fileList.push({ name: baseName(stored.path), path: stored.path, bucket });
  }
  const images = (lesson.files.images ?? []).map((image) => image.name);
  for (const image of lesson.files.images ?? []) fileList.push({ name: image.name, path: image.path, bucket: BUCKET });
  const extras = extrasFor(lesson.files).map((extra) => ({ file: extra.name, title: extra.title }));
  for (const extra of extrasFor(lesson.files)) fileList.push({ name: extra.name, path: extra.path, bucket: BUCKET });
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
      teacher_guide_md: includePrivate ? (lesson.teacher_guide_md ?? '') : '',
      video_script_md: lesson.video_script_md ?? '',
      files,
      images,
      ...(extras.length ? { extras } : {}),
    },
    fileList,
  };
}

/** The kit as a zip. Pass the signed-in client (owner only) to include the private teacher guide. */
export async function buildKitZip(lesson: Lesson, owner?: SupabaseClient): Promise<Uint8Array> {
  const { kit, fileList } = kitFor(lesson, Boolean(owner));
  const entries = [{ name: 'kit.json', data: new TextEncoder().encode(JSON.stringify(kit, null, 2) + '\n') }];
  for (const file of fileList) {
    if (file.bucket === PRIVATE_BUCKET && owner) {
      const { data, error } = await owner.storage.from(PRIVATE_BUCKET).download(file.path);
      if (error || !data) throw new Error(`Could not fetch ${file.name}.`);
      entries.push({ name: file.name, data: new Uint8Array(await data.arrayBuffer()) });
      continue;
    }
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

/** Makes a draft copy of a lesson, with its own copy of every file, so changing or deleting one never touches the other. */
export async function duplicateLesson(supabase: SupabaseClient, lesson: Lesson, takenSlugs: string[]): Promise<string> {
  const slug = copySlug(lesson.slug, takenSlugs);
  const files = moveFilePaths(lesson.files ?? {}, lesson.slug, slug);
  const before = pathsIn(lesson.files ?? {});
  const after = pathsIn(files);
  const privateBefore = privatePathsIn(lesson.files ?? {});
  for (const [i, from] of before.entries()) {
    const { error } = await supabase.storage.from(privateBefore.includes(from) ? PRIVATE_BUCKET : BUCKET).copy(from, after[i]);
    if (error) {
      await removeStoragePaths(supabase, after.slice(0, i)).catch(() => undefined);
      throw new Error('Could not copy the files.');
    }
  }
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = lesson;
  const { error } = await supabase.from('lessons').insert({ ...rest, slug, title: `Copy of ${lesson.title}`.slice(0, 120), files, status: 'draft', published_at: null });
  if (error) {
    await removeStoragePaths(supabase, after).catch(() => undefined);
    throw error;
  }
  return slug;
}
