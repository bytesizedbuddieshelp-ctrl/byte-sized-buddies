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

export const MAX_EXTRAS = 10;
export const MAX_EXTRA_TITLE = 80;

export const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const EXTENSION_KIND: Record<string, FileKind> = { pdf: 'pdf', png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', svg: 'svg', json: 'json' };

// An SVG is a picture, but it can also carry code or pull in things from other websites. We only accept plain
// drawings. Two checks run: a text check that works anywhere, and (in the browser) a real parse of the file.
const SVG_TEXT_RULES: [RegExp, string][] = [
  [/<!ENTITY|<!DOCTYPE|<\?xml-stylesheet/i, 'a document type or entity'],
  [/<\s*(script|foreignObject|iframe|object|embed|audio|video|link|meta)\b/i, 'code or embedded content'],
  [/[\s/"'`]on[a-z]+\s*=/i, 'an event handler'],
  [/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i, 'a script link'],
  [/&#x?0*[0-9a-f]+;?\s*[a-z]*\s*script/i, 'a disguised script link'],
  [/href\s*=\s*(?!["']?\s*#)/i, 'a link to somewhere else'],
  [/@import|url\(\s*(?!["']?\s*#)/i, 'a link to somewhere else'],
];

/** Returns null for a plain SVG, "not-svg" for something that is not an SVG, or a plain-words reason. */
export function svgProblem(text: string): string | null {
  if (!/<svg[\s>/]/i.test(text)) return 'not-svg';
  for (const [rule, reason] of SVG_TEXT_RULES) if (rule.test(text)) return reason;
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName.toLowerCase() !== 'svg') return 'not-svg';
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (/^(script|foreignobject|iframe|object|embed|audio|video|link|meta)$/i.test(el.localName)) return 'code or embedded content';
    for (const attr of Array.from(el.attributes)) {
      const value = attr.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
      if (/^on/i.test(attr.localName)) return 'an event handler';
      if (/javascript:|vbscript:|data:text/.test(value)) return 'a script link';
      if (/(^|:)href$/i.test(attr.name) && !value.startsWith('#')) return 'a link to somewhere else';
    }
  }
  return null;
}

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
    const problem = svgProblem(svgText);
    if (problem === 'not-svg') info.problem = `"${name}" says it is an SVG, but it isn't a real SVG.`;
    else if (problem) info.problem = `"${name}" contains ${problem}, which is not allowed in a picture. Export it again as a plain SVG.`;
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
  /** Extra worksheets for when there is time left over: the PDF's file name and a short title. */
  extras: { file: string; title: string }[];
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

  // Extra worksheets (optional): [{ "file": "week-01-extra-1.pdf", "title": "Extra practice: ..." }]
  const listedExtras = k.extras ?? [];
  const extras: { file: string; title: string }[] = [];
  if (!Array.isArray(listedExtras) || listedExtras.length > MAX_EXTRAS) {
    errors.push(`"extras" should be a list of up to ${MAX_EXTRAS} extra worksheets, each with a "file" and a "title".`);
  } else {
    const slotNames = Object.values(fileSlots);
    listedExtras.forEach((entry, i) => {
      const e = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
      const where = `Extra worksheet ${i + 1}`;
      if (!text(e.file) || !text(e.title) || !e.title.trim() || e.title.length > MAX_EXTRA_TITLE) {
        errors.push(`${where} needs a "file" (a PDF name) and a "title" of ${MAX_EXTRA_TITLE} characters or fewer.`);
        return;
      }
      const found = byName.get(e.file);
      if (!found) errors.push(`The kit lists the extra worksheet "${e.file}", but that file wasn't selected. Drop it in along with kit.json.`);
      else if (found.kind !== 'pdf' && !found.problem) errors.push(`"${e.file}" is listed as an extra worksheet, so it should be a PDF.`);
      else if (slotNames.includes(e.file) || extras.some((x) => x.file === e.file)) errors.push(`"${e.file}" is used twice in the kit. Each extra worksheet needs its own file.`);
      else {
        extras.push({ file: e.file, title: e.title.trim() });
        if (found.size > PDF_WARN_BYTES) warnings.push(`"${e.file}" is over 5 MB. Smaller files download faster on slow Wi-Fi.`);
      }
    });
  }

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
    // Compare with what the kit says, not with what was found, so one missing file is reported once.
    const named = Array.isArray(listedImages) ? (listedImages as unknown[]) : [];
    for (const used of imageFilesIn(slideResult.deck)) {
      if (!named.includes(used)) errors.push(`A slide uses the image "${used}", but it isn't in the kit's "images" list.`);
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
        extras,
      };

  const worksheets = fileSlots.worksheet ? 1 : 0;
  const handouts = fileSlots.handout ? 1 : 0;
  const warningText = warnings.length ? plural(warnings.length, 'warning') : 'No warnings';
  const slideCount = slideResult.deck?.slides.length ?? 0;
  const extraText = extras.length ? `, ${plural(extras.length, 'extra worksheet')}` : '';
  return done(lesson, `Week ${week}: ${(title as string)?.trim?.()}. ${plural(slideCount, 'slide')}, ${plural(worksheets, 'worksheet')}, ${plural(handouts, 'handout')}${extraText}. ${warningText}.`);
}
