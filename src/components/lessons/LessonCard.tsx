import type { LessonSummary } from '../../lib/lessons';
import { deviceWords, levelWords } from '../../lib/lessons';
import { copy } from '../../content/copy';

// One lesson in the library or on the home page. `featured` marks the newest lesson with a label in words.
export function LessonCard({ lesson, level = 3, featured = false }: { lesson: LessonSummary; level?: 2 | 3; featured?: boolean }) {
  // The library page goes h1 then cards, so its cards use h2. On the home page they sit under an h2 section.
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <li class={`card lesson-card${featured ? ' lesson-card--featured' : ''}`}>
      <p>
        <span class="badge badge-sunshine">{copy.lessons.week(lesson.week_number)}</span>
        {featured && <span class="badge badge-tint">{copy.lessons.newest}</span>}
      </p>
      <Heading>
        <a href={`/lesson?slug=${encodeURIComponent(lesson.slug)}`}>{lesson.title}</a>
      </Heading>
      {lesson.summary && <p>{lesson.summary}</p>}
      <p class="lesson-badges">
        {lesson.devices.map((device) => (
          <span class="badge badge-tint" key={device}>
            {deviceWords[device] ?? device}
          </span>
        ))}
        <span class="badge badge-tint">{levelWords[lesson.level] ?? lesson.level}</span>
        <span class="caption">{copy.lessons.minutes(lesson.duration_minutes)}</span>
      </p>
    </li>
  );
}
