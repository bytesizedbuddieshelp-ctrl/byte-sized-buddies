// Matching slide photos to picture files by name, even when the names don't match exactly:
// "Contacts.PNG", "contacts.jpg", and "contacts_screen.png" vs "contacts-screen.png" all count as the same picture.

const PICTURE_EXT = /\.(png|jpe?g|webp|svg)$/i;

/** A name the website accepts: letters, numbers, dots, and dashes (spaces and odd characters become dashes). */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 90) || 'picture';
  return ext ? `${base}.${ext}` : base;
}

/** The part of a name that matters for matching: lowercase, no extension, words joined by dashes. */
export function matchKey(name: string): string {
  return name
    .replace(PICTURE_EXT, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface PictureMatch {
  /** Wanted name -> the picture file to use for it. */
  found: Record<string, string>;
  /** Wanted names with no picture. */
  missing: string[];
  /** Pictures no slide asked for. */
  unused: string[];
}

/**
 * For each wanted name (from the slides), finds the picture to use: the exact name first, then the one picture
 * whose name matches loosely. If two pictures match loosely, neither is guessed: the name stays missing.
 */
export function matchPictures(wanted: string[], pictures: string[]): PictureMatch {
  const found: Record<string, string> = {};
  const missing: string[] = [];
  const byKey = new Map<string, string[]>();
  for (const p of pictures) byKey.set(matchKey(p), [...(byKey.get(matchKey(p)) ?? []), p]);
  for (const w of new Set(wanted)) {
    if (pictures.includes(w)) found[w] = w;
    else {
      const candidates = byKey.get(matchKey(w)) ?? [];
      if (candidates.length === 1) found[w] = candidates[0];
      else missing.push(w);
    }
  }
  const used = new Set(Object.values(found));
  return { found, missing, unused: pictures.filter((p) => !used.has(p)) };
}
