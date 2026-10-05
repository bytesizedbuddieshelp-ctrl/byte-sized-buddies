// Loads YouTube's player controller (the IFrame API) only when someone presses Play.
// It lets the playlist player notice when a part ends and start the next one.
// If it can't load (blocked, offline), the videos still play; they just don't move on by themselves.

export interface YTPlayer {
  destroy(): void;
}

interface YTNamespace {
  Player: new (element: HTMLIFrameElement, options: { events: { onStateChange?: (event: { data: number }) => void } }) => YTPlayer;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YTNamespace | null> | null = null;

export function loadYouTubeApi(timeoutMs = 8000): Promise<YTNamespace | null> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      before?.();
      window.clearTimeout(timer);
      resolve(window.YT ?? null);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => {
      window.clearTimeout(timer);
      loading = null;
      resolve(null);
    };
    document.head.appendChild(tag);
  });
  return loading;
}
