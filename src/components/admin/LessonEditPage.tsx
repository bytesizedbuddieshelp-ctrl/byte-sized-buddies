import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { Notices } from './Notices';
import { ErrorSummary, type FormProblem } from '../forms/ErrorSummary';
import { Icon } from '../forms/Icon';
import { SlideCanvas, SlideFrame } from '../slides/SlideCanvas';
import { adminCopy as a, formatWhen } from '../../content/adminCopy';
import { renderMarkdown } from '../../lib/markdown';
import { parseYouTubeId } from '../../lib/youtube';
import { imageFilesIn, MAX_SLIDE_IMAGES, parseDeckText, renameDeckImages, slideImages, type Layout, type Slide, type SlideImage } from '../../lib/slides';
import { matchPictures, safeFileName } from '../../lib/pictureNames';
import { FILE_NAME, FILE_SLOTS, inspectFile, SLUG, type FileSlot } from '../../lib/kit';
import { extrasFor, fileUrl, formatBytes, imageUrlFor, lessonFolder, slugify, type ExtraFile, type Lesson, type LessonFiles, type StoredFile } from '../../lib/lessons';
import { filesRecord, removeStoragePaths, uploadLessonFile } from '../../lib/lessonAdmin';

const t = a.lessonEdit;

export default function LessonEditPage() {
  const isNew = !new URLSearchParams(window.location.search).get('slug');
  return (
    <AdminShell current="lessons" title={isNew ? t.titleNew : t.titleEdit}>
      {(supabase) => <Editor supabase={supabase} />}
    </AdminShell>
  );
}

interface Form {
  title: string;
  slug: string;
  week: string;
  summary: string;
  topic: string;
  devices: string[];
  level: string;
  duration: string;
  license: string;
  objectives: string[];
  guide: string;
  script: string;
  deckText: string;
  videos: { link: string; label: string }[];
}

const blankForm = (): Form => ({
  title: '',
  slug: '',
  week: '',
  summary: '',
  topic: '',
  devices: ['any'],
  level: 'beginner',
  duration: '45',
  license: 'CC BY-SA 4.0',
  objectives: [''],
  guide: '',
  script: '',
  deckText: JSON.stringify({ version: 1, slides: [] }, null, 2),
  videos: [],
});

const fromLesson = (lesson: Lesson): Form => ({
  title: lesson.title,
  slug: lesson.slug,
  week: lesson.week_number === null ? '' : String(lesson.week_number),
  summary: lesson.summary ?? '',
  topic: lesson.topic ?? '',
  devices: lesson.devices,
  level: lesson.level,
  duration: String(lesson.duration_minutes),
  license: lesson.license,
  objectives: lesson.objectives.length ? lesson.objectives : [''],
  guide: lesson.teacher_guide_md ?? '',
  script: lesson.video_script_md ?? '',
  deckText: JSON.stringify(lesson.slides ?? { version: 1, slides: [] }, null, 2),
  videos: (lesson.video_ids ?? []).map((v) => ({ link: v.youtube_id, label: v.label })),
});

const templates: Record<Layout, (n: number) => Slide> = {
  title: () => ({ layout: 'title', title: 'Lesson title', subtitle: 'Week 1' }),
  idea: () => ({ layout: 'idea', title: 'One idea', body: ['Say it in a short line.'] }),
  step: (n) => ({ layout: 'step', step: n, title: 'Do this', body: ['A short instruction.'] }),
  tryit: () => ({ layout: 'tryit', title: 'Try it now', body: ['What learners will do.'], timer_minutes: 5 }),
  recap: () => ({ layout: 'recap', title: 'Today you learned', bullets: ['The first thing.'] }),
  keepit: () => ({ layout: 'keepit', title: 'Keep it', body: ['Take your handout home.'] }),
};

function Text({
  id,
  label,
  value,
  onInput,
  helper,
  required,
  type = 'text',
  as = 'input',
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onInput: (value: string) => void;
  helper?: string;
  required?: boolean;
  type?: string;
  as?: 'input' | 'textarea';
  rows?: number;
}) {
  const helpId = helper ? `${id}-help` : undefined;
  return (
    <div class="field">
      <label class="field-label" for={id}>
        {label}
        {required && <span class="field-required"> (required)</span>}
      </label>
      {helper && (
        <p class="field-helper" id={helpId}>
          {helper}
        </p>
      )}
      {as === 'textarea' ? (
        <textarea id={id} class="field-control" rows={rows} value={value} aria-describedby={helpId} onInput={(e) => onInput(e.currentTarget.value)} />
      ) : (
        <input id={id} class="field-control" type={type} value={value} aria-describedby={helpId} onInput={(e) => onInput(e.currentTarget.value)} />
      )}
    </div>
  );
}

