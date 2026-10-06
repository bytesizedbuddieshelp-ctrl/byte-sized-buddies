import { useMemo } from 'preact/hooks';
import { Icon } from '../forms/Icon';
import { SlideViewer, PrintSlides, printSlides } from '../slides/SlideViewer';
import { copy } from '../../content/copy';
import { deviceWords, downloadsFor, extrasFor, fileUrl, formatBytes, imageUrlFor, levelWords, type Lesson } from '../../lib/lessons';
import { renderMarkdown } from '../../lib/markdown';
import { PlaylistPlayer } from '../video/PlaylistPlayer';

const t = copy.lesson;

// One PDF, two big buttons: "Read" opens it in the browser's own PDF reader (phone or computer), "Save" downloads it.
function PdfButtons({ label, file, primary = false }: { label: string; file: { path: string; bytes: number }; primary?: boolean }) {
  const url = fileUrl(file.path);
  const name = file.path.split('/').pop() ?? 'lesson.pdf';
  return (
    <span class="pdf-buttons">
      <a class={`button ${primary ? 'button-primary' : 'button-secondary'}`} href={url} target="_blank" rel="noopener noreferrer">
        <Icon name="book" size={24} />
        <span>
          {t.read} {label} ({t.pdf}, {formatBytes(file.bytes)})
        </span>
      </a>
      <a class="button button-secondary" href={`${url}?download=${encodeURIComponent(name)}`} aria-label={`${t.save} ${label}`}>
        <Icon name="download" size={24} />
        <span>{t.save}</span>
      </a>
    </span>
  );
}

// A whole lesson page. The public page and the owner's preview both use this.
export function LessonView({ lesson, draftNote = false, embedded = false }: { lesson: Lesson; draftNote?: boolean; embedded?: boolean }) {
  // Inside the admin shell the page already has an h1, so the lesson title becomes an h2.
  const Title = embedded ? 'h2' : 'h1';
  const downloads = downloadsFor(lesson.files);
  const guideHtml = useMemo(() => (lesson.teacher_guide_md ? renderMarkdown(lesson.teacher_guide_md, { allowImages: true, demoteHeadings: true }) : ''), [lesson.teacher_guide_md]);
  const imageUrl = (file: string) => imageUrlFor(lesson, file);
  const slides = lesson.slides?.slides ?? [];
  const videos = lesson.video_ids ?? [];
  const extras = extrasFor(lesson.files ?? {});

  return (
    <article>
      <div class="screen-only">
        {draftNote && <p class="admin-message">{t.adminDraft}</p>}
        <p>
          <span class="badge badge-sunshine">{copy.lessons.week(lesson.week_number)}</span>
        </p>
        <Title>{lesson.title}</Title>
        {lesson.summary && <p class="lead">{lesson.summary}</p>}
        <p class="lesson-badges">
          {lesson.devices.map((device) => (
            <span class="badge badge-tint" key={device}>
              {deviceWords[device] ?? device}
            </span>
          ))}
          <span class="badge badge-tint">{levelWords[lesson.level] ?? lesson.level}</span>
          <span class="caption">{copy.lessons.minutes(lesson.duration_minutes)}</span>
        </p>

        {lesson.objectives.length > 0 && (
          <section aria-labelledby="objectives-title">
            <h2 id="objectives-title">{t.objectives}</h2>
            <ul class="check-list">
              {lesson.objectives.map((objective) => (
                <li key={objective}>
                  <Icon name="check" size={24} />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="downloads-title">
          <h2 id="downloads-title">{t.downloads}</h2>
          {downloads.length === 0 && slides.length === 0 ? (
            <p>{t.downloadsNone}</p>
          ) : (
            <div class="button-row">
              {downloads.map((download) => (
                <PdfButtons key={download.key} label={download.label} file={download.file} primary />
              ))}
              {slides.length > 0 && (
                <button type="button" class="button button-secondary" onClick={() => void printSlides()}>
                  <Icon name="download" size={24} /> {copy.viewer.print}
                </button>
              )}
            </div>
          )}
        </section>

        {extras.length > 0 && (
          <section aria-labelledby="extras-title">
            <h2 id="extras-title">{t.extrasHeading}</h2>
            <p>{t.extrasIntro}</p>
            <div class="button-row">
              {extras.map((extra) => (
                <PdfButtons key={extra.path} label={extra.title} file={extra} />
              ))}
            </div>
          </section>
        )}

        {slides.length > 0 && (
          <section aria-labelledby="slides-title">
            <h2 id="slides-title">{t.slidesHeading}</h2>
            <SlideViewer slides={slides} lessonName={lesson.title} imageUrl={imageUrl} />
          </section>
        )}

        {videos.length > 0 && (
          <section aria-labelledby="video-title">
            <h2 id="video-title">{t.videoHeading}</h2>
            <PlaylistPlayer segments={videos} title={lesson.title} />
          </section>
        )}

        <section aria-labelledby="guide-title">
          <h2 id="guide-title">{t.guideHeading}</h2>
          {guideHtml ? <div class="prose guide" dangerouslySetInnerHTML={{ __html: guideHtml }} /> : <p>{t.noGuide}</p>}
        </section>

        <section aria-labelledby="license-title">
          <h2 id="license-title">{t.license}</h2>
          <p>
            {lesson.license}. <a href="/license">{t.licenseLink}</a>.
          </p>
          <div class="button-row">
            <a class="button button-secondary" href="/for-senior-homes#contact">
              {t.tell}
            </a>
            <button type="button" class="button button-secondary" onClick={() => window.print()}>
              {t.printGuide}
            </button>
          </div>
        </section>
      </div>
      {slides.length > 0 && <PrintSlides slides={slides} lessonName={lesson.title} imageUrl={imageUrl} />}
    </article>
  );
}
