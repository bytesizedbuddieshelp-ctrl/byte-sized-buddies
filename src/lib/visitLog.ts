import type { SupabaseClient } from '@supabase/supabase-js';

// The visit log: the owner's private record of each visit, kept in the settings table under the key "visit_log"
// (not public, so only the owner can read it). It holds counts and notes about how a lesson went.
// It never holds names of residents or any personal information about them.

export const VISIT_KEY = 'visit_log';
export const MAX_VISITS = 500;

export interface Visit {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  facility: string;
  lesson_slug: string | null;
  lesson_title: string;
  /** How many learners came. A number only. */
  learners: number | null;
  went_well: string;
  to_change: string;
  next_step: string;
  created_at: string;
}

export type VisitInput = Partial<Record<'date' | 'facility' | 'lesson_slug' | 'lesson_title' | 'learners' | 'went_well' | 'to_change' | 'next_step', string>>;
export type VisitErrors = Partial<Record<'date' | 'facility' | 'learners' | 'went_well' | 'to_change' | 'next_step', string>>;

export const limits = { facility: 120, note: 1000 };

export function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** Checks the form in plain words. When it is fine, `visit` is the cleaned-up entry (without id and created_at). */
export function validateVisit(input: VisitInput): { errors: VisitErrors; visit: Omit<Visit, 'id' | 'created_at'> | null } {
  const errors: VisitErrors = {};
  const date = (input.date ?? '').trim();
  const facility = (input.facility ?? '').trim();
  const learnersText = (input.learners ?? '').trim();
  const notes = {
    went_well: (input.went_well ?? '').trim(),
    to_change: (input.to_change ?? '').trim(),
    next_step: (input.next_step ?? '').trim(),
  };

  if (!isRealDate(date)) errors.date = 'Please choose the date of the visit.';
  if (!facility) errors.facility = 'Please write the name of the place you visited.';
  else if (facility.length > limits.facility) errors.facility = `Please keep the name under ${limits.facility} letters.`;

  let learners: number | null = null;
  if (learnersText) {
    const n = Number(learnersText);
    if (!/^\d{1,3}$/.test(learnersText) || !Number.isInteger(n)) errors.learners = 'Please write a whole number, like 8.';
    else learners = n;
  }
  for (const key of ['went_well', 'to_change', 'next_step'] as const) {
    if (notes[key].length > limits.note) errors[key] = `Please keep this under ${limits.note} letters.`;
  }
  if (Object.keys(errors).length) return { errors, visit: null };
  return {
    errors,
    visit: {
      date,
      facility,
      lesson_slug: input.lesson_slug || null,
      lesson_title: (input.lesson_title ?? '').trim().slice(0, 120),
      learners,
      ...notes,
    },
  };
}

/** Newest visit first. */
export function sortVisits(visits: Visit[]): Visit[] {
  return [...visits].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
}

/** Reads whatever is stored. Anything that does not look like a visit is skipped, so a bad row cannot break the page. */
export function parseLog(value: unknown): Visit[] {
  const list = value && typeof value === 'object' ? (value as { visits?: unknown }).visits : null;
  if (!Array.isArray(list)) return [];
  return list.flatMap((row): Visit[] => {
    if (!row || typeof row !== 'object') return [];
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.date !== 'string' || !isRealDate(r.date)) return [];
    const text = (v: unknown) => (typeof v === 'string' ? v : '');
    return [
      {
        id: r.id,
        date: r.date,
        facility: text(r.facility),
        lesson_slug: typeof r.lesson_slug === 'string' ? r.lesson_slug : null,
        lesson_title: text(r.lesson_title),
        learners: typeof r.learners === 'number' && Number.isFinite(r.learners) ? r.learners : null,
        went_well: text(r.went_well),
        to_change: text(r.to_change),
        next_step: text(r.next_step),
        created_at: text(r.created_at),
      },
    ];
  });
}

export interface VisitStats {
  visits: number;
  learners: number;
  places: number;
  mostTaught: { title: string; count: number } | null;
}

export function visitStats(visits: Visit[]): VisitStats {
  const lessons = new Map<string, number>();
  for (const v of visits) if (v.lesson_title) lessons.set(v.lesson_title, (lessons.get(v.lesson_title) ?? 0) + 1);
  const top = [...lessons.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    visits: visits.length,
    learners: visits.reduce((sum, v) => sum + (v.learners ?? 0), 0),
    places: new Set(visits.map((v) => v.facility.trim().toLowerCase())).size,
    mostTaught: top ? { title: top[0], count: top[1] } : null,
  };
}

/** One cell of a CSV file. A cell that starts with = + - or @ is made safe, so a spreadsheet never runs it as a formula. */
export function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function visitsToCsv(visits: Visit[]): string {
  const head = ['Date', 'Place', 'Lesson', 'Learners', 'What went well', 'What to change', 'Next step'];
  const rows = sortVisits(visits).map((v) => [v.date, v.facility, v.lesson_title, v.learners, v.went_well, v.to_change, v.next_step].map(csvCell).join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}

export function newVisitId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function loadVisits(supabase: SupabaseClient): Promise<Visit[]> {
  const { data, error } = await supabase.from('settings').select('value').eq('key', VISIT_KEY).maybeSingle();
  if (error) throw error;
  return sortVisits(parseLog((data as { value: unknown } | null)?.value));
}

export async function saveVisits(supabase: SupabaseClient, visits: Visit[]): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: VISIT_KEY, value: { version: 1, visits: sortVisits(visits).slice(0, MAX_VISITS) }, is_public: false, updated_at: new Date().toISOString() });
  if (error) throw error;
}