function MoveButtons({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void; label: string }) {
  return (
    <div class="row-buttons">
      <button type="button" class="button button-secondary" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`${t.moveUp}: ${label}`}>
        {t.moveUp}
      </button>
      <button type="button" class="button button-secondary" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`${t.moveDown}: ${label}`}>
        {t.moveDown}
      </button>
      <button type="button" class="button button-secondary" onClick={onRemove} aria-label={`${t.remove}: ${label}`}>
        {t.remove}
      </button>
    </div>
  );
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** Sets a slide's photos: one as "image", several as "images", none removes both. */
function withPhotos(slide: Slide, photos: SlideImage[]): Slide {
  const { image: _one, images: _many, ...rest } = slide;
  if (photos.length === 1) return { ...rest, image: photos[0] };
  if (photos.length > 1) return { ...rest, images: photos };
  return rest;
}

// "Photos on this slide": choose up to four of the lesson's pictures for the chosen slide, with alt text.
function PhotosPanel({ slide, pictures, onChange, onUpload }: { slide: Slide; pictures: string[]; onChange: (photos: SlideImage[]) => void; onUpload: (files: File[]) => void }) {
  const photos = slideImages(slide);
  if (slide.layout !== 'idea' && slide.layout !== 'step') return <p class="caption">{t.photosOnly}</p>;
  const set = (i: number, change: Partial<SlideImage>) => onChange(photos.map((p, j) => (j === i ? { ...p, ...change } : p)));
  const unused = pictures.find((name) => !photos.some((p) => p.file === name)) ?? pictures[0];
  return (
    <div class="photos-panel">
      <h3>{t.photosHeading}</h3>
      <p class="field-helper">{t.photosHelp}</p>
      {photos.length === 0 && <p>{t.photosNone}</p>}
      {photos.map((photo, i) => (
        <div class="editor-row" key={`${i}-${photo.file}`}>
          <p class="label">{t.photo(i + 1)}</p>
          <div class="field">
            <label class="field-label" for={`photo-file-${i}`}>{t.photoFile(i + 1)}</label>
            <select id={`photo-file-${i}`} class="field-control" value={photo.file} onChange={(e) => set(i, { file: e.currentTarget.value })}>
              {[...new Set([photo.file, ...pictures])].map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for={`photo-alt-${i}`}>{t.photoAlt(i + 1)}</label>
            <p class="field-helper" id={`photo-alt-help-${i}`}>{t.photoAltHelp}</p>
            <input id={`photo-alt-${i}`} class="field-control" value={photo.alt} aria-describedby={`photo-alt-help-${i}`} onInput={(e) => set(i, { alt: e.currentTarget.value })} />
          </div>
          <MoveButtons
            index={i}
            count={photos.length}
            label={t.photo(i + 1)}
            onMove={(to) => onChange(moveItem(photos, i, to))}
            onRemove={() => onChange(photos.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {photos.length >= MAX_SLIDE_IMAGES ? (
        <p class="caption">{t.photosMax}</p>
      ) : (
        <>
          {pictures.length > 0 && (
            <button type="button" class="button button-secondary" onClick={() => onChange([...photos, { file: unused, alt: '' }])}>
              {t.addPhoto}
            </button>
          )}
          <div class="field" style="margin-top: 16px;">
            <label class="field-label" for="photo-upload">{t.addFromComputer}</label>
            <p class="field-helper" id="photo-upload-help">{t.addFromComputerHelp}</p>
            <input
              id="photo-upload"
              class="field-control"
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.svg"
              aria-describedby="photo-upload-help"
              onChange={(e) => {
                const files = Array.from(e.currentTarget.files ?? []);
                e.currentTarget.value = '';
                if (files.length) onUpload(files);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

interface ExtraRow {
  id: number;
  title: string;
  /** The file already saved for this row, if any. */
  old: ExtraFile | null;
  /** A new PDF chosen for this row, if any. */
  file: File | null;
  problem: string;
}

let extraRowId = 0;
const extraRowsFrom = (files: LessonFiles): ExtraRow[] => extrasFor(files).map((old) => ({ id: ++extraRowId, title: old.title, old, file: null, problem: '' }));

function Editor({ supabase }: { supabase: SupabaseClient }) {
  const slugParam = new URLSearchParams(window.location.search).get('slug');
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>(slugParam ? 'loading' : 'ready');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [form, setForm] = useState<Form>(blankForm());
  const [slugTouched, setSlugTouched] = useState(Boolean(slugParam));
  const [slotFiles, setSlotFiles] = useState<Partial<Record<FileSlot, File>>>({});
  const [slotRemove, setSlotRemove] = useState<Partial<Record<FileSlot, boolean>>>({});
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imageRemove, setImageRemove] = useState<string[]>([]);
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([]);
  const [fileProblems, setFileProblems] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<FormProblem[]>([]);
  const [focusSignal, setFocusSignal] = useState(0);
  const [ok, setOk] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');
  const [chosen, setChosen] = useState(0);
  const [addLayout, setAddLayout] = useState<Layout>('idea');

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!slugParam) return;
    supabase
      .from('lessons')
      .select('*')
      .eq('slug', slugParam)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setState('missing');
        setLesson(data as Lesson);
        setForm(fromLesson(data as Lesson));
        setExtraRows(extraRowsFrom((data as Lesson).files ?? {}));
        setState('ready');
      });
  }, []);

  const deck = useMemo(() => parseDeckText(form.deckText), [form.deckText]);
  const guideHtml = useMemo(() => renderMarkdown(form.guide, { allowImages: true, demoteHeadings: true }), [form.guide]);
  const scriptHtml = useMemo(() => renderMarkdown(form.script), [form.script]);
  const previewUrls = useMemo(() => Object.fromEntries(newImages.map((file) => [file.name, URL.createObjectURL(file)])), [newImages]);

  if (state === 'loading') return <p role="status">{t.loading}</p>;
  if (state === 'missing') {
    return (
      <div>
        <p class="admin-message is-error" role="alert">{t.notFound}</p>
        <a class="button button-secondary" href="/admin/lessons">{t.back}</a>
      </div>
    );
  }

  const slides = deck.deck?.slides ?? [];
  const current = slides[Math.min(chosen, slides.length - 1)];
  const draftLesson = { slug: form.slug || 'new', files: lesson?.files ?? {} };
  const imageUrl = (file: string) => previewUrls[file] ?? imageUrlFor(draftLesson, file);
  // Every picture this lesson will have after saving: the uploaded ones still kept, plus the new ones.
  const pictureNames = [...new Set([...(lesson?.files.images ?? []).filter((i) => !imageRemove.includes(i.name)).map((i) => i.name), ...newImages.map((f) => f.name)])];
  const slidePictures = slides.flatMap((slide, i) => slideImages(slide).map((image) => ({ n: i + 1, file: image.file, ok: pictureNames.includes(image.file) })));
  const unusedPictures = pictureNames.filter((name) => !slidePictures.some((p) => p.file === name));

  function changeSlides(change: (list: Slide[]) => Slide[]) {
    if (!deck.deck) return;
    const next = change([...deck.deck.slides]);
    set('deckText', JSON.stringify({ version: 1, slides: next }, null, 2));
  }

  async function chooseSlot(slot: FileSlot, file: File | undefined) {
    const copy = { ...slotFiles };
    const issues = { ...fileProblems };
    delete issues[`slot:${slot}`];
    if (!file) delete copy[slot];
    else {
      const info = await inspectFile(file);
      if (info.problem) issues[`slot:${slot}`] = info.problem;
      else if (info.kind !== 'pdf') issues[`slot:${slot}`] = `"${file.name}" should be a PDF.`;
      else copy[slot] = file;
    }
    setSlotFiles(copy);
    setFileProblems(issues);
  }

  // Adds pictures to the lesson (more each time, never replacing), cleans names the website would refuse,
  // then points any slide still waiting for a picture at the one whose name matches.
  async function addPictures(list: File[], matchSlides = true): Promise<string[]> {
    const issues = { ...fileProblems };
    for (const key of Object.keys(issues)) if (key.startsWith('image:')) delete issues[key];
    const accepted: File[] = [];
    for (const raw of list) {
      const file = FILE_NAME.test(raw.name) ? raw : new File([raw], safeFileName(raw.name), { type: raw.type, lastModified: raw.lastModified });
      const info = await inspectFile(file);
      if (info.problem) issues[`image:${file.name}`] = info.problem;
      else if (info.kind === 'pdf' || info.kind === 'json' || info.kind === 'unknown') issues[`image:${file.name}`] = `"${file.name}" should be a picture.`;
      else accepted.push(file);
    }
    const added = accepted.map((f) => f.name);
    setNewImages((old) => [...old.filter((f) => !added.includes(f.name)), ...accepted]);
    setImageRemove((old) => old.filter((name) => !added.includes(name)));
    setFileProblems(issues);

    if (matchSlides && deck.deck && added.length) {
      const all = [...new Set([...pictureNames, ...added])];
      const waiting = imageFilesIn(deck.deck).filter((name) => !all.includes(name));
      const { found } = matchPictures(waiting, all);
      if (Object.keys(found).length) set('deckText', JSON.stringify(renameDeckImages(deck.deck, found), null, 2));
    }
    return added;
  }

  function chooseImages(list: FileList | null) {
    const files = Array.from(list ?? []);
    // Clear the picker, so choosing the same picture again still counts.
    const picker = document.getElementById('images') as HTMLInputElement | null;
    if (picker) picker.value = '';
    void addPictures(files);
  }

  async function chooseExtra(id: number, file: File | undefined) {
    let problem = '';
    if (file) {
      const info = await inspectFile(file);
      if (info.problem) problem = info.problem;
      else if (info.kind !== 'pdf') problem = `"${file.name}" should be a PDF.`;
    }
    setExtraRows((rows) => rows.map((r) => (r.id === id ? { ...r, file: file && !problem ? file : null, problem } : r)));
  }

  const changeExtra = (id: number, changes: Partial<ExtraRow>) => setExtraRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  function validate(): FormProblem[] {
    const found: FormProblem[] = [];
    if (!form.title.trim() || form.title.length > 120) found.push({ id: 'title', label: t.fields.title, message: t.errors.title });
    if (!SLUG.test(form.slug) || form.slug.length > 80) found.push({ id: 'slug', label: t.fields.slug, message: t.errors.slug });
    const week = Number(form.week);
    if (form.week.trim() !== '' && (!Number.isInteger(week) || week < 1 || week > 200)) found.push({ id: 'week', label: t.fields.week, message: t.errors.week });
    const minutes = Number(form.duration);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) found.push({ id: 'duration', label: t.fields.duration, message: t.errors.duration });
    if (form.devices.length === 0) found.push({ id: 'devices', label: t.fields.devices, message: t.errors.devices });
    for (const message of deck.errors) found.push({ id: 'slides-json', label: t.slidesHeading, message });
    form.videos.forEach((video, i) => {
      if (video.link.trim() && !parseYouTubeId(video.link)) found.push({ id: `video-link-${i}`, label: t.videoLink(i + 1), message: t.videoBad });
    });
    for (const [key, message] of Object.entries(fileProblems)) found.push({ id: key.startsWith('slot:') ? `slot-${key.slice(5)}` : 'images', label: t.filesHeading, message });

    // Extra worksheets: a title and a PDF each, and no file name that another file in this lesson already uses.
    const otherNames = [
      ...FILE_SLOTS.flatMap((slot) => [slotFiles[slot]?.name, slotRemove[slot] ? undefined : lesson?.files[slot]?.path.split('/').pop()]),
      ...(lesson?.files.images ?? []).map((i) => i.name),
      ...newImages.map((f) => f.name),
    ].filter(Boolean) as string[];
    const extraNames: string[] = [];
    extraRows.forEach((row, i) => {
      const n = i + 1;
      if (!row.title.trim() || row.title.trim().length > 80) found.push({ id: `extra-title-${row.id}`, label: t.extraTitle(n), message: t.errors.extraTitle });
      if (row.problem) found.push({ id: `extra-file-${row.id}`, label: t.extraFile(n), message: row.problem });
      else if (!row.file && !row.old) found.push({ id: `extra-file-${row.id}`, label: t.extraFile(n), message: t.errors.extraFile });
      const name = row.file?.name ?? row.old?.name;
      if (name && (otherNames.includes(name) || extraNames.includes(name))) found.push({ id: `extra-file-${row.id}`, label: t.extraFile(n), message: t.errors.extraDuplicate(name) });
      if (name) extraNames.push(name);
    });
    return found;
  }

  async function save() {
    setOk('');
    setProblem('');
    const found = validate();
    setProblems(found);
    if (found.length) {
      setFocusSignal((n) => n + 1);
      return;
    }
    setBusy(t.saving);
    const oldFiles: LessonFiles = lesson?.files ?? {};
    const doomed: string[] = [];
    try {
      // Work out the files this lesson will have after saving
      const slots: Partial<Record<FileSlot, StoredFile>> = {};
      const uploads: { slot?: FileSlot; file: File }[] = [];
      for (const slot of FILE_SLOTS) {
        const old = oldFiles[slot];
        if (slotFiles[slot]) uploads.push({ slot, file: slotFiles[slot]! });
        if (old && !slotRemove[slot] && !slotFiles[slot]) slots[slot] = old;
        if (old && (slotRemove[slot] || slotFiles[slot])) doomed.push(old.path);
      }
      const images = (oldFiles.images ?? []).filter((image) => !imageRemove.includes(image.name) && !newImages.some((n) => n.name === image.name));
      for (const image of oldFiles.images ?? []) if (imageRemove.includes(image.name)) doomed.push(image.path);
      for (const file of newImages) uploads.push({ file });

      // Extra worksheets: keep, replace, or remove, in the order shown.
      const keptExtras = new Set(extraRows.filter((r) => r.old && !r.file).map((r) => r.old!.path));
      for (const old of extrasFor(oldFiles)) if (!keptExtras.has(old.path)) doomed.push(old.path);
      const total = uploads.length + extraRows.filter((r) => r.file).length;

      const uploadedImages: { name: string; path: string; bytes: number }[] = [];
      for (const [i, item] of uploads.entries()) {
        setBusy(t.uploading(i + 1, total));
        const stored = await uploadLessonFile(supabase, form.slug, item.file);
        if (item.slot) slots[item.slot] = stored;
        else uploadedImages.push({ name: item.file.name, ...stored });
      }
      const extras: ExtraFile[] = [];
      let done = uploads.length;
      for (const row of extraRows) {
        if (row.file) {
          setBusy(t.uploading(++done, total));
          const stored = await uploadLessonFile(supabase, form.slug, row.file);
          extras.push({ name: row.file.name, title: row.title.trim(), ...stored });
        } else if (row.old) {
          extras.push({ ...row.old, title: row.title.trim() });
        }
      }
      const files = filesRecord(slots, [...images, ...uploadedImages], extras);
      const row = {
        slug: form.slug,
        week_number: form.week.trim() === '' ? null : Number(form.week),
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        topic: form.topic.trim() || null,
        devices: form.devices,
        level: form.level,
        duration_minutes: Number(form.duration),
        objectives: form.objectives.map((o) => o.trim()).filter(Boolean),
        slides: deck.deck,
        teacher_guide_md: form.guide.trim() || null,
        video_script_md: form.script.trim() || null,
        files,
        video_ids: form.videos.flatMap((v) => {
          const id = parseYouTubeId(v.link);
          return id ? [{ youtube_id: id, label: v.label.trim() }] : [];
        }),
        license: form.license.trim() || 'CC BY-SA 4.0',
      };
      const query = lesson ? supabase.from('lessons').update(row).eq('id', lesson.id) : supabase.from('lessons').insert(row);
      const { data, error } = await query.select('*').single();
      if (error) {
        if (error.code === '23505') {
          setProblems([{ id: 'slug', label: t.fields.slug, message: t.errors.slugTaken }]);
          setFocusSignal((n) => n + 1);
          setBusy('');
          return;
        }
        throw error;
      }
      const stillUsed = new Set([...(Object.values(files).flatMap((v) => (Array.isArray(v) ? v.map((i) => i.path) : [v.path])) as string[])]);
      await removeStoragePaths(supabase, doomed.filter((path) => !stillUsed.has(path))).catch(() => undefined);
      setLesson(data as Lesson);
      setSlotFiles({});
      setSlotRemove({});
      setNewImages([]);
      setImageRemove([]);
      setExtraRows(extraRowsFrom((data as Lesson).files ?? {}));
      setOk(lesson ? t.saved : t.savedDraft);
      if (!lesson) window.history.replaceState(null, '', `/admin/lesson-edit?slug=${encodeURIComponent(form.slug)}`);
    } catch {
      setProblem(a.lessons.saveError);
    } finally {
      setBusy('');
    }
  }

  const deviceBox = (value: string, label: string) => (
    <label class="choice" key={value}>
      <input
        type="checkbox"
        checked={form.devices.includes(value)}
        onChange={(e) => set('devices', e.currentTarget.checked ? [...form.devices, value] : form.devices.filter((d) => d !== value))}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <div>
      <a class="button button-secondary" href="/admin/lessons">
        <Icon name="arrow-left" size={24} /> {t.back}
      </a>
      {lesson && (
        <p class="caption" style="margin-top: 16px;">
          {a.lessons.updated} {formatWhen(lesson.updated_at)}. {lesson.status === 'published' ? a.lessons.published : a.lessons.draft}.
        </p>
      )}
      <Notices ok={ok} problem={problem} />
      {problems.length > 0 && <p class="visually-hidden">{t.fixFirst}</p>}
      <ErrorSummary problems={problems} focusSignal={focusSignal} />

      <section class="admin-box" aria-labelledby="about-title">
        <h2 id="about-title">{t.aboutHeading}</h2>
        <Text
          id="title"
          label={t.fields.title}
          required
          value={form.title}
          onInput={(value) => {
            setForm((f) => ({ ...f, title: value, slug: slugTouched ? f.slug : slugify(value) }));
          }}
        />
        <Text
          id="slug"
          label={t.fields.slug}
          required
          helper={`${t.fields.slugHelp}${lesson ? ` ${t.fields.slugChange}` : ''}`}
          value={form.slug}
          onInput={(value) => {
            setSlugTouched(true);
            // Spaces become dashes and odd characters drop out as you type, so the address is always valid.
            set('slug', value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
          }}
        />
        <Text id="week" label={t.fields.week} type="number" value={form.week} onInput={(v) => set('week', v)} />
        <Text id="summary" label={t.fields.summary} value={form.summary} onInput={(v) => set('summary', v)} />
        <Text id="topic" label={t.fields.topic} value={form.topic} onInput={(v) => set('topic', v)} />
        <fieldset class="choice-group" id="devices">
          <legend>{t.fields.devices}</legend>
          {t.deviceOptions.map((o) => deviceBox(o.value, o.label))}
        </fieldset>
        <fieldset class="choice-group">
          <legend>{t.fields.level}</legend>
          {t.levelOptions.map((o) => (
            <label class="choice" key={o.value}>
              <input type="radio" name="level" value={o.value} checked={form.level === o.value} onChange={() => set('level', o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
        <Text id="duration" label={t.fields.duration} type="number" value={form.duration} onInput={(v) => set('duration', v)} />
        <Text id="license" label={t.fields.license} value={form.license} onInput={(v) => set('license', v)} />
      </section>

      <section class="admin-box" aria-labelledby="objectives-title">
        <h2 id="objectives-title">{t.objectivesHeading}</h2>
        <p class="field-helper">{t.objectivesHelp}</p>
        {form.objectives.map((objective, i) => (
          <div class="editor-row" key={i}>
            <Text id={`objective-${i}`} label={t.objective(i + 1)} value={objective} onInput={(v) => set('objectives', form.objectives.map((o, j) => (j === i ? v : o)))} />
            <MoveButtons
              index={i}
              count={form.objectives.length}
              label={t.objective(i + 1)}
              onMove={(to) => set('objectives', moveItem(form.objectives, i, to))}
              onRemove={() => set('objectives', form.objectives.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <button type="button" class="button button-secondary" onClick={() => set('objectives', [...form.objectives, ''])}>
          {t.addObjective}
        </button>
      </section>

      <section class="admin-box" aria-labelledby="guide-title">
        <h2 id="guide-title">{t.guideHeading}</h2>
        <Text id="guide" as="textarea" rows={12} label={t.guideLabel} helper={t.guideHelp} value={form.guide} onInput={(v) => set('guide', v)} />
        <h3>{t.preview}</h3>
        <div class="preview">{form.guide.trim() ? <div class="prose" dangerouslySetInnerHTML={{ __html: guideHtml }} /> : <p class="caption">{t.previewEmpty}</p>}</div>
      </section>

      <section class="admin-box" aria-labelledby="script-title">
        <h2 id="script-title">{t.scriptHeading}</h2>
        <Text id="script" as="textarea" rows={8} label={t.scriptLabel} helper={t.scriptHelp} value={form.script} onInput={(v) => set('script', v)} />
        <h3>{t.preview}</h3>
        <div class="preview">{form.script.trim() ? <div class="prose" dangerouslySetInnerHTML={{ __html: scriptHtml }} /> : <p class="caption">{t.previewEmpty}</p>}</div>
      </section>

      <section class="admin-box" aria-labelledby="slides-title">
        <h2 id="slides-title">{t.slidesHeading}</h2>
        <p class="field-helper">{t.slidesHelp}</p>
        {deck.deck ? (
          <p class="admin-message" role="status">{t.slidesOk(slides.length)}</p>
        ) : (
          <div class="admin-message is-error" role="alert">
            <ul class="problem-list">{deck.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        {deck.warnings.length > 0 && (
          <ul class="note-list">{deck.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        )}

        {slides.length > 0 && (
          <div>
            <h3 id="slide-order">{t.slidesList}</h3>
            <ol class="clean-list" aria-labelledby="slide-order">
              {slides.map((slide, i) => (
                <li key={i}>
                  <button type="button" class="slide-list-item" aria-current={i === chosen ? 'true' : undefined} onClick={() => setChosen(i)}>
                    {t.slideOf(i + 1, slide.layout, slide.title)}
                  </button>
                  {i === chosen && (
                    <MoveButtons
                      index={i}
                      count={slides.length}
                      label={t.slideOf(i + 1, slide.layout, slide.title)}
                      onMove={(to) => { changeSlides((list) => moveItem(list, i, to)); setChosen(to); }}
                      onRemove={() => { changeSlides((list) => list.filter((_, j) => j !== i)); setChosen(Math.max(0, i - 1)); }}
                    />
                  )}
                </li>
              ))}
            </ol>
            {current && (
              <div style="margin: 16px 0;">
                <p class="label">{t.slidePreview}</p>
                <SlideFrame>
                  <SlideCanvas slide={current} lessonName={form.title || t.titleNew} imageUrl={imageUrl} />
                </SlideFrame>
                <PhotosPanel
                  slide={current}
                  pictures={pictureNames}
                  onChange={(photos) => changeSlides((list) => list.map((s, j) => (j === Math.min(chosen, list.length - 1) ? withPhotos(s, photos) : s)))}
                  onUpload={async (files) => {
                    const room = MAX_SLIDE_IMAGES - slideImages(current).length;
                    // These go straight onto this slide, so no name matching here.
                    const added = await addPictures(files.slice(0, Math.max(0, room)), false);
                    const index = Math.min(chosen, slides.length - 1);
                    changeSlides((list) => list.map((s, j) => (j === index ? withPhotos(s, [...slideImages(s), ...added.map((file) => ({ file, alt: '' }))].slice(0, MAX_SLIDE_IMAGES)) : s)));
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div class="field">
          <label class="field-label" for="add-layout">{t.addSlideLayout}</label>
          <select id="add-layout" class="field-control" value={addLayout} onChange={(e) => setAddLayout(e.currentTarget.value as Layout)}>
            {(Object.keys(templates) as Layout[]).map((layout) => (
              <option value={layout} key={layout}>{layout}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          class="button button-secondary"
          disabled={!deck.deck}
          onClick={() => {
            changeSlides((list) => [...list, templates[addLayout](list.filter((s) => s.layout === 'step').length + 1)]);
            setChosen(slides.length);
          }}
        >
          {t.addSlide}
        </button>

        <div style="margin-top: 24px;">
          <Text id="slides-json" as="textarea" rows={14} label={t.slidesJsonLabel} value={form.deckText} onInput={(v) => set('deckText', v)} />
        </div>
      </section>

      <section class="admin-box" aria-labelledby="files-title">
        <h2 id="files-title">{t.filesHeading}</h2>
        <p class="field-helper">{t.filesHelp}</p>
        {FILE_SLOTS.map((slot) => {
          const old = lesson?.files[slot];
          return (
            <div class="field" key={slot}>
              <label class="field-label" for={`slot-${slot}`}>{t.slots[slot]}</label>
              <p class="field-helper">
                {old ? (
                  <span>
                    {t.currentFile}: <a href={fileUrl(old.path)} target="_blank" rel="noopener noreferrer">{old.path.split('/').pop()}</a> ({formatBytes(old.bytes)})
                  </span>
                ) : (
                  t.noFile
                )}
              </p>
              <input id={`slot-${slot}`} class="field-control" type="file" accept=".pdf,application/pdf" onChange={(e) => void chooseSlot(slot, e.currentTarget.files?.[0])} />
              {slotFiles[slot] && <p class="caption">{t.chosen}: {slotFiles[slot]!.name} ({formatBytes(slotFiles[slot]!.size)})</p>}
              {fileProblems[`slot:${slot}`] && <p class="field-error"><Icon name="alert" size={24} /><span>{fileProblems[`slot:${slot}`]}</span></p>}
              {old && (
                <label class="choice">
                  <input type="checkbox" checked={Boolean(slotRemove[slot])} onChange={(e) => setSlotRemove({ ...slotRemove, [slot]: e.currentTarget.checked })} />
                  <span>{t.removeFile}</span>
                </label>
              )}
            </div>
          );
        })}

        <div class="field">
          <label class="field-label" for="images">{t.imagesLabel}</label>
          <p class="field-helper">{t.imagesHelp}</p>
          {(lesson?.files.images ?? []).length > 0 && (
            <ul class="clean-list">
              {(lesson?.files.images ?? []).map((image) => (
                <li key={image.name}>
                  <label class="choice">
                    <input type="checkbox" checked={imageRemove.includes(image.name)} onChange={(e) => setImageRemove(e.currentTarget.checked ? [...imageRemove, image.name] : imageRemove.filter((n) => n !== image.name))} />
                    <span>
                      {image.name} ({formatBytes(image.bytes)}) {imageRemove.includes(image.name) ? `. ${t.willRemove}` : `. ${t.removeFile}`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <input id="images" class="field-control" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.svg" onChange={(e) => { const files = e.currentTarget.files; chooseImages(files); }} />
          {newImages.length > 0 && <p class="caption">{t.chosen}: {newImages.map((f) => f.name).join(', ')}</p>}
          {(slidePictures.length > 0 || unusedPictures.length > 0) && (
            <div class="picture-match">
              <h3>{t.matchHeading}</h3>
              <ul class="clean-list">
                {slidePictures.map((p, i) => (
                  <li key={`${i}-${p.file}`} class={p.ok ? '' : 'is-missing'}>
                    <Icon name={p.ok ? 'check' : 'alert'} size={24} /> <span>{p.ok ? t.matchFound(p.n, p.file) : t.matchMissing(p.n, p.file)}</span>
                  </li>
                ))}
                {unusedPictures.map((file) => (
                  <li key={`unused-${file}`}>
                    <Icon name="info" size={24} /> <span>{t.matchUnused(file)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Object.entries(fileProblems).filter(([k]) => k.startsWith('image:')).map(([k, m]) => (
            <p class="field-error" key={k}><Icon name="alert" size={24} /><span>{m}</span></p>
          ))}
        </div>
      </section>

      <section class="admin-box" aria-labelledby="extras-title">
        <h2 id="extras-title">{t.extrasHeading}</h2>
        <p class="field-helper">{t.extrasHelp}</p>
        {extraRows.length === 0 && <p>{t.extrasNone}</p>}
        {extraRows.map((row, i) => (
          <div class="editor-row extra-row" key={row.id}>
            <div class="field">
              <label class="field-label" for={`extra-title-${row.id}`}>{t.extraTitle(i + 1)}</label>
              <p class="field-helper" id={`extra-title-help-${row.id}`}>{t.extraTitleHelp}</p>
              <input
                id={`extra-title-${row.id}`}
                class="field-control"
                maxLength={80}
                aria-describedby={`extra-title-help-${row.id}`}
                value={row.title}
                onInput={(e) => changeExtra(row.id, { title: e.currentTarget.value })}
              />
            </div>
            <div class="field">
              <label class="field-label" for={`extra-file-${row.id}`}>{row.old ? t.extraReplace : t.extraFile(i + 1)}</label>
              {row.old && (
                <p class="caption">
                  {t.currentFile}:{' '}
                  <a href={fileUrl(row.old.path)} target="_blank" rel="noopener noreferrer">{row.old.name}</a> ({formatBytes(row.old.bytes)})
                </p>
              )}
              <input id={`extra-file-${row.id}`} class="field-control" type="file" accept=".pdf,application/pdf" onChange={(e) => void chooseExtra(row.id, e.currentTarget.files?.[0])} />
              {row.file && <p class="caption">{t.chosen}: {row.file.name} ({formatBytes(row.file.size)})</p>}
              {row.problem && <p class="field-error"><Icon name="alert" size={24} /><span>{row.problem}</span></p>}
            </div>
            <button type="button" class="button button-secondary" onClick={() => setExtraRows((rows) => rows.filter((r) => r.id !== row.id))}>
              {t.removeExtra(i + 1)}
            </button>
          </div>
        ))}
        <button type="button" class="button button-secondary" onClick={() => setExtraRows((rows) => [...rows, { id: ++extraRowId, title: '', old: null, file: null, problem: '' }])}>
          {t.addExtra}
        </button>
      </section>

      <section class="admin-box" aria-labelledby="videos-title">
        <h2 id="videos-title">{t.videosHeading}</h2>
        <p class="field-helper">{t.videosHelp}</p>
        {form.videos.map((video, i) => {
          const bad = video.link.trim() !== '' && !parseYouTubeId(video.link);
          return (
            <div class="editor-row" key={i}>
              <div class="field">
                <label class="field-label" for={`video-link-${i}`}>{t.videoLink(i + 1)}</label>
                <input id={`video-link-${i}`} class="field-control" type="text" value={video.link} aria-invalid={bad ? 'true' : undefined} onInput={(e) => set('videos', form.videos.map((v, j) => (j === i ? { ...v, link: e.currentTarget.value } : v)))} />
                {bad && <p class="field-error"><Icon name="alert" size={24} /><span>{t.videoBad}</span></p>}
              </div>
              <Text id={`video-label-${i}`} label={t.videoLabel(i + 1)} value={video.label} onInput={(v) => set('videos', form.videos.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
              <MoveButtons index={i} count={form.videos.length} label={t.videoLink(i + 1)} onMove={(to) => set('videos', moveItem(form.videos, i, to))} onRemove={() => set('videos', form.videos.filter((_, j) => j !== i))} />
            </div>
          );
        })}
        <button type="button" class="button button-secondary" onClick={() => set('videos', [...form.videos, { link: '', label: '' }])}>
          {t.addVideo}
        </button>
      </section>

      <div class="button-row">
        <button type="button" class="button button-primary" disabled={busy !== ''} onClick={save}>
          {busy || t.save}
        </button>
        <a class="button button-secondary" href="/admin/lessons">{t.back}</a>
      </div>
      {busy && <p role="status">{busy}</p>}
    </div>
  );
}
