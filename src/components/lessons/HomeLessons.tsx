import { useEffect, useState } from 'preact/hooks';
import { fetchPublishedLessons, type Lesson } from '../../lib/lessons';
import { isConfigured } from '../../lib/config';
import { LessonCard } from './LessonCard';
import { Icon } from '../forms/Icon';
import { copy } from '../../content/copy';

const t = copy.home.lessons;

// Up to six published lessons for the home page. With none, a calm card. Never made-up lessons.
export default function HomeLessons() {
  const [lessons, setLessons] = useState<Lesson[] | null>(isConfigured ? null : []);

  useEffect(() => {
    if (!isConfigured) return;
    fetchPublishedLessons(6).then(setLessons).catch(() => setLessons([]));
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
  return (
    <div>
      <ul class="grid clean-list">
        {lessons.slice(0, 6).map((lesson) => (
          <LessonCard lesson={lesson} key={lesson.id} />
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
