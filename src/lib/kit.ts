// The kit format (docs/KIT-FORMAT.md): one kit.json plus the PDFs and images it names.
// validateKit() is a pure function: it gets the parsed JSON and a list of the files that were dropped.
import { validateDeck, imageFilesIn, type SlideDeck } from './slides';

export type FileKind = 'pdf' | 'png' | 'jpg' | 'webp' | 'svg' | 'json' | 'unknown';

export interface KitFileInfo {
  name: string;
  size: number;
  kind: FileKind;
  /** A plain-words problem found while looking inside the file, if any. */
  problem?: string;
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PDF_WARN_BYTES = 5 * 1024 * 1024;
export const DEVICES = ['iphone', 'android', 'any'] as const;
export const LEVELS = ['beginner', 'intermediate'] as const;
export const FILE_SLOTS = ['worksheet', 'handout', 'answer_key', 'teacher_guide_pdf'] as const;
export type FileSlot = (typeof FILE_SLOTS)[number];

export const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const EXTENSION_KIND: Record<string, FileKind> = { pdf: 'pdf', png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', svg: 'svg', json: 'json' };

/** Looks at a file's name and its first bytes. A renamed file does not fool it. */
export function classifyFile(name: string, size: number, head: Uint8Array, svgText = ''): KitFileInfo {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const kind = EXTENSION_KIND[extension] ?? 'unknown';
  const info: KitFileInfo = { name, size, kind };
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));

  if (kind === 'unknown') info.problem = `"${name}" is not a type we accept. Use PDF, PNG, JPG, WebP, or SVG.`;
  else if (!FILE_NAME.test(name)) info.problem = `The file name "${name}" isn't allowed. Use letters, numbers, dots, and dashes only, with no spaces.`;
  else if (size > MAX_FILE_BYTES) info.problem = `"${name}" is over 10 MB. Please make it smaller.`;
  else if (kind === 'pdf' && ascii(0, 5) !== '%PDF-') info.problem = `"${name}" says it is a PDF, but it isn't a real PDF.`;
  else if (kind === 'png' && !(head[0] === 0x89 && ascii(1, 4) === 'PNG')) info.problem = `"${name}" says it is a PNG, but it isn't a real PNG.`;
  else if (kind === 'jpg' && !(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) info.problem = `"${name}" says it is a JPG, but it isn't a real JPG.`;
  else if (kind === 'webp' && !(ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')) info.problem = `"${name}" says it is a WebP, but it isn't a real WebP.`;
  else if (kind === 'svg') {
    if (!/<svg[\s>]/i.test(svgText)) info.problem = `"${name}" says it is an SVG, but it isn't a real SVG.`;
    else if (/<script|\son\w+\s*=|javascript:|<foreignObject|<iframe/i.test(svgText)) info.problem = `"${name}" contains code that is not allowed in a picture. Export it again as a plain SVG.`;
  }
  return info;
}

/** Reads a dropped file in the browser and classifies it. */
export async function inspectFile(file: File): Promise<KitFileInfo> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const extension = file.name.split('.').pop()?.toLowerCase();
  const svgText = extension === 'svg' && file.size <= MAX_FILE_BYTES ? await file.slice(0, 1_000_000).text() : '';
  return classifyFile(file.name, file.size, head, svgText);
}

export interface NormalizedLesson {
  slug: string;
  week_number: number;
  title: string;
  summary: string;
  topic: string;
  devices: string[];
  level: string;
  duration_minutes: number;
  objectives: string[];
  license: string;
  slides: SlideDeck;
  teacher_guide_md: string;
  video_script_md: string;
  files: Partial<Record<FileSlot, string>>;
  images: string[];
}

export interface KitResult {
  errors: string[];
  warnings: string[];
  lesson: NormalizedLesson | null;
  summary: string;
}

const text = (value: unknown): value is string => typeof value === 'string';
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function validateKit(kit: unknown, droppedFiles: KitFileInfo[]): KitResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const done = (lesson: NormalizedLesson | null, summary = ''): KitResult => ({ errors, warnings, lesson: errors.length ? null : lesson, summary: errors.length ? '' : summary });

  if (typeof kit !== 'object' || kit === null || Array.isArray(kit)) {
    errors.push('kit.json should be an object that starts with {"kit_version": 1, "lesson": { ... }}.');
    return done(null);
  }
  const k = kit as Record<string, unknown>;
  if (k.kit_version !== 1) errors.push('kit.json needs "kit_version": 1 at the top.');

  const lessonData = (typeof k.lesson === 'object' && k.lesson !== null && !Array.isArray(k.lesson) ? k.lesson : null) as Record<string, unknown> | null;
  if (!lessonData) {
    errors.push('kit.json needs a "lesson" section with the title, week, and other details.');
    return done(null);
  }

