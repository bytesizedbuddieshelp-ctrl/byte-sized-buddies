import type { Lesson } from '../../lib/lessons';
import { deviceWords, levelWords } from '../../lib/lessons';
import { copy } from '../../content/copy';

// One lesson in the library or on the home page.
export function LessonCard({ lesson, level = 3 }: { lesson: Lesson; level?: 2 | 3 }) {
  // The library page goes h1 then cards, so its cards use h2. On the home page they sit under an h2 section.
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <li class="card lesson-card">
      <p>
        <span class="badge badge-sunshine">{copy.lessons.week(lesson.week_number)}</span>
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
