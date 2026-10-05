// The live camera, with the plain wall behind the owner swapped for a background picture.
// The result is a new camera stream (picture + the same microphone), used for the preview,
// the opener and closer, and the small camera circle on screen recordings.
import { applyKey, averageColor, toKeyColor, type KeyColor, type RGB } from './keyer';

export interface KeySettings {
  on: boolean;
  wall: RGB | null;
  tolerance: number;
  softness: number;
}

const MAX_WIDTH = 1280;

export class CameraKeyer {
  readonly stream: MediaStream;
  private video: HTMLVideoElement;
  private raw: HTMLCanvasElement;
  private rawCtx: CanvasRenderingContext2D;
  private out: HTMLCanvasElement;
  private outCtx: CanvasRenderingContext2D;
  private background: ImageData | null = null;
  private frame: ImageData | null = null;
  private key: KeyColor | null = null;
  private settings: KeySettings = { on: false, wall: null, tolerance: 22, softness: 12 };
  private worker: Worker;
  private outStream: MediaStream;

  constructor(camera: MediaStream) {
    const settings = camera.getVideoTracks()[0]?.getSettings() ?? {};
    const scale = Math.min(1, MAX_WIDTH / (settings.width ?? MAX_WIDTH));
    const width = Math.round((settings.width ?? 1280) * scale);
    const height = Math.round((settings.height ?? 720) * scale);

    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = new MediaStream(camera.getVideoTracks());
    void this.video.play().catch(() => {});

    this.raw = Object.assign(document.createElement('canvas'), { width, height });
    this.rawCtx = this.raw.getContext('2d', { willReadFrequently: true })!;
    this.out = Object.assign(document.createElement('canvas'), { width, height });
    this.outCtx = this.out.getContext('2d')!;

    // A worker clock keeps the picture moving even when the studio tab is in the background.
    this.worker = new Worker('/studio-timer.js');
    this.worker.onmessage = () => this.draw();
    this.worker.postMessage(1000 / 30);

    this.outStream = this.out.captureStream(30);
    this.stream = new MediaStream([...this.outStream.getVideoTracks(), ...camera.getAudioTracks()]);
  }

  get width(): number {
    return this.out.width;
  }

  get height(): number {
    return this.out.height;
  }

  /** The canvas a background is drawn on: the same size as the camera picture. */
  makeBackgroundCanvas(): HTMLCanvasElement {
    return Object.assign(document.createElement('canvas'), { width: this.out.width, height: this.out.height });
  }

  setBackground(canvas: HTMLCanvasElement | null): void {
    this.background = canvas ? canvas.getContext('2d')!.getImageData(0, 0, this.out.width, this.out.height) : null;
  }

  setSettings(settings: KeySettings): void {
    this.settings = settings;
    this.key = settings.wall ? toKeyColor(settings.wall) : null;
  }

  /** The wall color at a point in the camera picture (0 to 1 across and down, as the camera sees it). */
  sample(x: number, y: number): RGB | null {
    if (!this.video.videoWidth) return null;
    this.rawCtx.drawImage(this.video, 0, 0, this.raw.width, this.raw.height);
    const data = this.rawCtx.getImageData(0, 0, this.raw.width, this.raw.height).data;
    const px = Math.round(Math.min(1, Math.max(0, x)) * (this.raw.width - 1));
    const py = Math.round(Math.min(1, Math.max(0, y)) * (this.raw.height - 1));
    return averageColor(data, this.raw.width, this.raw.height, px, py, Math.round(this.raw.width / 80));
  }

  /** The wall color from the two top corners, where a wall usually is. */
  sampleCorners(): RGB | null {
    const left = this.sample(0.06, 0.08);
    const right = this.sample(0.94, 0.08);
    if (!left || !right) return null;
    return [Math.round((left[0] + right[0]) / 2), Math.round((left[1] + right[1]) / 2), Math.round((left[2] + right[2]) / 2)];
  }

  private draw(): void {
    if (!this.video.videoWidth) return;
    const { width, height } = this.out;
    if (!this.settings.on || !this.key || !this.background) {
      this.outCtx.drawImage(this.video, 0, 0, width, height);
      return;
    }
    this.rawCtx.drawImage(this.video, 0, 0, width, height);
    const camera = this.rawCtx.getImageData(0, 0, width, height);
    this.frame ??= this.outCtx.createImageData(width, height);
    applyKey(camera.data, this.background.data, this.frame.data, this.key, this.settings.tolerance, this.settings.softness);
    this.outCtx.putImageData(this.frame, 0, 0);
  }

  stop(): void {
    this.worker.postMessage('stop');
    this.worker.terminate();
    this.outStream.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
  }
}
