import { useMemo } from 'preact/hooks';
import { Icon } from '../forms/Icon';
import { SlideViewer, PrintSlides, printSlides } from '../slides/SlideViewer';
import { copy } from '../../content/copy';
import { deviceWords, downloadsFor, fileUrl, formatBytes, imageUrlFor, levelWords, type Lesson } from '../../lib/lessons';
import { renderMarkdown } from '../../lib/markdown';
import { youTubeEmbedUrl } from '../../lib/youtube';

const t = copy.lesson;

// A whole lesson page. The public page and the owner's preview both use this.
export function LessonView({ lesson, draftNote = false, embedded = false }: { lesson: Lesson; draftNote?: boolean; embedded?: boolean }) {
  // Inside the admin shell the page already has an h1, so the lesson title becomes an h2.
  const Title = embedded ? 'h2' : 'h1';
  const downloads = downloadsFor(lesson.files);
  const guideHtml = useMemo(() => (lesson.teacher_guide_md ? renderMarkdown(lesson.teacher_guide_md, { allowImages: true, demoteHeadings: true }) : ''), [lesson.teacher_guide_md]);
  const imageUrl = (file: string) => imageUrlFor(lesson, file);
  const slides = lesson.slides?.slides ?? [];
  const videos = lesson.video_ids ?? [];

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
                <a class="button button-primary" key={download.key} href={fileUrl(download.file.path)} target="_blank" rel="noopener noreferrer">
                  <Icon name="download" size={24} />
                  <span>
                    {download.label} ({t.pdf}, {formatBytes(download.file.bytes)})
                  </span>
                </a>
              ))}
              {slides.length > 0 && (
                <button type="button" class="button button-secondary" onClick={() => void printSlides()}>
                  <Icon name="download" size={24} /> {copy.viewer.print}
                </button>
              )}
            </div>
          )}
        </section>

        {slides.length > 0 && (
          <section aria-labelledby="slides-title">
            <h2 id="slides-title">{t.slidesHeading}</h2>
            <SlideViewer slides={slides} lessonName={lesson.title} imageUrl={imageUrl} />
          </section>
        )}

        {videos.length > 0 && (
          <section aria-labelledby="video-title">
            <h2 id="video-title">{t.videoHeading}</h2>
            {videos.map((video, i) => (
              <div key={video.youtube_id + i} style="margin-bottom: 24px;">
                <p class="label">{t.videoPart(i + 1, videos.length, video.label)}</p>
                <div class="video-frame">
                  <iframe
                    src={youTubeEmbedUrl(video.youtube_id)}
                    title={t.videoTitle(lesson.title, video.label)}
                    loading="lazy"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allow="encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ))}
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