  // Lesson details
  const slug = lessonData.slug;
  if (!text(slug) || !SLUG.test(slug) || slug.length > 80) errors.push('The lesson "slug" should be lowercase letters, numbers, and single dashes, like "week-01-calling-a-friend".');
  const week = lessonData.week_number;
  if (typeof week !== 'number' || !Number.isInteger(week) || week < 1 || week > 200) errors.push('The lesson "week_number" should be a whole number from 1 to 200.');
  const title = lessonData.title;
  if (!text(title) || !title.trim() || title.length > 120) errors.push('The lesson "title" should be between 1 and 120 characters.');
  const summary = lessonData.summary ?? '';
  if (!text(summary) || summary.length > 400) errors.push('The lesson "summary" should be text of 400 characters or fewer.');
  const topic = lessonData.topic ?? '';
  if (!text(topic) || topic.length > 80) errors.push('The lesson "topic" should be short text.');
  const devices = lessonData.devices ?? ['any'];
  if (!Array.isArray(devices) || devices.length === 0 || !devices.every((d) => (DEVICES as readonly string[]).includes(d as string))) {
    errors.push(`The lesson "devices" should be a list using only: ${DEVICES.join(', ')}.`);
  }
  const level = lessonData.level ?? 'beginner';
  if (!(LEVELS as readonly string[]).includes(level as string)) errors.push(`The lesson "level" should be one of: ${LEVELS.join(', ')}.`);
  const duration = lessonData.duration_minutes ?? 45;
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 5 || duration > 240) errors.push('The lesson "duration_minutes" should be a whole number from 5 to 240.');
  const objectives = lessonData.objectives ?? [];
  if (!Array.isArray(objectives) || !objectives.every((o) => text(o) && o.length <= 200) || objectives.length > 10) errors.push('The lesson "objectives" should be a list of up to ten short lines.');
  const license = lessonData.license ?? 'CC BY-SA 4.0';
  if (!text(license) || !license.trim() || license.length > 60) errors.push('The lesson "license" should be short text, like "CC BY-SA 4.0".');

  // Slides
  const slideResult = validateDeck(k.slides);
  errors.push(...slideResult.errors);
  warnings.push(...slideResult.warnings);

  // Text
  const guide = k.teacher_guide_md ?? '';
  if (!text(guide) || guide.length > 100_000) errors.push('"teacher_guide_md" should be text (under 100,000 characters).');
  const script = k.video_script_md ?? '';
  if (!text(script) || script.length > 50_000) errors.push('"video_script_md" should be text (under 50,000 characters).');

  // Files
  const byName = new Map(droppedFiles.map((file) => [file.name, file]));
  for (const file of droppedFiles) if (file.problem) errors.push(file.problem);

  const fileSlots: Partial<Record<FileSlot, string>> = {};
  const filesSection = (typeof k.files === 'object' && k.files !== null ? k.files : {}) as Record<string, unknown>;
  for (const slot of FILE_SLOTS) {
    const name = filesSection[slot];
    if (name === null || name === undefined || name === '') continue;
    if (!text(name)) {
      errors.push(`"files.${slot}" should be a file name or null.`);
      continue;
    }
    const found = byName.get(name);
    if (!found) errors.push(`The kit names "${name}" as the ${slot.replace(/_/g, ' ')}, but that file wasn't selected. Drop it in along with kit.json.`);
    else if (found.kind !== 'pdf' && !found.problem) errors.push(`"${name}" is named as the ${slot.replace(/_/g, ' ')}, so it should be a PDF.`);
    else {
      fileSlots[slot] = name;
      if (found.size > PDF_WARN_BYTES) warnings.push(`"${name}" is over 5 MB. Smaller files download faster on slow Wi-Fi.`);
    }
  }
  if (!fileSlots.handout) warnings.push('There is no handout. Every lesson should send learners home with one.');
  if (!fileSlots.worksheet) warnings.push('There is no worksheet. Every lesson should have a one-page worksheet.');

  const listedImages = k.images ?? [];
  const images: string[] = [];
  if (!Array.isArray(listedImages) || !listedImages.every(text)) errors.push('"images" should be a list of file names.');
  else {
    for (const name of listedImages) {
      const found = byName.get(name);
      if (!found) errors.push(`The kit lists the image "${name}", but that file wasn't selected. Drop it in along with kit.json.`);
      else if (found.kind === 'pdf' || found.kind === 'json' || found.kind === 'unknown') errors.push(`"${name}" is listed as an image, but it isn't one.`);
      else images.push(name);
    }
  }

  if (slideResult.deck) {
    for (const used of imageFilesIn(slideResult.deck)) {
      if (!images.includes(used)) errors.push(`A slide uses the image "${used}", but it isn't in the kit's "images" list.`);
    }
    for (const listed of images) {
      if (!imageFilesIn(slideResult.deck).includes(listed)) warnings.push(`The image "${listed}" is in the kit, but no slide uses it.`);
    }
  }

  const lesson: NormalizedLesson | null = errors.length
    ? null
    : {
        slug: slug as string,
        week_number: week as number,
        title: (title as string).trim(),
        summary: (summary as string).trim(),
        topic: (topic as string).trim(),
        devices: [...new Set(devices as string[])],
        level: level as string,
        duration_minutes: duration as number,
        objectives: (objectives as string[]).map((o) => o.trim()).filter(Boolean),
        license: (license as string).trim(),
        slides: slideResult.deck!,
        teacher_guide_md: guide as string,
        video_script_md: script as string,
        files: fileSlots,
        images,
      };

  const worksheets = fileSlots.worksheet ? 1 : 0;
  const handouts = fileSlots.handout ? 1 : 0;
  const warningText = warnings.length ? plural(warnings.length, 'warning') : 'No warnings';
  const slideCount = slideResult.deck?.slides.length ?? 0;
  return done(lesson, `Week ${week}: ${(title as string)?.trim?.()}. ${plural(slideCount, 'slide')}, ${plural(worksheets, 'worksheet')}, ${plural(handouts, 'handout')}. ${warningText}.`);
}
