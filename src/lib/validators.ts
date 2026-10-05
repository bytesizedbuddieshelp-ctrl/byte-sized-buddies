// Small checks used by the forms. The database repeats them later (Phase 2).
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function lengthBetween(value: string, min: number, max: number): 'ok' | 'short' | 'long' {
  const length = value.trim().length;
  if (length < min) return 'short';
  if (length > max) return 'long';
  return 'ok';
}

// The subject line for a reply: "Re: " once, on one line, no longer than the database allows.
export function replySubject(subject: string | null | undefined, fallback: string): string {
  const clean = (subject ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
  return (/^re:/i.test(clean) ? clean : `Re: ${clean}`).slice(0, 200);
}
