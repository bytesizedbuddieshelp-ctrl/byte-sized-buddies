import { describe, expect, it } from 'vitest';
import { csvCell, isRealDate, parseLog, sortVisits, validateVisit, visitStats, visitsToCsv, type Visit } from '../src/lib/visitLog';
import { readTicks, toggleTick, weekStart, writeTicks } from '../src/lib/weekly';

const visit = (over: Partial<Visit>): Visit => ({
  id: 'a',
  date: '2026-03-02',
  facility: 'Sample Gardens',
  lesson_slug: 'week-01',
  lesson_title: 'Calling a friend',
  learners: 8,
  went_well: '',
  to_change: '',
  next_step: '',
  created_at: '2026-03-02T15:00:00Z',
  ...over,
});

describe('validateVisit', () => {
  it('accepts a complete visit and cleans spaces', () => {
    const { errors, visit: v } = validateVisit({ date: '2026-03-02', facility: '  Sample Gardens ', learners: '8', went_well: ' Good ' });
    expect(errors).toEqual({});
    expect(v).toMatchObject({ facility: 'Sample Gardens', learners: 8, went_well: 'Good', lesson_slug: null });
  });
  it('explains every problem in plain words', () => {
    const { errors, visit: v } = validateVisit({ date: '2026-02-30', facility: '', learners: 'eight' });
    expect(v).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(['date', 'facility', 'learners']);
  });
  it('allows leaving learners empty, and rejects long notes', () => {
    expect(validateVisit({ date: '2026-03-02', facility: 'X' }).visit?.learners).toBeNull();
    expect(validateVisit({ date: '2026-03-02', facility: 'X', went_well: 'a'.repeat(1001) }).errors.went_well).toBeTruthy();
  });
});

describe('dates', () => {
  it('knows real dates from impossible ones', () => {
    expect(isRealDate('2026-03-02')).toBe(true);
    expect(isRealDate('2026-02-30')).toBe(false);
    expect(isRealDate('03/02/2026')).toBe(false);
  });
});

describe('visit log', () => {
  it('sorts newest first', () => {
    expect(sortVisits([visit({ id: 'old', date: '2026-01-01' }), visit({ id: 'new', date: '2026-05-01' })]).map((v) => v.id)).toEqual(['new', 'old']);
  });
  it('skips rows that are not visits', () => {
    expect(parseLog({ visits: [visit({}), null, { id: 5 }, { id: 'x', date: 'nope' }] })).toHaveLength(1);
    expect(parseLog(null)).toEqual([]);
    expect(parseLog({ visits: 'oops' })).toEqual([]);
  });
  it('counts visits, learners, places, and the most taught lesson', () => {
    const stats = visitStats([visit({ id: '1' }), visit({ id: '2', facility: 'sample gardens', learners: 4 }), visit({ id: '3', facility: 'Court', lesson_title: 'Photos', learners: null })]);
    expect(stats).toEqual({ visits: 3, learners: 12, places: 2, mostTaught: { title: 'Calling a friend', count: 2 } });
    expect(visitStats([]).mostTaught).toBeNull();
  });
});

describe('csv', () => {
  it('quotes commas, quotes, and new lines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
    expect(csvCell(8)).toBe('8');
  });
  it('defuses spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-5')).toBe("'-5");
  });
  it('writes a header and one row per visit', () => {
    const csv = visitsToCsv([visit({})]);
    expect(csv.split('\n')[0]).toBe('Date,Place,Lesson,Learners,What went well,What to change,Next step');
    expect(csv.trim().split('\n')).toHaveLength(2);
  });
});

describe('weekly routine', () => {
  it('finds the Monday of any day', () => {
    expect(weekStart(new Date(2026, 9, 5))).toBe('2026-10-05'); // a Monday
    expect(weekStart(new Date(2026, 9, 11))).toBe('2026-10-05'); // the Sunday after
    expect(weekStart(new Date(2026, 0, 1))).toBe('2025-12-29');
  });
  it('keeps ticks for this week only', () => {
    const saved = writeTicks('2026-10-05', ['a', 'b']);
    expect(readTicks(saved, '2026-10-05')).toEqual(['a', 'b']);
    expect(readTicks(saved, '2026-10-12')).toEqual([]);
    expect(readTicks('not json', '2026-10-05')).toEqual([]);
    expect(readTicks(null, '2026-10-05')).toEqual([]);
  });
  it('toggles a tick on and off', () => {
    expect(toggleTick(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleTick(['a', 'b'], 'a')).toEqual(['b']);
  });
});

import { copySlug, missingParts, moveFilePaths } from '../src/lib/lessons';

describe('lesson readiness and copies', () => {
  it('lists what a lesson still needs', () => {
    expect(missingParts({ summary: 'x', objectives: ['a'], teacher_guide_md: '# g', files: { handout: { path: 'p', bytes: 1 }, worksheet: { path: 'p', bytes: 1 } }, slides: { version: 1, slides: [{ layout: 'title', title: 'T' } as never] } })).toEqual([]);
    expect(missingParts({ summary: ' ', objectives: [], teacher_guide_md: null, files: {}, slides: { version: 1, slides: [] } })).toHaveLength(6);
  });
  it('finds a free address for a copy', () => {
    expect(copySlug('week-01', [])).toBe('week-01-copy');
    expect(copySlug('week-01', ['week-01-copy'])).toBe('week-01-copy-2');
    expect(copySlug('week-01-copy', ['week-01-copy'])).toBe('week-01-copy-2');
    expect(copySlug('week-01-copy-2', ['week-01-copy', 'week-01-copy-2'])).toBe('week-01-copy-3');
  });
  it('moves file paths to the new lesson folder and leaves others alone', () => {
    const moved = moveFilePaths(
      { handout: { path: 'lessons/a/h.pdf', bytes: 5 }, images: [{ name: 'x.png', path: 'lessons/a/x.png', bytes: 2 }], extras: [{ name: 'e.pdf', title: 'E', path: 'elsewhere/e.pdf', bytes: 1 }] },
      'a',
      'a-copy',
    );
    expect(moved.handout?.path).toBe('lessons/a-copy/h.pdf');
    expect(moved.images?.[0].path).toBe('lessons/a-copy/x.png');
    expect(moved.extras?.[0].path).toBe('elsewhere/e.pdf');
  });
});
