import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminShell } from './AdminShell';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from '../forms/Icon';
import { BlockView, type EditApi } from '../home/HomeBlocks';
import { adminCopy } from '../../content/adminCopy';
import {
  BLOCK_TYPES, BUILTIN_PICTURES, defaultBlocks, duplicateBlock, ICON_NAMES, insertBlock, isSafeHref, loadHomePage, MAX_BLOCKS, MAX_BUTTONS, MAX_ITEMS,
  moveBlock, newBlock, problemsIn, removeBlock, resetHomePage, saveHomePage,
  type Block, type BlockType, type BuiltinPicture, type PageButton, type Picture,
} from '../../lib/homePage';
import { uploadSitePicture } from '../../lib/sitePictures';
import type { IconName } from '../../lib/icons';

const t = adminCopy.siteEdit;

export default function SitePage() {
  return (
    <AdminShell current="site" title={t.title}>
      {(supabase) => <Editor supabase={supabase} />}
    </AdminShell>
  );
}

// ---- Undo list --------------------------------------------------------------------------------

interface History {
  past: Block[][];
  present: Block[];
  future: Block[][];
}

const TYPING_PAUSE_MS = 1500;
const json = (blocks: Block[]) => JSON.stringify(blocks);

// ---- Small pieces for the options panel -------------------------------------------------------

