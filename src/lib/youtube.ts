// YouTube videos are only ever used as an 11-character ID, shown on youtube-nocookie.com.
const ID = /^[A-Za-z0-9_-]{11}$/;

/** Accepts a bare ID or a link (watch, youtu.be, embed, shorts). Returns the ID, or null. */
export function parseYouTubeId(input: string | null | undefined): string | null {
  const text = (input ?? '').trim();
  if (!text) return null;
  if (ID.test(text)) return text;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') candidate = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) candidate = parts[1] ?? null;
  }
  return candidate && ID.test(candidate) ? candidate : null;
}

export function youTubeEmbedUrl(id: string): string {
  if (!ID.test(id)) throw new Error('Not a YouTube ID');
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
