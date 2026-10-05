// Browser recording helpers for the video studio: camera, microphone, screen, mixing, and the recorder.
import { bubbleRect } from './studio';

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function openCamera(cameraId: string, micId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { ...(cameraId ? { deviceId: { exact: cameraId } } : {}), width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: { ...(micId ? { deviceId: { exact: micId } } : {}), echoCancellation: true, noiseSuppression: true },
  });
}

export async function listDevices(): Promise<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return { cameras: all.filter((d) => d.kind === 'videoinput'), mics: all.filter((d) => d.kind === 'audioinput') };
}

/** Asks the browser to share a window, tab, or screen. The studio's own tab is left out of the choices. */
export async function openScreen(tabAudio: boolean): Promise<MediaStream> {
  const options = {
    video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: tabAudio,
    selfBrowserSurface: 'exclude',
    systemAudio: 'exclude',
  };
  return navigator.mediaDevices.getDisplayMedia(options as DisplayMediaStreamOptions);
}

/** Why the camera or screen could not open, in a form the page can turn into words. */
export function mediaProblem(error: unknown): 'denied' | 'missing' | 'busy' | 'other' {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'other';
}

function playingVideo(stream: MediaStream): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  void video.play().catch(() => {});
  return video;
}

export interface Mix {
  stream: MediaStream;
  stop(): void;
}

/**
 * Builds the main part's stream: the shared screen, the microphone, sound from the shared tab (if any),
 * and a small round camera picture (if a camera stream is given).
 */
export function mixMain(screen: MediaStream, mic: MediaStream | null, bubble: MediaStream | null): Mix {
  const stops: (() => void)[] = [];
  const tracks: MediaStreamTrack[] = [];

  // Sound: mix the microphone with the tab's sound when both exist.
  const screenAudio = screen.getAudioTracks();
  const micAudio = mic?.getAudioTracks() ?? [];
  if (screenAudio.length && micAudio.length) {
    const ctx = new AudioContext();
    void ctx.resume();
    const out = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(new MediaStream(screenAudio)).connect(out);
    ctx.createMediaStreamSource(new MediaStream(micAudio)).connect(out);
    tracks.push(...out.stream.getAudioTracks());
    stops.push(() => void ctx.close());
  } else {
    tracks.push(...screenAudio, ...micAudio);
  }

  // Picture: the screen, or the screen with the camera circle drawn on top.
  const screenTrack = screen.getVideoTracks()[0];
  const cameraTrack = bubble?.getVideoTracks()[0];
  if (!cameraTrack) {
    tracks.push(screenTrack);
  } else {
    const settings = screenTrack.getSettings();
    const width = settings.width ?? 1920;
    const height = settings.height ?? 1080;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d')!;
    const screenVideo = playingVideo(new MediaStream([screenTrack]));
    const cameraVideo = playingVideo(new MediaStream([cameraTrack]));
    const circle = bubbleRect(width, height);

    const draw = () => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, width, height);
      const sw = screenVideo.videoWidth;
      const sh = screenVideo.videoHeight;
      if (sw && sh) {
        // Fit the whole screen inside the frame, even if the shared window changes size.
        const scale = Math.min(width / sw, height / sh);
        g.drawImage(screenVideo, (width - sw * scale) / 2, (height - sh * scale) / 2, sw * scale, sh * scale);
      }
      const cw = cameraVideo.videoWidth;
      const ch = cameraVideo.videoHeight;
      if (cw && ch) {
        const side = Math.min(cw, ch);
        g.save();
        g.beginPath();
        g.arc(circle.x + circle.size / 2, circle.y + circle.size / 2, circle.size / 2, 0, Math.PI * 2);
        g.clip();
        g.drawImage(cameraVideo, (cw - side) / 2, (ch - side) / 2, side, side, circle.x, circle.y, circle.size, circle.size);
        g.restore();
        g.lineWidth = Math.max(4, circle.size * 0.03);
        g.strokeStyle = '#FAF7F0'; // brand cream, so the circle stands out on any screen
        g.beginPath();
        g.arc(circle.x + circle.size / 2, circle.y + circle.size / 2, circle.size / 2, 0, Math.PI * 2);
        g.stroke();
      }
    };

    const worker = new Worker('/studio-timer.js');
    worker.onmessage = draw;
    worker.postMessage(1000 / 30);
    const canvasStream = canvas.captureStream(30);
    tracks.push(...canvasStream.getVideoTracks());
    stops.push(() => {
      worker.postMessage('stop');
      worker.terminate();
      stopStream(canvasStream);
      screenVideo.srcObject = null;
      cameraVideo.srcObject = null;
    });
  }

  return { stream: new MediaStream(tracks), stop: () => stops.forEach((s) => s()) };
}

let beeper: AudioContext | null = null;

/** A short tone for the 3-2-1 countdown. It is heard even when the studio tab is in the background. */
export function beep(high = false): void {
  try {
    beeper ??= new AudioContext();
    const osc = beeper.createOscillator();
    const gain = beeper.createGain();
    osc.frequency.value = high ? 880 : 660;
    gain.gain.setValueAtTime(0.2, beeper.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, beeper.currentTime + 0.25);
    osc.connect(gain).connect(beeper.destination);
    osc.start();
    osc.stop(beeper.currentTime + 0.25);
  } catch {
    // No sound is fine; the countdown is also on screen.
  }
}

/** Follows a microphone's loudness, from 0 to 1. Returns a function that stops listening. */
export function watchLevel(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const audio = stream.getAudioTracks();
  if (!audio.length) return () => {};
  const ctx = new AudioContext();
  void ctx.resume();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(new MediaStream(audio)).connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += v * v;
    onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
  }, 150);
  return () => {
    window.clearInterval(timer);
    void ctx.close();
  };
}
