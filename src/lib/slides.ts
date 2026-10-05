// The slide format (CLAUDE.md section 7.1). Slides are plain data, drawn by the website in the brand style.
// validateDeck() checks the data and writes friendly messages that name the slide number.

export const LAYOUTS = ['title', 'idea', 'step', 'tryit', 'recap', 'keepit'] as const;
export type Layout = (typeof LAYOUTS)[number];

export interface SlideImage {
  file: string;
  alt: string;
}

export interface Slide {
  layout: Layout;
  title: string;
  subtitle?: string;
  body?: string[];
  bullets?: string[];
  step?: number;
  image?: SlideImage;
  timer_minutes?: number;
  notes?: string;
}

export interface SlideDeck {
  version: 1;
  slides: Slide[];
}

export interface DeckResult {
  deck: SlideDeck | null;
  errors: string[];
  warnings: string[];
}

export const MAX_SLIDES = 60;
export const BODY_WORD_LIMIT = 25;
const IMAGE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.(png|jpe?g|webp|svg)$/i;

export function countWords(lines: string[] | undefined): number {
  return (lines ?? []).join(' ').trim().split(/\s+/).filter(Boolean).length;
}

/** Slide images named in a deck, in order, without repeats. */
export function imageFilesIn(deck: SlideDeck): string[] {
  return [...new Set(deck.slides.flatMap((slide) => (slide.image ? [slide.image.file] : [])))];
}

export function emptyDeck(): SlideDeck {
  return { version: 1, slides: [] };
}

/** Turns the text from a JSON box into a deck. A typing mistake gets a plain message, not a code error. */
export function parseDeckText(text: string): DeckResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const position = /position (\d+)/.exec(error instanceof Error ? error.message : '')?.[1];
    const near = position ? ` Look near character ${position}.` : '';
    return { deck: null, errors: [`The slides text has a typing mistake and can't be read.${near} Check commas, quote marks, and brackets.`], warnings: [] };
  }
  return validateDeck(raw);
}

const isText = (value: unknown): value is string => typeof value === 'string';
const textList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);

export function validateDeck(input: unknown): DeckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (deck = null as SlideDeck | null): DeckResult => ({ deck, errors, warnings });

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    errors.push('The slides should be an object that looks like {"version": 1, "slides": [ ... ]}.');
    return fail();
  }
  const data = input as Record<string, unknown>;
  if (data.version !== 1) errors.push('The slides need "version": 1 at the top.');
  if (!Array.isArray(data.slides)) {
    errors.push('The slides need a list called "slides".');
    return fail();
  }
  if (data.slides.length > MAX_SLIDES) errors.push(`There are ${data.slides.length} slides. The most we allow is ${MAX_SLIDES}.`);

  const slides: Slide[] = [];
  data.slides.forEach((raw, index) => {
    const n = index + 1;
    const where = `Slide ${n}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      errors.push(`${where} should be an object like {"layout": "idea", "title": "..."}.`);
      return;
    }
    const s = raw as Record<string, unknown>;
    if (!isText(s.layout) || !(LAYOUTS as readonly string[]).includes(s.layout)) {
      errors.push(`${where} has a layout we don't know. Use one of: ${LAYOUTS.join(', ')}.`);
      return;
    }
    const layout = s.layout as Layout;
    const slide: Slide = { layout, title: '' };

    if (!isText(s.title) || !s.title.trim()) errors.push(`${where} (${layout}) needs a title.`);
    else if (s.title.length > 120) errors.push(`${where} has a title over 120 characters. Please shorten it.`);
    else slide.title = s.title.trim();

    if (s.subtitle !== undefined) {
      if (!isText(s.subtitle)) errors.push(`${where}: "subtitle" should be text.`);
      else if (layout === 'title') slide.subtitle = s.subtitle.trim();
    }

    const needsBody = layout === 'idea' || layout === 'tryit' || layout === 'keepit';
    if (s.body !== undefined && !textList(s.body)) errors.push(`${where}: "body" should be a list of text lines, like ["Tap the green phone."].`);
    else if (textList(s.body)) {
      if (s.body.some((line) => line.length > 200)) errors.push(`${where} has a body line over 200 characters. Please shorten it.`);
      slide.body = s.body.map((line) => line.trim()).filter(Boolean);
    }
    if (needsBody && !(slide.body && slide.body.length)) errors.push(`${where} (${layout}) needs at least one line in "body".`);
    if (countWords(slide.body) > BODY_WORD_LIMIT) {
      warnings.push(`${where} has ${countWords(slide.body)} words in its body. Try to keep each slide under ${BODY_WORD_LIMIT} words.`);
    }

    if (layout === 'recap') {
      if (!textList(s.bullets) || s.bullets.length === 0) errors.push(`${where} (recap) needs a list called "bullets" with one to four lines.`);
      else if (s.bullets.length > 4) errors.push(`${where} (recap) has ${s.bullets.length} bullets. The most we allow is four.`);
      else slide.bullets = s.bullets.map((line) => line.trim()).filter(Boolean);
    }

    if (layout === 'step') {
      if (typeof s.step !== 'number' || !Number.isInteger(s.step) || s.step < 1 || s.step > 99) errors.push(`${where} (step) needs "step" to be a whole number like 1.`);
      else slide.step = s.step;
    }

    if (s.timer_minutes !== undefined) {
      if (layout !== 'tryit') warnings.push(`${where}: a timer only shows on "tryit" slides, so it will be ignored.`);
      else if (typeof s.timer_minutes !== 'number' || !Number.isInteger(s.timer_minutes) || s.timer_minutes < 1 || s.timer_minutes > 60) {
        errors.push(`${where}: "timer_minutes" should be a whole number from 1 to 60.`);
      } else slide.timer_minutes = s.timer_minutes;
    }

    if (s.image !== undefined) {
      const image = s.image as Record<string, unknown> | null;
      if (typeof image !== 'object' || image === null || !isText(image.file)) {
        errors.push(`${where}: "image" should look like {"file": "phone.png", "alt": "A phone home screen"}.`);
      } else if (!IMAGE_FILE.test(image.file)) {
        errors.push(`${where}: the image name "${image.file}" isn't allowed. Use letters, numbers, dots, and dashes, ending in .png, .jpg, .webp, or .svg.`);
      } else if (layout !== 'idea' && layout !== 'step') {
        warnings.push(`${where}: images only show on "idea" and "step" slides, so this one will be ignored.`);
      } else {
        const alt = isText(image.alt) ? image.alt.trim() : '';
        if (!alt) warnings.push(`${where}: the image "${image.file}" has no alt text. Describe it in a few words for people who can't see it.`);
        slide.image = { file: image.file, alt };
      }
    }

    if (s.notes !== undefined) {
      if (!isText(s.notes)) errors.push(`${where}: "notes" should be text.`);
      else if (s.notes.length > 2000) errors.push(`${where} has notes over 2,000 characters. Please shorten them.`);
      else if (s.notes.trim()) slide.notes = s.notes.trim();
    }

    slides.push(slide);
  });

  if (errors.length) return fail();
  return { deck: { version: 1, slides }, errors, warnings };
}
