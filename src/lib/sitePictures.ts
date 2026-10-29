// Pictures for the landing page: checked, shrunk if they are huge, and uploaded to the public lesson-files
// bucket in a "site" folder. Only the signed-in owner can upload (the storage rules decide, not this file).
import type { SupabaseClient } from '@supabase/supabase-js';
import { inspectFile } from './kit';
import { contentTypeFor } from './lessonAdmin';
import { BUCKET } from './lessons';
import { safeFileName } from './pictureNames';

/** Phone photos are often 4000 pixels wide. The page never shows them wider than this, so they are shrunk first. */
export const MAX_PICTURE_WIDTH = 1600;

/** The path to save a picture under: a short time stamp keeps two pictures with the same name apart. */
export function sitePicturePath(name: string, now = Date.now()): string {
  return `site/${now.toString(36)}-${safeFileName(name)}`.replace(/(\.[a-z]+)$/i, (ext) => ext.toLowerCase());
}

/** The same picture at a sensible size. SVGs, small pictures, and anything the browser can't shrink are returned as they are. */
export async function shrinkPicture(file: File): Promise<File> {
  if (/\.svg$/i.test(file.name) || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width <= MAX_PICTURE_WIDTH) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = MAX_PICTURE_WIDTH;
    canvas.height = Math.round((bitmap.height * MAX_PICTURE_WIDTH) / bitmap.width);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.88));
    return blob && blob.size < file.size ? new File([blob], file.name, { type }) : file;
  } catch {
    return file;
  }
}

/** Checks, shrinks, and uploads one picture. Returns its path (for example "site/lq3x-photo.jpg"). Throws plain words. */
export async function uploadSitePicture(supabase: SupabaseClient, original: File): Promise<string> {
  const named = new File([original], safeFileName(original.name), { type: original.type });
  const info = await inspectFile(named);
  if (info.problem) throw new Error(info.problem);
  if (info.kind === 'pdf' || info.kind === 'json' || info.kind === 'unknown') throw new Error(`"${original.name}" should be a picture (PNG, JPG, WebP, or SVG).`);
  const file = await shrinkPicture(named);
  const path = sitePicturePath(file.name);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: contentTypeFor(file.name), cacheControl: '31536000', upsert: false });
  if (error) throw new Error(`Could not upload ${original.name}. Please try again.`);
  return path;
}
