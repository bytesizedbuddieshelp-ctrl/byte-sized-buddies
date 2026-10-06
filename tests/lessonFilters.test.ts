import { describe, expect, it } from 'vitest';
import { emptyFilters, filterLessons, filtersToSearch, lessonPlan, neighborsOf, newestOf, parseFilters, relatedTo, sortLessons, topicsOf } from '../src/lib/lessonFilters';
import type { LessonSummary } from '../src/lib/lessons';

const make = (over: Partial<LessonSummary>): LessonSummary => ({
  id: over.slug ?? 'x',
  slug: 'x',
  week_number: 1,
  title: 'Title',
  summary: null,
  topic: null,
  devices: ['any'],
  level: 'beginner',
  duration_minutes: 45,
  objectives: [],
  published_at: null,
  ...over,
});

const lessons = [
  make({ slug: 'calls', week_number: 1, title: 'Calling a friend', topic: 'Phone calls', devices: ['iphone', 'android'], published_at: '2026-01-01' }),
  make({ slug: 'photos', week_number: 2, title: 'Photos', topic: 'Photos', devices: ['iphone'], summary: 'Take and share a picture.', objectives: ['Open the camera'], published_at: '2026-02-01', duration_minutes: 30 }),
  make({ slug: 'video', week_number: 3, title: 'Video calls', topic: 'Phone calls', devices: ['android'], level: 'intermediate', published_at: '2026-03-01', duration_minutes: 60 }),
];

describe('filterLessons', () => {
  it('keeps everything when nothing is chosen', () => {
    expect(filterLessons(lessons, emptyFilters)).toHaveLength(3);
  });
  it('filters by device, treating "any" as every device', () => {
    const withAny = [...lessons, make({ slug: 'any', week_number: 4, devices: ['any'] })];
    expect(filterLessons(withAny, { ...emptyFilters, chips: ['android'] }).map((l) => l.slug)).toEqual(['calls', 'video', 'any']);
  });
  it('filters by level and topic together', () => {
    expect(filterLessons(lessons, { ...emptyFilters, chips: ['intermediate'], topics: ['phone calls'] }).map((l) => l.slug)).toEqual(['video']);
  });
  it('finds words in the summary and objectives, and needs every word', () => {
    expect(filterLessons(lessons, { ...emptyFilters, query: 'camera' }).map((l) => l.slug)).toEqual(['photos']);
    expect(filterLessons(lessons, { ...emptyFilters, query: 'share picture' }).map((l) => l.slug)).toEqual(['photos']);
    expect(filterLessons(lessons, { ...emptyFilters, query: 'share dragon' })).toHaveLength(0);
  });
  it('ignores accents and capital letters', () => {
    const cafe = [make({ slug: 'c', title: 'Café menus' })];
    expect(filterLessons(cafe, { ...emptyFilters, query: 'CAFE' })).toHaveLength(1);
  });
});

describe('sortLessons', () => {
  it('sorts by week, newest, shortest, and A to Z', () => {
    expect(sortLessons(lessons, 'week').map((l) => l.slug)).toEqual(['calls', 'photos', 'video']);
    expect(sortLessons(lessons, 'newest').map((l) => l.slug)).toEqual(['video', 'photos', 'calls']);
    expect(sortLessons(lessons, 'shortest').map((l) => l.slug)).toEqual(['photos', 'calls', 'video']);
    expect(sortLessons(lessons, 'az').map((l) => l.slug)).toEqual(['calls', 'photos', 'video']);
  });
  it('does not change the list it was given', () => {
    const before = lessons.map((l) => l.slug);
    sortLessons(lessons, 'newest');
    expect(lessons.map((l) => l.slug)).toEqual(before);
  });
});

describe('topicsOf', () => {
  it('lists each topic once, in order', () => {
    expect(topicsOf(lessons)).toEqual(['Phone calls', 'Photos']);
    expect(topicsOf([make({ topic: 'Photos' }), make({ topic: 'photos ' }), make({ topic: null })])).toEqual(['Photos']);
  });
});

describe('the web address', () => {
  it('round-trips the choices', () => {
    const f = { chips: ['iphone', 'beginner'] as const, topics: ['Phone calls'], query: 'friend', sort: 'newest' as const };
    const search = filtersToSearch({ ...f, chips: [...f.chips] });
    expect(parseFilters(search, ['Phone calls', 'Photos'])).toEqual({ ...f, chips: [...f.chips] });
  });
  it('is empty when nothing is chosen, and ignores odd values', () => {
    expect(filtersToSearch(emptyFilters)).toBe('');
    expect(parseFilters('?show=nonsense&sort=oops&topic=Nope', ['Photos'])).toEqual(emptyFilters);
  });
});

describe('neighborsOf and relatedTo', () => {
  it('finds the lessons before and after', () => {
    expect(neighborsOf(lessons, 'photos')).toMatchObject({ previous: { slug: 'calls' }, next: { slug: 'video' } });
    expect(neighborsOf(lessons, 'calls').previous).toBeNull();
    expect(neighborsOf(lessons, 'video').next).toBeNull();
    expect(neighborsOf(lessons, 'missing')).toEqual({ previous: null, next: null });
  });
  it('relates by topic first and never includes the lesson itself', () => {
    const related = relatedTo(lessons, lessons[0]);
    expect(related[0].slug).toBe('video');
    expect(related.map((l) => l.slug)).not.toContain('calls');
  });
});

describe('newestOf', () => {
  it('picks the most recently published lesson', () => {
    expect(newestOf(lessons)?.slug).toBe('video');
    expect(newestOf([])).toBeNull();
  });
});

describe('lessonPlan', () => {
  it('gives 3, 10, 20, 7, and 5 minutes for a 45-minute lesson', () => {
    expect(lessonPlan(45).map((s) => s.minutes)).toEqual([3, 10, 20, 7, 5]);
  });
  it('always adds up to the lesson length and starts each step where the last ended', () => {
    for (const total of [20, 30, 45, 50, 60, 90]) {
      const plan = lessonPlan(total);
      expect(plan.reduce((sum, s) => sum + s.minutes, 0)).toBe(total);
      plan.forEach((s, i) => expect(s.startsAt).toBe(plan.slice(0, i).reduce((sum, p) => sum + p.minutes, 0)));
    }
  });
  it('keeps a sensible length for odd input', () => {
    expect(lessonPlan(Number.NaN).reduce((sum, s) => sum + s.minutes, 0)).toBe(45);
  });
});
