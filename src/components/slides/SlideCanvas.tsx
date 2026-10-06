import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { slideImages, type Slide, type SlideImage } from '../../lib/slides';
import { Icon } from '../forms/Icon';
import { copy } from '../../content/copy';
import '../../styles/slides.css';

interface CanvasProps {
  slide: Slide;
  lessonName: string;
  imageUrl: (file: string) => string;
  /** "print" draws the slide in black on white, with no colored backgrounds. */
  mode?: 'screen' | 'print';
  /** The countdown shown on "try it" slides, for example "4:59". */
  timerText?: string;
}

function Photo({ image, imageUrl }: { image: SlideImage; imageUrl: CanvasProps['imageUrl'] }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p class="slide-picture-missing">{copy.viewer.missingImage}: {image.file}</p>
  ) : (
    <img src={imageUrl(image.file)} alt={image.alt} onError={() => setFailed(true)} />
  );
}

// The photo spot: one photo fills it; two sit side by side; three or four make a grid.
function Picture({ slide, imageUrl }: Pick<CanvasProps, 'slide' | 'imageUrl'>) {
  const photos = slideImages(slide);
  if (!photos.length) return null;
  return (
    <div class={`slide-picture photos-${Math.min(photos.length, 4)}`}>
      {photos.map((image, i) => (
        <div class="slide-photo" key={`${i}-${image.file}`}>
          <Photo image={image} imageUrl={imageUrl} />
        </div>
      ))}
    </div>
  );
}

function Footer({ lessonName, reversed }: { lessonName: string; reversed: boolean }) {
  return (
    <div class="slide-footer">
      {reversed ? (
        <span class="logo-tile logo-tile-mark">
          <img src="/logos/byte-sized-buddies-mark-reversed.svg" width={32} height={32} alt="" />
        </span>
      ) : (
        <img src="/logos/byte-sized-buddies-mark.svg" width={32} height={32} alt="" />
      )}
      <span>{lessonName}</span>
    </div>
  );
}

// One slide, drawn at 1920 x 1080. Wrap it in <SlideFrame> to scale it to fit.
export function SlideCanvas({ slide, lessonName, imageUrl, mode = 'screen', timerText }: CanvasProps) {
  const lines = slide.body ?? [];
  const hasImage = slideImages(slide).length > 0 && (slide.layout === 'idea' || slide.layout === 'step');

  if (slide.layout === 'title') {
    const print = mode === 'print';
    return (
      <div class="slide slide--title">
        <div class="slide-main">
          {print ? (
            <img class="slide-logo" src="/logos/byte-sized-buddies-logo-horizontal.svg" width={420} height={134} alt="" />
          ) : (
            <span class="logo-tile logo-tile-wide" style="align-self: flex-start;">
              <img class="slide-logo" src="/logos/byte-sized-buddies-logo-horizontal-reversed.svg" width={420} height={134} alt="" />
            </span>
          )}
          <h2 class="slide-heading">{slide.title}</h2>
          {slide.subtitle && <p class="slide-text">{slide.subtitle}</p>}
          <div class="slide-bar" />
        </div>
        <Footer lessonName={lessonName} reversed={mode === 'screen'} />
      </div>
    );
  }

  if (slide.layout === 'tryit') {
    return (
      <div class="slide">
        <div class="slide-panel slide-panel--tryit">
          <span class="slide-label">{copy.viewer.tryIt}</span>
          <h2 class="slide-heading">{slide.title}</h2>
          {lines.map((line, i) => (
            <p class="slide-text" key={i}>{line}</p>
          ))}
          {slide.timer_minutes && (
            <p class="slide-timer">
              {timerText ?? `${slide.timer_minutes}:00`}
              <small>{copy.viewer.minutes}</small>
            </p>
          )}
        </div>
        <Footer lessonName={lessonName} reversed={false} />
      </div>
    );
  }

  if (slide.layout === 'recap') {
    return (
      <div class="slide">
        <div class="slide-main">
          <h2 class="slide-heading">{slide.title}</h2>
          <ul class="slide-bullets">
            {(slide.bullets ?? []).map((bullet, i) => (
              <li key={i}>
                <Icon name="check" size={56} />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <Footer lessonName={lessonName} reversed={false} />
      </div>
    );
  }

  if (slide.layout === 'keepit') {
    return (
      <div class="slide">
        <div class="slide-panel slide-panel--keepit">
          <h2 class="slide-heading">{slide.title}</h2>
          {lines.map((line, i) => (
            <p class="slide-text" key={i}>{line}</p>
          ))}
        </div>
        <Footer lessonName={lessonName} reversed={false} />
      </div>
    );
  }

  if (slide.layout === 'step') {
    return (
      <div class="slide">
        <div class={`slide-columns step${hasImage ? ' has-image' : ''}`}>
          <div>
            <div class="step-number" aria-hidden="true">{slide.step}</div>
            <h2 class="slide-step-title">{slide.title}</h2>
            {lines.map((line, i) => (
              <p class="slide-text" key={i}>{line}</p>
            ))}
          </div>
          {hasImage && <Picture slide={slide} imageUrl={imageUrl} />}
        </div>
        <Footer lessonName={lessonName} reversed={false} />
      </div>
    );
  }

  // idea
  return (
    <div class="slide">
      <div class={`slide-columns${hasImage ? ' has-image' : ''}`}>
        <div>
          <h2 class="slide-heading" style="margin-bottom: 32px;">{slide.title}</h2>
          {lines.map((line, i) => (
            <p class="slide-text" key={i}>{line}</p>
          ))}
        </div>
        {hasImage && <Picture slide={slide} imageUrl={imageUrl} />}
      </div>
      <Footer lessonName={lessonName} reversed={false} />
    </div>
  );
}

// Scales a 1920 x 1080 slide to fit whatever width it is given.
export function SlideFrame({ children }: { children: ComponentChildren }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1920);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div class="slide-frame" ref={frame}>
      <div class="slide-scale" style={`transform: scale(${scale});`}>
        {children}
      </div>
    </div>
  );
}
