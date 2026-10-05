import { useEffect, useState } from 'preact/hooks';
import { LessonView } from './LessonView';
import { fetchPublishedLesson, type Lesson } from '../../lib/lessons';
import { isConfigured } from '../../lib/config';
import { copy } from '../../content/copy';

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; lesson: Lesson };
const t = copy.lesson;

// /lesson?slug=... : loads one published lesson from the database in the browser.
export default function LessonPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });

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
  return <LessonView lesson={state.lesson} />;
}
