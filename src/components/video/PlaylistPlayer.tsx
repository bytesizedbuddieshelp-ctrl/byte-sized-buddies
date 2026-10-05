import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../forms/Icon';
import { copy } from '../../content/copy';
import type { VideoSegment } from '../../lib/lessons';
import { parseYouTubeId, youTubePlayerUrl } from '../../lib/youtube';
import { loadYouTubeApi } from '../../lib/youtubeApi';

const t = copy.player;

// Plays a video made of parts (for example Opener, Main, Closer), one after another.
// Nothing loads from YouTube until the person presses Play, and nothing plays by itself before that.
export function PlaylistPlayer({ segments: given, title }: { segments: VideoSegment[]; title: string }) {
  const segments = given.filter((s) => parseYouTubeId(s.youtube_id) === s.youtube_id);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [ended, setEnded] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const total = segments.length;
  const current = segments[Math.min(index, total - 1)];

  // Each part gets a fresh frame. When the controller is available, it tells us when the part ends.
  // The old frame is removed by the page itself, so the controller's destroy() is never called
  // (it would try to remove the same frame a second time). Messages from an old frame are ignored.
  useEffect(() => {
    if (!started || !frame.current) return;
    let cancelled = false;
    const element = frame.current;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !YT) return;
      new YT.Player(element, {
        events: {
          onStateChange: (event) => {
            if (cancelled || event.data !== YT.PlayerState.ENDED) return;
            if (index < total - 1) setIndex(index + 1);
            else setEnded(true);
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [started, index, total]);

  function go(next: number) {
    setEnded(false);
    setIndex(Math.max(0, Math.min(total - 1, next)));
  }

  if (total === 0) return null;

  if (!started) {
    return (
      <div class="playlist">
        <div class="playlist-start">
          <button type="button" class="button button-primary" onClick={() => setStarted(true)}>
            <Icon name="play" size={28} /> {t.playParts(total)}
          </button>
          {total > 1 && <p>{t.partsIntro(segments.map((s, i) => s.label || String(i + 1)))}</p>}
          <p class="caption">{t.privacy}</p>
        </div>
      </div>
    );
  }

  return (
    <div class="playlist">
      <p class="label" aria-live="polite">
        {t.part(index + 1, total, current.label)}
      </p>
      <div class="video-frame">
        <iframe
          key={`${index}-${current.youtube_id}`}
          ref={frame}
          src={youTubePlayerUrl(current.youtube_id, { autoplay: true, origin: window.location.origin })}
          title={t.frameTitle(title, current.label)}
          referrerpolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      {ended && (
        <p class="playlist-ended" role="status">
          {t.ended}{' '}
          <button type="button" class="button button-secondary" onClick={() => go(0)}>
            {t.again}
          </button>
        </p>
      )}
      {total > 1 && (
        <>
          <div class="button-row playlist-controls">
            <button type="button" class="button button-secondary" disabled={index === 0} onClick={() => go(index - 1)}>
              <Icon name="arrow-left" size={24} /> {t.prev}
            </button>
            <button type="button" class="button button-primary" disabled={index === total - 1} onClick={() => go(index + 1)}>
              {t.next} <Icon name="arrow-right" size={24} />
            </button>
          </div>
          <nav aria-label={t.partsLabel}>
            <ul class="playlist-parts">
              {segments.map((s, i) => (
                <li key={`${i}-${s.youtube_id}`}>
                  <button type="button" class="chip" aria-current={i === index ? 'true' : undefined} onClick={() => go(i)}>
                    {t.goTo(i + 1, s.label)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
      <p class="caption">{t.captions}</p>
    </div>
  );
}
