import { useEffect, useMemo, useState } from 'preact/hooks';
import { fetchLessonIndex, type LessonSummary } from '../../lib/lessons';
import { chipOrder, emptyFilters, filterLessons, filtersToSearch, isFiltered, parseFilters, sortLessons, topicsOf, type Chip, type Filters, type SortKey } from '../../lib/lessonFilters';
import { isConfigured } from '../../lib/config';
import { LessonCard } from './LessonCard';
import { copy } from '../../content/copy';
import { Icon } from '../forms/Icon';

const t = copy.lessons;

// The free lesson library. Only published lessons ever reach this page: the database hides drafts.
// The choices are kept in the web address (?show=iphone&topic=Photos), so a link shares the same list.
export default function LessonLibrary() {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isConfigured) return setLessons([]);
    fetchLessonIndex()
      .then((rows) => {
        setLessons(rows);
        setFilters(parseFilters(window.location.search, topicsOf(rows)));
      })
      .catch(() => setFailed(true));
  }, []);

  // Keep the web address in step with the choices, without adding a step to the Back button.
  useEffect(() => {
    if (lessons === null) return;
    const next = `${window.location.pathname}${filtersToSearch(filters)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', next);
  }, [filters, lessons]);

  const topics = useMemo(() => topicsOf(lessons ?? []), [lessons]);
  const shown = useMemo(() => sortLessons(filterLessons(lessons ?? [], filters), filters.sort), [lessons, filters]);

  if (failed) return <p class="admin-message is-error" role="alert">{t.loadError}</p>;
  if (lessons === null) return <p role="status">{t.loading}</p>;
  if (lessons.length === 0) {
    return (
      <div class="card soon-card">
        <span class="icon-circle">
          <Icon name="book" size={26} />
        </span>
        <div>
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyText}</p>
          <a class="button button-secondary" href="/teach">
            {t.teachButton}
          </a>
        </div>
      </div>
    );
  }

  const toggleChip = (chip: Chip) =>
    setFilters((f) => ({ ...f, chips: f.chips.includes(chip) ? f.chips.filter((c) => c !== chip) : [...f.chips, chip] }));
  const toggleTopic = (topic: string) =>
    setFilters((f) => ({ ...f, topics: f.topics.includes(topic) ? f.topics.filter((x) => x !== topic) : [...f.topics, topic] }));
  const chosen = filters.chips.length + filters.topics.length;

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote(t.shareCopied);
    } catch {
      setNote(t.shareFailed);
    }
  }

  return (
    <div>
      <fieldset class="chips">
        <legend>{t.filterLabel}</legend>
        <button type="button" class="chip" aria-pressed={filters.chips.length === 0} onClick={() => setFilters((f) => ({ ...f, chips: [] }))}>
          {t.chips.all}
        </button>
        {chipOrder.map((chip) => (
          <button key={chip} type="button" class="chip" aria-pressed={filters.chips.includes(chip)} onClick={() => toggleChip(chip)}>
            {t.chips[chip]}
          </button>
        ))}
      </fieldset>

      {topics.length > 1 && (
        <fieldset class="chips">
          <legend>{t.topicLegend}</legend>
          {topics.map((topic) => (
            <button key={topic} type="button" class="chip" aria-pressed={filters.topics.includes(topic)} onClick={() => toggleTopic(topic)}>
              {topic}
            </button>
          ))}
        </fieldset>
      )}

      <div class="library-controls">
        <div class="field">
          <label class="field-label" for="lesson-search">
            {t.searchLabel}
          </label>
          <p class="field-helper" id="lesson-search-help">
            {t.searchHelp2}
          </p>
          <input
            id="lesson-search"
            class="field-control"
            type="search"
            value={filters.query}
            maxLength={80}
            aria-describedby="lesson-search-help"
            onInput={(e) => setFilters((f) => ({ ...f, query: e.currentTarget.value }))}
          />
        </div>
        <div class="field">
          <label class="field-label" for="lesson-sort">
            {t.sortLabel}
          </label>
          <select id="lesson-sort" class="field-control" value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.currentTarget.value as SortKey }))}>
            {t.sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p class="caption" role="status">
        {t.count(shown.length)}. {t.chipsSummary(chosen + (filters.query.trim() ? 1 : 0))}.
      </p>
      <div class="button-row">
        {isFiltered(filters) && (
          <button type="button" class="button button-secondary" onClick={() => setFilters({ ...emptyFilters, sort: filters.sort })}>
            {t.clear}
          </button>
        )}
        {isFiltered(filters) && (
          <button type="button" class="button button-secondary" onClick={share}>
            <Icon name="download" size={24} /> {t.shareChoices}
          </button>
        )}
      </div>
      <p class="caption" role="status">
        {note}
      </p>

      {shown.length === 0 ? (
        <div class="card">
          <p>{t.noMatches}</p>
        </div>
      ) : (
        <ul class="grid clean-list">
          {shown.map((lesson) => (
            <LessonCard lesson={lesson} level={2} key={lesson.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
