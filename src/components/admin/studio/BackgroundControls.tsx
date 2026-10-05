import { useEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import { Icon } from '../../forms/Icon';
import { adminCopy as a } from '../../../content/adminCopy';
import { BACKGROUND_KINDS, drawBackground, loadImage, type BackgroundKind } from '../../../lib/backgrounds';
import type { CameraKeyer, KeySettings } from '../../../lib/cameraKeyer';
import { saveBlob } from '../../../lib/lessonAdmin';
import type { RGB } from '../../../lib/keyer';

const t = a.studio.bg;
const STORE = 'bsb-studio-background';

interface Saved extends KeySettings {
  kind: BackgroundKind;
}

const defaults: Saved = { on: false, wall: null, tolerance: 22, softness: 12, kind: 'garden' };

// Remembered on this computer only, so the owner doesn't have to set it up every time.
function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    return saved && typeof saved === 'object' ? { ...defaults, ...saved, kind: saved.kind === 'custom' ? 'garden' : saved.kind ?? 'garden' } : defaults;
  } catch {
    return defaults;
  }
}

// "Replace my wall": pick the wall's color, choose a background, and fine-tune.
export function BackgroundControls({ keyer, preview, disabled }: { keyer: CameraKeyer; preview: RefObject<HTMLVideoElement>; disabled: boolean }) {
  const [settings, setSettings] = useState<Saved>(load);
  const [custom, setCustom] = useState<HTMLImageElement | null>(null);
  const [customProblem, setCustomProblem] = useState('');
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState('');
  const customUrl = useRef('');

  const update = (changes: Partial<Saved>) => setSettings((s) => ({ ...s, ...changes }));

  // Send the settings to the camera, and remember them.
  useEffect(() => {
    keyer.setSettings(settings);
    try {
      localStorage.setItem(STORE, JSON.stringify(settings));
    } catch {
      // Not remembered; it still works.
    }
  }, [keyer, settings]);

  // Draw the chosen background at the camera's size.
  useEffect(() => {
    if (settings.kind === 'custom' && !custom) return keyer.setBackground(null);
    const canvas = keyer.makeBackgroundCanvas();
    let cancelled = false;
    drawBackground(canvas, settings.kind, custom).then(() => {
      if (!cancelled) keyer.setBackground(canvas);
    });
    return () => {
      cancelled = true;
    };
  }, [keyer, settings.kind, custom]);

  // Picking: the next click on the preview reads the wall color there. The preview is a mirror, so left and right swap.
  useEffect(() => {
    const el = preview.current;
    if (!picking || !el) return;
    const onClick = (event: MouseEvent) => {
      const box = el.getBoundingClientRect();
      const wall = keyer.sample(1 - (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
      setPicking(false);
      if (wall) chosen(wall);
    };
    el.classList.add('is-picking');
    el.addEventListener('click', onClick);
    return () => {
      el.classList.remove('is-picking');
      el.removeEventListener('click', onClick);
    };
  }, [picking, keyer]);

  useEffect(() => () => URL.revokeObjectURL(customUrl.current), []);

  function chosen(wall: RGB) {
    update({ wall, on: true });
    setNote(t.picked);
  }

  async function chooseCustom(file: File | undefined) {
    setCustomProblem('');
    if (!file) return;
    URL.revokeObjectURL(customUrl.current);
    customUrl.current = URL.createObjectURL(file);
    try {
      setCustom(await loadImage(customUrl.current));
      update({ kind: 'custom' });
    } catch {
      setCustomProblem(t.customBad);
    }
  }

  async function download() {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1920, height: 1080 });
    await drawBackground(canvas, settings.kind, custom);
    canvas.toBlob((blob) => blob && saveBlob(`byte-sized-buddies-background-${settings.kind}.png`, blob, 'image/png'), 'image/png');
  }

  return (
    <details class="studio-settings" open={settings.on}>
      <summary>{settings.on ? t.summaryOn : t.summaryOff}</summary>
      <fieldset class="choice-group">
        <legend>{t.legend}</legend>
        <label class="choice">
          <input type="radio" name="studio-bg" checked={!settings.on} disabled={disabled} onChange={() => update({ on: false })} />
          <span>{t.off}</span>
        </label>
        <label class="choice">
          <input type="radio" name="studio-bg" checked={settings.on} disabled={disabled} onChange={() => update({ on: true })} />
          <span>{t.on}</span>
        </label>
      </fieldset>

      {settings.on && (
        <>
          <p class="field-helper">{t.help}</p>
          <div class="button-row">
            {picking ? (
              <button type="button" class="button button-secondary" onClick={() => setPicking(false)}>{t.cancelPick}</button>
            ) : (
              <button type="button" class="button button-primary" disabled={disabled} onClick={() => { setNote(''); setPicking(true); }}>
                {t.pick}
              </button>
            )}
            <button type="button" class="button button-secondary" disabled={disabled || picking} onClick={() => { const wall = keyer.sampleCorners(); if (wall) chosen(wall); }}>
              {t.corners}
            </button>
          </div>
          <p role="status" class="studio-wall">
            {picking ? (
              t.picking
            ) : settings.wall ? (
              <>
                <span class="studio-swatch" aria-hidden="true" style={{ background: `rgb(${settings.wall.join(',')})` }} /> {note || t.picked}
              </>
            ) : (
              t.notPicked
            )}
          </p>

          <fieldset class="choice-group">
            <legend>{t.kindLegend}</legend>
            {BACKGROUND_KINDS.map((kind) => (
              <label class="choice" key={kind}>
                <input type="radio" name="studio-bg-kind" checked={settings.kind === kind} disabled={disabled} onChange={() => update({ kind })} />
                <span>{t.kinds[kind]}</span>
              </label>
            ))}
          </fieldset>
          {settings.kind === 'custom' && (
            <div class="field">
              <label class="field-label" for="studio-bg-file">{t.customLabel}</label>
              <p class="field-helper" id="studio-bg-file-help">{t.customHelp}</p>
              <input id="studio-bg-file" class="field-control" type="file" accept=".png,.jpg,.jpeg,.webp" aria-describedby="studio-bg-file-help" onChange={(e) => void chooseCustom(e.currentTarget.files?.[0])} />
              {customProblem && <p class="field-error"><Icon name="alert" size={24} /><span>{customProblem}</span></p>}
            </div>
          )}

          <div class="field prompt-speed">
            <label class="field-label" for="studio-tolerance">{t.tolerance}: {settings.tolerance}</label>
            <p class="field-helper" id="studio-tolerance-help">{t.toleranceHelp}</p>
            <input id="studio-tolerance" type="range" min={4} max={70} value={settings.tolerance} aria-describedby="studio-tolerance-help" onInput={(e) => update({ tolerance: Number(e.currentTarget.value) })} />
          </div>
          <div class="field prompt-speed">
            <label class="field-label" for="studio-softness">{t.softness}: {settings.softness}</label>
            <p class="field-helper" id="studio-softness-help">{t.softnessHelp}</p>
            <input id="studio-softness" type="range" min={2} max={40} value={settings.softness} aria-describedby="studio-softness-help" onInput={(e) => update({ softness: Number(e.currentTarget.value) })} />
          </div>
          <p class="caption">{t.tip}</p>
          <button type="button" class="button button-secondary" disabled={settings.kind === 'custom' && !custom} onClick={() => void download()}>
            <Icon name="download" size={24} /> {t.download}
          </button>
        </>
      )}
    </details>
  );
}
