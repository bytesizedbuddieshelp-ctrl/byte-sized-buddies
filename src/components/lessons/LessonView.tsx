import { useMemo, useState } from 'preact/hooks';
import { Icon } from '../forms/Icon';
import { SlideViewer, PrintSlides, printSlides } from '../slides/SlideViewer';
import { copy } from '../../content/copy';
import { deviceWords, downloadsFor, extrasFor, fileUrl, formatBytes, imageUrlFor, levelWords, type Lesson } from '../../lib/lessons';
import { renderMarkdown } from '../../lib/markdown';
import { lessonPlan } from '../../lib/lessonFilters';
import { PlaylistPlayer } from '../video/PlaylistPlayer';
import ReadAloud from '../reading/ReadAloud';

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
  const plan = useMemo(() => lessonPlan(lesson.duration_minutes), [lesson.duration_minutes]);
  const [shareNote, setShareNote] = useState('');
  const [zipNote, setZipNote] = useState('');
  const [zipping, setZipping] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lesson?slug=${encodeURIComponent(lesson.slug)}`);
      setShareNote(t.shareCopied);
    } catch {
      setShareNote(t.shareFailed);
    }
  }

  // The zip code is loaded only when the button is pressed, so the lesson page stays light.
  async function downloadAll() {
    setZipping(true);
    setZipNote(t.allFilesWorking);
    try {
      const { buildKitZip, saveBlob } = await import('../../lib/lessonAdmin');
      saveBlob(`${lesson.slug}-kit.zip`, (await buildKitZip(lesson)) as BlobPart, 'application/zip');
      setZipNote('');
    } catch {
      setZipNote(t.allFilesFailed);
    }
    setZipping(false);
  }

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

        <div class="sheet glance" role="group" aria-labelledby="glance-title">
          <h2 id="glance-title" class="aside-heading">{t.glanceHeading}</h2>
          <dl class="glance-list">
            <div>
              <dt>{t.glance.time}</dt>
              <dd>{copy.lessons.minutes(lesson.duration_minutes)}</dd>
            </div>
            <div>
              <dt>{t.glance.level}</dt>
              <dd>{levelWords[lesson.level] ?? lesson.level}</dd>
            </div>
            <div>
              <dt>{t.glance.devices}</dt>
              <dd>{lesson.devices.map((d) => deviceWords[d] ?? d).join(', ')}</dd>
            </div>
            {lesson.topic && (
              <div>
                <dt>{t.glance.topic}</dt>
                <dd>{lesson.topic}</dd>
              </div>
            )}
            <div>
              <dt>{t.glance.bring}</dt>
              <dd>{t.glance.bringItems}</dd>
            </div>
          </dl>
        </div>

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

        {!draftNote && downloads.length > 0 && (
          <section aria-labelledby="zip-title">
            <h2 id="zip-title" class="visually-hidden">
              {t.allFiles}
            </h2>
            <p>{t.allFilesHelp}</p>
            <div class="button-row">
              <button type="button" class="button button-secondary" disabled={zipping} onClick={() => void downloadAll()}>
                <Icon name="download" size={24} /> {t.allFiles}
              </button>
            </div>
            <p class="caption" role="status">
              {zipNote}
            </p>
          </section>
        )}

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

        <section aria-labelledby="plan-title">
          <h2 id="plan-title">{t.planHeading}</h2>
          <p>{t.planIntro(lesson.duration_minutes)}</p>
          <ol class="timeline">
            {plan.map((step, index) => (
              <li key={step.title}>
                <div class="step-number" aria-hidden="true">
                  {index + 1}
                </div>
                <h3>
                  <span class="visually-hidden">Step {index + 1}: </span>
                  {step.title}
                </h3>
                <span class="minutes">{t.planMinutes(step.minutes)}</span>
                <p>{step.text}</p>
                <p class="caption">{t.planStarts(step.startsAt)}</p>
              </li>
            ))}
          </ol>
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
            <PlaylistPlayer segments={videos} title={lesson.title} />
          </section>
        )}

        <section aria-labelledby="guide-title">
          <h2 id="guide-title">{t.guideHeading}</h2>
          {guideHtml && <ReadAloud target="#guide-body" />}
          {guideHtml ? <div id="guide-body" class="prose guide" dangerouslySetInnerHTML={{ __html: guideHtml }} /> : <p>{t.noGuide}</p>}
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
            {!draftNote && !embedded && (
              <button type="button" class="button button-secondary" onClick={() => void copyLink()}>
                {t.shareButton}
              </button>
            )}
            <button type="button" class="button button-secondary" onClick={() => window.print()}>
              {t.printGuide}
            </button>
          </div>
          <p class="caption" role="status">
            {shareNote}
          </p>
        </section>
      </div>
      {slides.length > 0 && <PrintSlides slides={slides} lessonName={lesson.title} imageUrl={imageUrl} />}
    </article>
  );
}