function Check({ id, checked, label, onChange }: { id: string; checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label class="choice" for={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      <span>{label}</span>
    </label>
  );
}

const SITE_PAGES = ['/lessons', '/for-senior-homes', '/for-senior-homes#contact', '/ask', '/teach', '/about', '/faq', '/stay-safe', '/visit-checklist', '/privacy', '/license'];

function ButtonsEditor({ idPrefix, buttons, onChange }: { idPrefix: string; buttons: PageButton[]; onChange: (buttons: PageButton[]) => void }) {
  const set = (i: number, change: Partial<PageButton>) => onChange(buttons.map((b, j) => (j === i ? { ...b, ...change } : b)));
  return (
    <fieldset class="options-group">
      <legend>{t.buttonsHeading}</legend>
      <datalist id="site-pages">
        {SITE_PAGES.map((page) => (
          <option value={page} key={page} />
        ))}
      </datalist>
      {buttons.length === 0 && <p class="caption">{t.noButtons}</p>}
      {buttons.map((button, i) => {
        const bad = !isSafeHref(button.href);
        return (
          <div class="editor-row" key={i}>
            <p class="label">{t.buttonLabel(i + 1)}</p>
            <div class="field">
              <label class="field-label" for={`${idPrefix}-b${i}-text`}>{t.buttonWords}</label>
              <input id={`${idPrefix}-b${i}-text`} class="field-control" value={button.label} maxLength={60} onInput={(event) => set(i, { label: event.currentTarget.value })} />
            </div>
            <div class="field">
              <label class="field-label" for={`${idPrefix}-b${i}-link`}>{t.buttonLink}</label>
              <p class="field-helper" id={`${idPrefix}-b${i}-help`}>{t.buttonLinkHelp}</p>
              <input
                id={`${idPrefix}-b${i}-link`}
                class="field-control"
                list="site-pages"
                value={button.href}
                aria-describedby={`${idPrefix}-b${i}-help`}
                aria-invalid={bad}
                onInput={(event) => set(i, { href: event.currentTarget.value.trim() })}
              />
              {bad && <p class="field-error"><Icon name="alert" size={24} /><span>{t.badLink}</span></p>}
            </div>
            <div class="field">
              <label class="field-label" for={`${idPrefix}-b${i}-style`}>{t.buttonStyle}</label>
              <select id={`${idPrefix}-b${i}-style`} class="field-control" value={button.style} onChange={(event) => set(i, { style: event.currentTarget.value as PageButton['style'] })}>
                <option value="primary">{t.stylePrimary}</option>
                <option value="secondary">{t.styleSecondary}</option>
              </select>
            </div>
            <button type="button" class="button button-secondary" onClick={() => onChange(buttons.filter((_, j) => j !== i))}>
              {t.removeButton(i + 1)}
            </button>
          </div>
        );
      })}
      {buttons.length < MAX_BUTTONS && (
        <button type="button" class="button button-secondary" onClick={() => onChange([...buttons, { label: t.newButtonLabel, href: '/lessons', style: buttons.length ? 'secondary' : 'primary' }])}>
          {t.addButton}
        </button>
      )}
    </fieldset>
  );
}

function PictureEditor({
  idPrefix, heading, picture, onChange, supabase, say,
}: { idPrefix: string; heading: string; picture: Picture; onChange: (picture: Picture) => void; supabase: SupabaseClient; say: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem('');
    say(t.uploading(file.name));
    try {
      const path = await uploadSitePicture(supabase, file);
      onChange({ kind: 'upload', file: path, alt: picture.kind === 'upload' ? picture.alt : '' });
      say(t.uploaded(file.name));
    } catch (error) {
      const message = error instanceof Error ? error.message : t.uploadFailed;
      setProblem(message);
      say(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset class="options-group">
      <legend>{heading}</legend>
      <div class="field">
        <label class="field-label" for={`${idPrefix}-kind`}>{t.pictureKind}</label>
        <select
          id={`${idPrefix}-kind`}
          class="field-control"
          value={picture.kind}
          onChange={(event) => {
            const kind = event.currentTarget.value;
            if (kind === 'none') onChange({ kind: 'none' });
            else if (kind === 'builtin') onChange({ kind: 'builtin', name: 'hero' });
          }}
        >
          <option value="none">{t.pictureNone}</option>
          <option value="builtin">{t.pictureBuiltin}</option>
          {picture.kind === 'upload' && <option value="upload">{t.pictureOwn}</option>}
        </select>
      </div>
      {picture.kind === 'builtin' && (
        <div class="field">
          <label class="field-label" for={`${idPrefix}-drawing`}>{t.pictureDrawing}</label>
          <select id={`${idPrefix}-drawing`} class="field-control" value={picture.name} onChange={(event) => onChange({ kind: 'builtin', name: event.currentTarget.value as BuiltinPicture })}>
            {BUILTIN_PICTURES.map((name) => (
              <option value={name} key={name}>{t.drawings[name]}</option>
            ))}
          </select>
        </div>
      )}
      <div class="field">
        <label class="field-label" for={`${idPrefix}-file`}>{picture.kind === 'upload' ? t.pictureReplace : t.pictureChoose}</label>
        <p class="field-helper" id={`${idPrefix}-file-help`}>{t.pictureHelp}</p>
        <input
          id={`${idPrefix}-file`}
          class="field-control"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.svg"
          disabled={busy}
          aria-describedby={`${idPrefix}-file-help`}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            void choose(file);
          }}
        />
        {problem && <p class="field-error"><Icon name="alert" size={24} /><span>{problem}</span></p>}
      </div>
      {picture.kind === 'upload' && (
        <div class="field">
          <label class="field-label" for={`${idPrefix}-alt`}>{t.pictureAlt}</label>
          <p class="field-helper" id={`${idPrefix}-alt-help`}>{t.pictureAltHelp}</p>
          <input
            id={`${idPrefix}-alt`}
            class="field-control"
            value={picture.alt}
            maxLength={200}
            aria-describedby={`${idPrefix}-alt-help`}
            aria-invalid={!picture.alt.trim()}
            onInput={(event) => onChange({ ...picture, alt: event.currentTarget.value })}
          />
          {!picture.alt.trim() && <p class="field-error"><Icon name="alert" size={24} /><span>{t.altNeeded}</span></p>}
        </div>
      )}
    </fieldset>
  );
}

function IconSelect({ id, label, value, onChange }: { id: string; label: string; value: IconName; onChange: (icon: IconName) => void }) {
  return (
    <div class="field">
      <label class="field-label" for={id}>{label}</label>
      <select id={id} class="field-control" value={value} onChange={(event) => onChange(event.currentTarget.value as IconName)}>
        {ICON_NAMES.map((name) => (
          <option value={name} key={name}>{t.iconNames[name] ?? name}</option>
        ))}
      </select>
    </div>
  );
}

/** Add and remove for a list of items (cards, points, facts). */
function ListSize({ what, count, min, onAdd, onRemove }: { what: string; count: number; min: number; onAdd: () => void; onRemove: () => void }) {
  return (
    <div class="actions">
      <button type="button" class="button button-secondary" disabled={count >= MAX_ITEMS} onClick={onAdd}>{t.addItem(what)}</button>
      <button type="button" class="button button-secondary" disabled={count <= min} onClick={onRemove}>{t.removeLast(what)}</button>
    </div>
  );
}

function Options({ block, update, supabase, say, close }: { block: Block; update: EditApi['update']; supabase: SupabaseClient; say: (message: string) => void; close: () => void }) {
  const id = block.id;
  // The options panel changes the selected block, the same way typing on the page does.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const change = (fn: (b: any) => Block) => update(id, fn);
  return (
    <section class="edit-options" aria-labelledby={`${id}-options-title`} tabIndex={-1} id={`${id}-options`}>
      <div class="edit-options-head">
        <h3 id={`${id}-options-title`}>{t.optionsFor(t.types[block.type].name)}</h3>
        <button type="button" class="button button-secondary" onClick={close}>{t.optionsDone}</button>
      </div>
      <p class="caption">{t.optionsHelp}</p>

      {(block.type === 'hero' || block.type === 'split' || block.type === 'image') && (
        <PictureEditor idPrefix={`${id}-pic`} heading={t.pictureHeading} picture={block.picture} supabase={supabase} say={say} onChange={(picture) => change((b) => ({ ...b, picture }))} />
      )}
      {block.type === 'split' && (
        <Check id={`${id}-first`} checked={block.pictureFirst} label={t.pictureFirst} onChange={(pictureFirst) => change((b) => ({ ...b, pictureFirst }))} />
      )}

      {block.type === 'cards' && (
        <>
          <Check id={`${id}-numbered`} checked={block.numbered} label={t.numbered} onChange={(numbered) => change((b) => ({ ...b, numbered }))} />
          <ListSize
            what={t.what.card}
            count={block.cards.length}
            min={1}
            onAdd={() => change((b) => ({ ...b, cards: [...b.cards, { picture: { kind: 'none' }, title: t.newCardTitle, text: t.newCardText }] }))}
            onRemove={() => change((b) => ({ ...b, cards: b.cards.slice(0, -1) }))}
          />
          {block.cards.map((card, i) => (
            <PictureEditor
              key={i}
              idPrefix={`${id}-card${i}`}
              heading={t.cardPicture(i + 1)}
              picture={card.picture}
              supabase={supabase}
              say={say}
              onChange={(picture) => change((b) => ({ ...b, cards: b.cards.map((c: Block, j: number) => (j === i ? { ...c, picture } : c)) }))}
            />
          ))}
        </>
      )}

      {block.type === 'tiles' && (
        <>
          <ListSize
            what={t.what.point}
            count={block.tiles.length}
            min={1}
            onAdd={() => change((b) => ({ ...b, tiles: [...b.tiles, { icon: 'check', text: t.newPoint }] }))}
            onRemove={() => change((b) => ({ ...b, tiles: b.tiles.slice(0, -1) }))}
          />
          {block.tiles.map((tile, i) => (
            <IconSelect key={i} id={`${id}-tile${i}`} label={t.iconFor(i + 1)} value={tile.icon} onChange={(icon) => change((b) => ({ ...b, tiles: b.tiles.map((x: Block, j: number) => (j === i ? { ...x, icon } : x)) }))} />
          ))}
        </>
      )}

      {block.type === 'hero' && (
        <>
          <ListSize
            what={t.what.fact}
            count={block.facts.length}
            min={0}
            onAdd={() => change((b) => ({ ...b, facts: [...b.facts, { icon: 'check', title: t.newFactTitle, text: t.newFactText }] }))}
            onRemove={() => change((b) => ({ ...b, facts: b.facts.slice(0, -1) }))}
          />
          {block.facts.map((fact, i) => (
            <IconSelect key={i} id={`${id}-fact${i}`} label={t.iconForFact(i + 1)} value={fact.icon} onChange={(icon) => change((b) => ({ ...b, facts: b.facts.map((x: Block, j: number) => (j === i ? { ...x, icon } : x)) }))} />
          ))}
        </>
      )}

      {block.type === 'band' && (
        <ListSize
          what={t.what.listItem}
          count={block.list.length}
          min={0}
          onAdd={() => change((b) => ({ ...b, list: [...b.list, t.newListItem] }))}
          onRemove={() => change((b) => ({ ...b, list: b.list.slice(0, -1) }))}
        />
      )}

      {'buttons' in block && <ButtonsEditor idPrefix={`${id}-btn`} buttons={block.buttons} onChange={(buttons) => change((b) => ({ ...b, buttons }))} />}
    </section>
  );
}

// ---- The editor -------------------------------------------------------------------------------

function Editor({ supabase }: { supabase: SupabaseClient }) {
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [history, setHistory] = useState<History>({ past: [], present: [], future: [] });
  const [savedJson, setSavedJson] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [askReset, setAskReset] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const lastTyping = useRef({ key: '', at: 0 });
  const blocks = history.present;
  const dirty = state === 'ready' && json(blocks) !== savedJson;

  useEffect(() => {
    let cancelled = false;
    loadHomePage()
      .then((saved) => {
        if (cancelled) return;
        const start = saved ?? defaultBlocks();
        setHistory({ past: [], present: start, future: [] });
        setSavedJson(json(start));
        setHasSaved(saved !== null);
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  // Warn before leaving with changes that are not saved.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** Replaces the page. Typing in the same block within a moment is one undo step, so Undo isn't one letter at a time. */
  function commit(change: (blocks: Block[]) => Block[], typingKey?: string) {
    setHistory((h) => {
      const next = change(h.present);
      if (next === h.present) return h;
      const now = Date.now();
      const merge = typingKey !== undefined && lastTyping.current.key === typingKey && now - lastTyping.current.at < TYPING_PAUSE_MS && h.past.length > 0;
      lastTyping.current = { key: typingKey ?? '', at: now };
      return { past: merge ? h.past : [...h.past, h.present].slice(-100), present: next, future: [] };
    });
    setProblems([]);
  }

  const edit: EditApi = useMemo(
    () => ({ update: (id, change) => commit((list) => list.map((b) => (b.id === id ? change(b) : b)), id) }),
    [],
  );
  const update = (id: string, change: (b: Block) => Block) => commit((list) => list.map((b) => (b.id === id ? change(b) : b)), `options-${id}`);

  function undo() {
    lastTyping.current.key = '';
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  }
  function redo() {
    lastTyping.current.key = '';
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  }

  const position = (id: string) => blocks.findIndex((b) => b.id === id);
  const name = (block: Block) => t.types[block.type].name;

  function move(id: string, to: number) {
    const from = position(id);
    const target = Math.max(0, Math.min(blocks.length - 1, to));
    if (from < 0 || from === target) return;
    commit((list) => moveBlock(list, from, target));
    setStatus(t.moved(name(blocks[from]), target + 1, blocks.length));
    // Keep keyboard focus on the same button after the block moves.
    requestAnimationFrame(() => document.getElementById(`${id}-${to < from ? 'up' : 'down'}`)?.focus());
  }

  function add(type: BlockType) {
    if (blocks.length >= MAX_BLOCKS) return setStatus(t.tooMany(MAX_BLOCKS));
    const block = newBlock(type, blocks);
    commit((list) => insertBlock(list, block, selected));
    setSelected(block.id);
    setStatus(t.added(t.types[type].name));
    requestAnimationFrame(() => document.getElementById(`block-${block.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }

  function remove(id: string) {
    const block = blocks[position(id)];
    commit((list) => removeBlock(list, id));
    if (selected === id) setSelected(null);
    setStatus(t.deleted(name(block)));
  }

  function toggleHidden(id: string) {
    const block = blocks[position(id)];
    commit((list) => list.map((b) => (b.id === id ? { ...b, hidden: b.hidden ? undefined : true } : b)));
    setStatus(block.hidden ? t.shown(name(block)) : t.hidden(name(block)));
  }

  async function save() {
    const found = problemsIn(blocks);
    setProblems(found);
    if (found.length) return setStatus(t.cannotSave);
    setSaving(true);
    setStatus(t.saving);
    try {
      await saveHomePage(supabase, blocks);
      setSavedJson(json(blocks));
      setHasSaved(true);
      setStatus(t.saved);
    } catch {
      setStatus(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setAskReset(false);
    setSaving(true);
    try {
      await resetHomePage(supabase);
      const start = defaultBlocks();
      setHistory({ past: [], present: start, future: [] });
      setSavedJson(json(start));
      setHasSaved(false);
      setSelected(null);
      setStatus(t.resetDone);
    } catch {
      setStatus(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  // ---- Dragging a block by its handle ----
  function overBlock(event: DragEvent, index: number) {
    if (!dragId) return;
    event.preventDefault();
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setDropAt(event.clientY < box.top + box.height / 2 ? index : index + 1);
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    if (dragId !== null && dropAt !== null) {
      const from = position(dragId);
      move(dragId, dropAt > from ? dropAt - 1 : dropAt);
    }
    setDragId(null);
    setDropAt(null);
  }

  if (state === 'loading') return <p role="status">{t.loading}</p>;
  if (state === 'error') {
    return (
      <p class="field-error" role="alert">
        <Icon name="alert" size={24} />
        <span>{t.loadFailed}</span>
      </p>
    );
  }

  return (
    <div class="site-editor">
      <p>{t.intro}</p>

      <div class="edit-toolbar" role="toolbar" aria-label={t.toolbarLabel}>
        <button type="button" class="button" disabled={saving || !dirty} onClick={() => void save()}>{saving ? t.saving : t.save}</button>
        <button type="button" class="button button-secondary" disabled={!history.past.length} onClick={undo}>{t.undo}</button>
        <button type="button" class="button button-secondary" disabled={!history.future.length} onClick={redo}>{t.redo}</button>
        <a class="button button-secondary" href="/" target="_blank" rel="noopener">{t.viewLive}</a>
        <button type="button" class="button button-secondary" disabled={saving || (!hasSaved && !dirty)} onClick={() => setAskReset(true)}>{t.reset}</button>
      </div>
      <p class="caption" role="status" aria-live="polite">
        {status || (dirty ? t.unsaved : hasSaved ? t.savedState : t.originalState)}
      </p>
      {problems.length > 0 && (
        <div class="callout callout-careful" role="alert">
          <p class="callout-title"><Icon name="alert" size={24} />{t.fixFirst}</p>
          <ul>
            {problems.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div class="page-canvas" onDragLeave={(event) => event.currentTarget === event.target && setDropAt(null)}>
        {blocks.length === 0 && <p class="card">{t.emptyPage}</p>}
        {blocks.map((block, index) => {
          const isSelected = selected === block.id;
          return (
            <div
              id={`block-${block.id}`}
              key={block.id}
              class={`edit-block${isSelected ? ' is-selected' : ''}${block.hidden ? ' is-hidden' : ''}${dragId === block.id ? ' is-dragging' : ''}${dropAt === index ? ' drop-before' : ''}${dropAt === index + 1 && index === blocks.length - 1 ? ' drop-after' : ''}`}
              onFocusIn={() => setSelected(block.id)}
              onClick={() => setSelected(block.id)}
              onDragOver={(event) => overBlock(event, index)}
              onDrop={drop}
            >
              <div class="edit-bar" role="group" aria-label={t.barLabel(index + 1, name(block))}>
                <span
                  class="edit-handle"
                  draggable
                  aria-hidden="true"
                  title={t.dragHint}
                  onDragStart={(event) => {
                    setDragId(block.id);
                    setSelected(block.id);
                    event.dataTransfer?.setData('text/plain', block.id);
                    const frame = document.getElementById(`block-${block.id}`);
                    if (frame && event.dataTransfer) event.dataTransfer.setDragImage(frame, 24, 24);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropAt(null);
                  }}
                >
                  {t.drag}
                </span>
                <span class="edit-bar-title">{index + 1}. {name(block)}{block.hidden ? ` ${t.hiddenTag}` : ''}</span>
                <button type="button" id={`${block.id}-up`} class="button button-secondary" disabled={index === 0} onClick={() => move(block.id, index - 1)}>{t.moveUp}</button>
                <button type="button" id={`${block.id}-down`} class="button button-secondary" disabled={index === blocks.length - 1} onClick={() => move(block.id, index + 1)}>{t.moveDown}</button>
                <button type="button" class="button button-secondary" aria-expanded={isSelected} aria-controls={`${block.id}-options`} onClick={() => { setSelected(block.id); requestAnimationFrame(() => document.getElementById(`${block.id}-options`)?.focus()); }}>{t.options}</button>
                <button type="button" class="button button-secondary" onClick={() => toggleHidden(block.id)}>{block.hidden ? t.show : t.hide}</button>
                <button type="button" class="button button-secondary" disabled={blocks.length >= MAX_BLOCKS} onClick={() => { commit((list) => duplicateBlock(list, block.id)); setStatus(t.copied(name(block))); }}>{t.copy}</button>
                <button type="button" class="button button-secondary" onClick={() => remove(block.id)}>{t.delete}</button>
              </div>
              <div class="edit-body">
                <BlockView block={block} edit={edit} />
              </div>
              {isSelected && <Options block={block} update={update} supabase={supabase} say={setStatus} close={() => setSelected(null)} />}
            </div>
          );
        })}
      </div>

      <section class="edit-add" aria-labelledby="add-title">
        <h2 id="add-title">{t.addHeading}</h2>
        <p>{selected ? t.addHelpAfter : t.addHelpEnd}</p>
        <ul class="add-list clean-list">
          {BLOCK_TYPES.map((type) => (
            <li key={type}>
              <button type="button" class="button button-secondary" onClick={() => add(type)}>
                <span>{t.types[type].name}</span>
                <small>{t.types[type].about}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={askReset}
        title={t.resetTitle}
        confirmLabel={t.resetConfirm}
        cancelLabel={t.resetCancel}
        danger
        onConfirm={() => void reset()}
        onCancel={() => setAskReset(false)}
      >
        <p>{t.resetBody}</p>
      </ConfirmDialog>
    </div>
  );
}
