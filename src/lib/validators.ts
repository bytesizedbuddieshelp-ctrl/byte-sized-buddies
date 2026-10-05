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
