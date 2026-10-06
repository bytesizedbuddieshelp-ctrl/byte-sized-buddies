import { matchesDevice, sortByWeek, type LessonSummary } from './lessons';

// Pure helpers for the lesson library: filtering, sorting, topics, the web address that remembers your choices,
// and the next and previous lesson. Kept apart from the screens so they can be tested.

export type SortKey = 'week' | 'newest' | 'shortest' | 'az';
export const sortKeys: SortKey[] = ['week', 'newest', 'shortest', 'az'];
export type Chip = 'iphone' | 'android' | 'beginner' | 'intermediate';
export const chipOrder: Chip[] = ['iphone', 'android', 'beginner', 'intermediate'];

export interface Filters {
  chips: Chip[];
  topics: string[];
  query: string;
  sort: SortKey;
}

export const emptyFilters: Filters = { chips: [], topics: [], query: '', sort: 'week' };

/** Lowercase, without accents, so "Café" is found by "cafe". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const searchable = (lesson: LessonSummary) => normalize([lesson.title, lesson.topic ?? '', lesson.summary ?? '', ...lesson.objectives].join(' '));

/** Every word typed must appear somewhere in the title, topic, summary, or what you will be able to do. */
export function filterLessons<T extends LessonSummary>(lessons: T[], filters: Filters): T[] {
  const devices = filters.chips.filter((c) => c === 'iphone' || c === 'android');
  const levels = filters.chips.filter((c) => c === 'beginner' || c === 'intermediate');
  const words = normalize(filters.query).split(/\s+/).filter(Boolean);
  return lessons.filter((lesson) => {
    if (devices.length && !devices.some((d) => matchesDevice(lesson, d))) return false;
    if (levels.length && !levels.includes(lesson.level)) return false;
    if (filters.topics.length && !filters.topics.some((t) => normalize(t) === normalize(lesson.topic ?? ''))) return false;
    if (words.length) {
      const hay = searchable(lesson);
      return words.every((w) => hay.includes(w));
    }
    return true;
  });
}

export function sortLessons<T extends LessonSummary>(lessons: T[], sort: SortKey): T[] {
  if (sort === 'week') return sortByWeek(lessons);
  const copy = [...lessons];
  if (sort === 'newest') return copy.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '') || a.title.localeCompare(b.title));
  if (sort === 'shortest') return copy.sort((a, b) => a.duration_minutes - b.duration_minutes || a.title.localeCompare(b.title));
  return copy.sort((a, b) => a.title.localeCompare(b.title));
}

/** The topics used by these lessons, each once, in alphabetical order. */
export function topicsOf(lessons: Pick<LessonSummary, 'topic'>[]): string[] {
  const seen = new Map<string, string>();
  for (const lesson of lessons) {
    const topic = (lesson.topic ?? '').trim();
    if (topic && !seen.has(normalize(topic))) seen.set(normalize(topic), topic);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Reads choices from a web address like ?device=iphone&topic=Photos&q=share&sort=newest. Anything odd is ignored. */
export function parseFilters(search: string, knownTopics: string[] = []): Filters {
  const params = new URLSearchParams(search);
  const chips = chipOrder.filter((chip) => (params.get('show') ?? '').split(',').includes(chip));
  const wanted = (params.get('topic') ?? '').split('|').map(normalize).filter(Boolean);
  const topics = knownTopics.filter((t) => wanted.includes(normalize(t)));
  const sort = params.get('sort') as SortKey;
  return {
    chips,
    topics,
    query: (params.get('q') ?? '').slice(0, 80),
    sort: sortKeys.includes(sort) ? sort : 'week',
  };
}

/** The opposite of parseFilters: the part of the web address that remembers the choices ('' when nothing is chosen). */
export function filtersToSearch(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.chips.length) params.set('show', filters.chips.join(','));
  if (filters.topics.length) params.set('topic', filters.topics.join('|'));
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.sort !== 'week') params.set('sort', filters.sort);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function isFiltered(filters: Filters): boolean {
  return filters.chips.length > 0 || filters.topics.length > 0 || filters.query.trim() !== '';
}

/** The lesson before and after this one, in week order. */
export function neighborsOf<T extends Pick<LessonSummary, 'slug' | 'week_number' | 'title'>>(lessons: T[], slug: string): { previous: T | null; next: T | null } {
  const ordered = sortByWeek(lessons);
  const at = ordered.findIndex((l) => l.slug === slug);
  if (at === -1) return { previous: null, next: null };
  return { previous: ordered[at - 1] ?? null, next: ordered[at + 1] ?? null };
}

/** Other lessons for the same device, or on the same topic, nearest in week order. Never the lesson itself. */
export function relatedTo<T extends LessonSummary>(lessons: T[], current: LessonSummary, count = 3): T[] {
  const topic = normalize(current.topic ?? '');
  const score = (l: T) =>
    (topic && normalize(l.topic ?? '') === topic ? 4 : 0) +
    (l.level === current.level ? 1 : 0) +
    (l.devices.some((d) => d !== 'any' && current.devices.includes(d)) ? 2 : 0);
  return lessons
    .filter((l) => l.slug !== current.slug)
    .map((l) => ({ l, score: score(l), gap: Math.abs((l.week_number ?? 999) - (current.week_number ?? 999)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.gap - b.gap)
    .slice(0, count)
    .map((x) => x.l);
}

/** The lesson published most recently. */
export function newestOf<T extends Pick<LessonSummary, 'published_at' | 'week_number'>>(lessons: T[]): T | null {
  if (lessons.length === 0) return null;
  return [...lessons].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '') || (b.week_number ?? 0) - (a.week_number ?? 0))[0];
}

export interface PlanStep {
  title: string;
  text: string;
  minutes: number;
  /** Minutes from the start of the visit when this step begins. */
  startsAt: number;
}

const planShape = [
  { title: 'Welcome', text: 'A warm-up question, and everyone says hello.', weight: 3 },
  { title: 'Learn it', text: 'Show the slides. One idea at a time.', weight: 10 },
  { title: 'Try it', text: "Guided practice on each person's own device.", weight: 20 },
  { title: 'Worksheet', text: 'A one-page worksheet, then teach it back to a neighbor.', weight: 7 },
  { title: 'Keep it', text: 'Hand out the large-print handout and explain the take-home challenge.', weight: 5 },
];

/** The visit as five steps, scaled to the lesson's length. A 45-minute lesson is 3, 10, 20, 7, and 5 minutes. */
export function lessonPlan(totalMinutes: number): PlanStep[] {
  const total = Math.max(15, Math.min(180, Math.round(totalMinutes) || 45));
  const weightSum = planShape.reduce((sum, s) => sum + s.weight, 0);
  const minutes = planShape.map((s) => Math.max(1, Math.round((s.weight / weightSum) * total)));
  // Rounding can leave us a minute over or under. The "Try it" step (the biggest) absorbs it.
  minutes[2] += total - minutes.reduce((a, b) => a + b, 0);
  let at = 0;
  return planShape.map((s, i) => {
    const step = { title: s.title, text: s.text, minutes: minutes[i], startsAt: at };
    at += minutes[i];
    return step;
  });
}
