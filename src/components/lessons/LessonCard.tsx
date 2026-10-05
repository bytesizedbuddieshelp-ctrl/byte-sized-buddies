import type { Lesson } from '../../lib/lessons';
import { deviceWords, levelWords } from '../../lib/lessons';
import { copy } from '../../content/copy';

// One lesson in the library or on the home page.
export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <li class="card lesson-card">
      <p>
        <span class="badge badge-sunshine">{copy.lessons.week(lesson.week_number)}</span>
      </p>
      <h3>
        <a href={`/lesson?slug=${encodeURIComponent(lesson.slug)}`}>{lesson.title}</a>
      </h3>
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
