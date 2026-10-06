import { useEffect, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { Icon } from '../forms/Icon';
import { LessonView } from '../lessons/LessonView';
import type { Lesson } from '../../lib/lessons';
import { adminCopy as a } from '../../content/adminCopy';

export default function LessonPreviewPage() {
  return (
    <AdminShell current="lessons" title={a.lessonEdit.titlePreview}>
      {(supabase) => <Preview supabase={supabase} />}
    </AdminShell>
  );
}

// The owner can read drafts, so this shows a lesson exactly as the public page will, before it is published.
function Preview({ supabase }: { supabase: SupabaseClient }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading');

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('slug') ?? '';
    supabase
      .from('lessons')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setState('missing');
        setLesson(data as Lesson);
        setState('ready');
      });
  }, []);

  return (
    <div>
      <div class="button-row">
        <a class="button button-secondary" href="/admin/lessons">
          {a.lessonEdit.back}
        </a>
        {state === 'ready' && lesson && (
          <a class="button button-primary" href={`/admin/present?slug=${encodeURIComponent(lesson.slug)}`}>
            <Icon name="play" size={24} /> {a.lessonEdit.present}
          </a>
        )}
      </div>
      {state === 'loading' && <p role="status">{a.lessonEdit.loading}</p>}
      {state === 'missing' && <p class="admin-message is-error" role="alert">{a.lessonEdit.notFound}</p>}
      {state === 'ready' && lesson && <LessonView lesson={lesson} draftNote={lesson.status === 'draft'} embedded />}
    </div>
  );
}
