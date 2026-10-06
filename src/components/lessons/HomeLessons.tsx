import { useEffect, useState } from 'preact/hooks';
import { fetchLessonIndex, type LessonSummary } from '../../lib/lessons';
import { newestOf } from '../../lib/lessonFilters';
import { isConfigured } from '../../lib/config';
import { LessonCard } from './LessonCard';
import { Icon } from '../forms/Icon';
import { copy } from '../../content/copy';

const t = copy.home.lessons;

// Up to six published lessons for the home page, with the newest one first and marked "Newest lesson".
// With none, a calm card. Never made-up lessons.
export default function HomeLessons() {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(isConfigured ? null : []);

  useEffect(() => {
    if (!isConfigured) return;
    fetchLessonIndex().then(setLessons).catch(() => setLessons([]));
  }, []);

  if (lessons === null) return <p role="status">{copy.lessons.loading}</p>;
  if (lessons.length === 0) {
    return (
      <div class="card soon-card">
        <span class="icon-circle">
          <Icon name="book" size={26} />
        </span>
        <div>
          <h3>{t.emptyTitle}</h3>
          <p>{t.emptyText}</p>
        </div>
      </div>
    );
  }
  const newest = lessons.length > 1 ? newestOf(lessons) : null;
  const others = lessons.filter((l) => l.slug !== newest?.slug).slice(0, newest ? 5 : 6);
  const shown = newest ? [newest, ...others] : others;
  return (
    <div>
      <ul class="grid clean-list">
        {shown.map((lesson) => (
          <LessonCard lesson={lesson} key={lesson.id} featured={lesson.slug === newest?.slug} />
        ))}
      </ul>
      <div class="actions">
        <a class="button button-secondary" href="/lessons">
          {copy.lessons.seeAll}
        </a>
      </div>
    </div>
  );
}
