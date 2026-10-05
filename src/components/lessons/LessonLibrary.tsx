import { useEffect, useMemo, useState } from 'preact/hooks';
import { fetchPublishedLessons, matchesDevice, type Lesson } from '../../lib/lessons';
import { isConfigured } from '../../lib/config';
import { LessonCard } from './LessonCard';
import { copy } from '../../content/copy';

const t = copy.lessons;
type Chip = 'iphone' | 'android' | 'beginner' | 'intermediate';
const chipOrder: Chip[] = ['iphone', 'android', 'beginner', 'intermediate'];

// The free lesson library. Only published lessons ever reach this page: the database hides drafts.
export default function LessonLibrary() {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chips, setChips] = useState<Chip[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isConfigured) return setLessons([]);
    fetchPublishedLessons().then(setLessons).catch(() => setFailed(true));
  }, []);

  const shown = useMemo(() => {
    const devices = chips.filter((c) => c === 'iphone' || c === 'android');
    const levels = chips.filter((c) => c === 'beginner' || c === 'intermediate');
    const words = query.trim().toLowerCase();
    return (lessons ?? []).filter(
      (lesson) =>
        (devices.length === 0 || devices.some((d) => matchesDevice(lesson, d))) &&
        (levels.length === 0 || levels.includes(lesson.level)) &&
        (!words || `${lesson.title} ${lesson.topic ?? ''}`.toLowerCase().includes(words)),
    );
  }, [lessons, chips, query]);

  if (failed) return <p class="admin-message is-error" role="alert">{t.loadError}</p>;
  if (lessons === null) return <p role="status">{t.loading}</p>;
  if (lessons.length === 0) {
    return (
      <div class="card">
        <h2>{t.emptyTitle}</h2>
        <p>{t.emptyText}</p>
        <a class="button button-secondary" href="/teach">
          {t.teachButton}
        </a>
      </div>
    );
  }

  const toggle = (chip: Chip) => setChips((now) => (now.includes(chip) ? now.filter((c) => c !== chip) : [...now, chip]));

  return (
    <div>
      <fieldset class="chips">
        <legend>{t.filterLabel}</legend>
        <button type="button" class="chip" aria-pressed={chips.length === 0} onClick={() => setChips([])}>
          {t.chips.all}
        </button>
        {chipOrder.map((chip) => (
          <button key={chip} type="button" class="chip" aria-pressed={chips.includes(chip)} onClick={() => toggle(chip)}>
            {t.chips[chip]}
          </button>
        ))}
      </fieldset>

      <div class="field">
        <label class="field-label" for="lesson-search">
          {t.searchLabel}
        </label>
        <p class="field-helper" id="lesson-search-help">
          {t.searchHelp}
        </p>
        <input id="lesson-search" class="field-control" type="search" value={query} aria-describedby="lesson-search-help" onInput={(e) => setQuery(e.currentTarget.value)} />
      </div>

      <p class="caption" role="status">
        {t.count(shown.length)}
      </p>
      {shown.length === 0 ? (
        <p>{t.noMatches}</p>
      ) : (
        <ul class="grid clean-list">
          {shown.map((lesson) => (
            <LessonCard lesson={lesson} key={lesson.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
