// The weekly routine on the dashboard: a few boxes to tick each week. They reset on Monday.
// The ticks are kept in this browser only (it is a memory aid, not a record).

/** The Monday of the week that contains this day, as YYYY-MM-DD (in the computer's own time zone). */
export function weekStart(day: Date): string {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const back = (d.getDay() + 6) % 7; // Monday is 0
  d.setDate(d.getDate() - back);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const ROUTINE_KEY = 'bsb-weekly-routine';

/** Reads the saved ticks. Ticks from an earlier week are dropped. */
export function readTicks(raw: string | null, week: string): string[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as { week?: unknown; done?: unknown }) : null;
    if (!parsed || parsed.week !== week || !Array.isArray(parsed.done)) return [];
    return parsed.done.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function writeTicks(week: string, done: string[]): string {
  return JSON.stringify({ week, done });
}

export function toggleTick(done: string[], id: string): string[] {
  return done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
}
