import { useEffect, useState } from 'preact/hooks';
import { LessonView } from './LessonView';
import { fetchLessonIndex, fetchPublishedLesson, type Lesson, type LessonSummary } from '../../lib/lessons';
import { neighborsOf, relatedTo } from '../../lib/lessonFilters';
import { LessonCard } from './LessonCard';
import { isConfigured } from '../../lib/config';
import { copy } from '../../content/copy';

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; lesson: Lesson };
const t = copy.lesson;

// /lesson?slug=... : loads one published lesson from the database in the browser.
export default function LessonPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [others, setOthers] = useState<LessonSummary[]>([]);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('slug') ?? '';
    if (!isConfigured || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return setState({ kind: 'missing' });
    fetchPublishedLesson(slug)
      .then((lesson) => {
        if (!lesson) return setState({ kind: 'missing' });
        document.title = `${lesson.title} | ${copy.siteName}`;
        setState({ kind: 'ready', lesson });
      })
      .catch(() => setState({ kind: 'error' }));
    // The links to other lessons are a bonus. If they don't load, the lesson itself still shows.
    if (isConfigured) fetchLessonIndex().then(setOthers).catch(() => undefined);
  }, []);

  if (state.kind === 'loading') return <p role="status">{t.loading}</p>;
  if (state.kind === 'error') return <p class="admin-message is-error" role="alert">{copy.lessons.loadError}</p>;
  if (state.kind === 'missing') {
    return (
      <div>
        <h1>{t.notFoundTitle}</h1>
        <p class="lead">{t.notFoundText}</p>
        <div class="actions">
          <a class="button button-primary" href="/lessons">
            {t.library}
          </a>
        </div>
      </div>
    );
  }
  const { previous, next } = neighborsOf(others, state.lesson.slug);
  const related = relatedTo(others, state.lesson).filter((l) => l.slug !== previous?.slug && l.slug !== next?.slug);
  return (
    <div>
      <LessonView lesson={state.lesson} />
      {(previous || next) && (
        <nav class="screen-only lesson-nav" aria-label={t.moreHeading}>
          <h2>{t.moreHeading}</h2>
          <div class="button-row">
            {previous && (
              <a class="button button-secondary" href={`/lesson?slug=${encodeURIComponent(previous.slug)}`}>
                <span class="visually-hidden">{t.previousLesson}: </span>
                &larr; {previous.title}
              </a>
            )}
            {next && (
              <a class="button button-primary" href={`/lesson?slug=${encodeURIComponent(next.slug)}`}>
                <span class="visually-hidden">{t.nextLesson}: </span>
                {next.title} &rarr;
              </a>
            )}
          </div>
        </nav>
      )}
      {related.length > 0 && (
        <section class="screen-only" aria-labelledby="related-title">
          <h2 id="related-title">{t.relatedHeading}</h2>
          <ul class="grid clean-list">
            {related.map((lesson) => (
              <LessonCard lesson={lesson} key={lesson.id} />
            ))}
          </ul>
          <div class="actions">
            <a class="button button-secondary" href="/lessons">
              {t.allLessons}
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
