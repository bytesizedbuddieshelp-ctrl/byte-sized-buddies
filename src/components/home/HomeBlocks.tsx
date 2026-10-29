// Draws the landing page from its blocks. The public page and the editor in /admin/site use this same file,
// so what the owner edits is what visitors get. Without the "edit" prop it draws the plain page. With it,
// every piece of text can be typed over in place, and links, lists, and pictures are changed in the block's options.
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { Icon } from '../forms/Icon';
import HomeLessons from '../lessons/HomeLessons';
import { BuiltinScene } from '../illustrations/Scenes';
import { fileUrl } from '../../lib/lessons';
import type { Block, Card, Fact, PageButton, Picture, Tile } from '../../lib/homePage';
import { adminCopy } from '../../content/adminCopy';

const e = adminCopy.siteEdit;

export interface EditApi {
  /** Changes one block. The editor keeps the undo list. */
  update: (id: string, change: (block: Block) => Block) => void;
}

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'strong' | 'li';

// Some browsers don't know "plaintext-only" yet. Then plain "true" is used, and pasted text is flattened by hand.
const plainOnly = (() => {
  if (typeof document === 'undefined') return false;
  const probe = document.createElement('div');
  try {
    probe.contentEditable = 'plaintext-only';
  } catch {
    return false;
  }
  return probe.contentEditable === 'plaintext-only';
})();

interface FieldProps {
  edit?: EditApi;
  /** What this text is, for people using a screen reader and for the empty-box hint. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  as?: Tag;
  class?: string;
  id?: string;
  /** Allow line breaks (Enter). */
  multiline?: boolean;
}

// One piece of text. On the public page it is plain text. In the editor it is typed over in place.
function Field({ edit, label, value, onChange, as = 'p', class: className, id, multiline }: FieldProps) {
  const Tag = as as unknown as 'div';
  const ref = useRef<HTMLElement>(null);
  const shown = useRef<string | null>(null);

  // Put the words in the box only when they changed from outside (undo, redo). While typing, leave the box alone,
  // so the cursor never jumps.
  useLayoutEffect(() => {
    if (edit && ref.current && shown.current !== value) {
      ref.current.textContent = value;
      shown.current = value;
    }
  }, [value, edit]);

  if (!edit) {
    if (!value.trim()) return null;
    return (
      <Tag id={id} class={className} style={multiline ? 'white-space: pre-line;' : undefined}>
        {value}
      </Tag>
    );
  }

  const read = () => {
    const el = ref.current!;
    const raw = (multiline ? el.innerText : el.textContent) ?? '';
    return (multiline ? raw : raw.replace(/\n/g, ' ')).replace(/ /g, ' ');
  };
  const attrs = {
    contenteditable: plainOnly ? 'plaintext-only' : 'true',
    role: 'textbox',
    'aria-label': label,
    'aria-multiline': multiline ? 'true' : undefined,
    'data-placeholder': label,
    spellcheck: true,
  } as unknown as JSX.HTMLAttributes<HTMLDivElement>;

  return (
    <Tag
      {...attrs}
      ref={ref as never}
      id={id}
      class={`editable${className ? ` ${className}` : ''}`}
      style={multiline ? 'white-space: pre-wrap;' : undefined}
      onInput={() => {
        const next = read();
        shown.current = next;
        onChange(next);
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Enter' && !multiline) {
          event.preventDefault();
          (event.currentTarget as HTMLElement).blur();
        }
      }}
      onPaste={(event: ClipboardEvent) => {
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain') ?? '';
        document.execCommand('insertText', false, multiline ? text : text.replace(/\s*\n\s*/g, ' '));
      }}
    />
  );
}

function Buttons({ buttons, edit, onChange }: { buttons: PageButton[]; edit?: EditApi; onChange: (buttons: PageButton[]) => void }) {
  if (!buttons.length) return null;
  const set = (i: number, change: Partial<PageButton>) => onChange(buttons.map((b, j) => (j === i ? { ...b, ...change } : b)));
  return (
    <div class="actions">
      {buttons.map((button, i) =>
        edit ? (
          <span class={`button button-${button.style}`} key={i}>
            <Field edit={edit} as="span" label={e.buttonLabel(i + 1)} value={button.label} onChange={(label) => set(i, { label })} />
          </span>
        ) : (
          <a class={`button button-${button.style}`} href={button.href} key={i}>
            {button.label}
          </a>
        ),
      )}
    </div>
  );
}

// A picture: a drawing that comes with the site, or one the owner uploaded.
function PictureView({ picture, framed }: { picture: Picture; framed?: boolean }) {
  if (picture.kind === 'none') return null;
  if (picture.kind === 'builtin') return framed ? <div class="ill-frame"><BuiltinScene name={picture.name} /></div> : <BuiltinScene name={picture.name} />;
  const img = <img class="home-photo" src={fileUrl(picture.file)} alt={picture.alt} loading="lazy" />;
  return framed ? <div class="ill-frame ill-frame--photo">{img}</div> : img;
}

type Update<B extends Block> = (change: (block: B) => B) => void;

function Hero({ block, edit, up }: { block: Extract<Block, { type: 'hero' }>; edit?: EditApi; up: Update<typeof block> }) {
  const id = `${block.id}-title`;
  const setFact = (i: number, change: Partial<Fact>) => up((b) => ({ ...b, facts: b.facts.map((f, j) => (j === i ? { ...f, ...change } : f)) }));
  return (
    <section class="container hero" aria-labelledby={id}>
      <div class={`split${block.picture.kind === 'none' ? ' split--single' : ''}`}>
        <div>
          <Field edit={edit} class="kicker" label={e.fields.kicker} value={block.kicker} onChange={(kicker) => up((b) => ({ ...b, kicker }))} />
          <Field edit={edit} as="h1" id={id} class="hero-title" label={e.fields.title} value={block.title} onChange={(title) => up((b) => ({ ...b, title }))} />
          <Field edit={edit} class="lead" multiline label={e.fields.text} value={block.text} onChange={(text) => up((b) => ({ ...b, text }))} />
          <Buttons edit={edit} buttons={block.buttons} onChange={(buttons) => up((b) => ({ ...b, buttons }))} />
        </div>
        <PictureView picture={block.picture} framed />
      </div>
      {block.facts.length > 0 && (
        <ul class="fact-strip">
          {block.facts.map((fact, i) => (
            <li key={i}>
              <span class="icon-circle">
                <Icon name={fact.icon} size={26} />
              </span>
              <span>
                <Field edit={edit} as="strong" label={e.fields.factTitle(i + 1)} value={fact.title} onChange={(title) => setFact(i, { title })} />
                <Field edit={edit} as="span" label={e.fields.factText(i + 1)} value={fact.text} onChange={(text) => setFact(i, { text })} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Cards({ block, edit, up }: { block: Extract<Block, { type: 'cards' }>; edit?: EditApi; up: Update<typeof block> }) {
  const id = `${block.id}-title`;
  const set = (i: number, change: Partial<Card>) => up((b) => ({ ...b, cards: b.cards.map((c, j) => (j === i ? { ...c, ...change } : c)) }));
  return (
    <section class="container section" aria-labelledby={id}>
      <Field edit={edit} as="h2" id={id} label={e.fields.heading} value={block.heading} onChange={(heading) => up((b) => ({ ...b, heading }))} />
      <ol class="grid clean-list">
        {block.cards.map((card, i) => (
          <li class="card visit-card" key={i}>
            <PictureView picture={card.picture} />
            <div class="step-line">
              {block.numbered && <div class="step-number" aria-hidden="true">{i + 1}</div>}
              <h3>
                {block.numbered && !edit && <span class="visually-hidden">Step {i + 1}: </span>}
                <Field edit={edit} as="span" label={e.fields.cardTitle(i + 1)} value={card.title} onChange={(title) => set(i, { title })} />
              </h3>
            </div>
            <Field edit={edit} multiline label={e.fields.cardText(i + 1)} value={card.text} onChange={(text) => set(i, { text })} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Lessons({ block, edit, up }: { block: Extract<Block, { type: 'lessons' }>; edit?: EditApi; up: Update<typeof block> }) {
  const id = `${block.id}-title`;
  return (
    <section class="container section" aria-labelledby={id}>
      <div class="section-head">
        <div>
          <Field edit={edit} as="h2" id={id} label={e.fields.heading} value={block.heading} onChange={(heading) => up((b) => ({ ...b, heading }))} />
          <Field edit={edit} multiline label={e.fields.intro} value={block.intro} onChange={(intro) => up((b) => ({ ...b, intro }))} />
        </div>
      </div>
      {edit ? (
        <div class="card soon-card">
          <span class="icon-circle">
            <Icon name="book" size={26} />
          </span>
          <p>{e.lessonsPlaceholder}</p>
        </div>
      ) : (
        <HomeLessons />
      )}
    </section>
  );
}

function Band({ block, edit, up }: { block: Extract<Block, { type: 'band' }>; edit?: EditApi; up: Update<typeof block> }) {
  const id = `${block.id}-title`;
  return (
    <section class="band" aria-labelledby={id}>
      <div class="container split split--even">
        <div>
          <Field edit={edit} as="h2" id={id} label={e.fields.heading} value={block.heading} onChange={(heading) => up((b) => ({ ...b, heading }))} />
          <Field edit={edit} class="lead" multiline label={e.fields.text} value={block.text} onChange={(text) => up((b) => ({ ...b, text }))} />
          <Buttons edit={edit} buttons={block.buttons} onChange={(buttons) => up((b) => ({ ...b, buttons }))} />
        </div>
        <div class="sheet">
          <Field edit={edit} as="h3" label={e.fields.listHeading} value={block.listHeading} onChange={(listHeading) => up((b) => ({ ...b, listHeading }))} />
          <ul class="check-list">
            {block.list.map((item, i) => (
              <li key={i}>
                <Icon name="check" size={24} />
                <Field edit={edit} as="span" label={e.fields.listItem(i + 1)} value={item} onChange={(value) => up((b) => ({ ...b, list: b.list.map((x, j) => (j === i ? value : x)) }))} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Split({ block, edit, up }: { block: Extract<Block, { type: 'split' }>; edit?: EditApi; up: Update<typeof block> }) {
  const id = `${block.id}-title`;
  const hasPicture = block.picture.kind !== 'none';
  return (
    <section class="container section" aria-labelledby={id}>
      <div class={`split${block.pictureFirst ? ' split--reverse' : ''}${hasPicture ? '' : ' split--single'}`}>
        <div>
          <Field edit={edit} as="h2" id={id} label={e.fields.heading} value={block.heading} onChange={(heading) => up((b) => ({ ...b, heading }))} />
          <Field edit={edit} class="lead" multiline label={e.fields.text} value={block.text} onChange={(text) => up((b) => ({ ...b, text }))} />
          <Buttons edit={edit} buttons={block.buttons} onChange={(buttons) => up((b) => ({ ...b, buttons }))} />
        </div>
        <PictureView picture={block.picture} framed />
      </div>
    </section>
  );
}

function Tiles({ block, edit, up }: { block: Extract<Block, { type: 'tiles' }>; edit?: EditApi; up: Update<typeof block> }) {
  const id = `${block.id}-title`;
  const set = (i: number, change: Partial<Tile>) => up((b) => ({ ...b, tiles: b.tiles.map((t, j) => (j === i ? { ...t, ...change } : t)) }));
  return (
    <section class="container section" aria-labelledby={id}>
      <Field edit={edit} as="h2" id={id} label={e.fields.heading} value={block.heading} onChange={(heading) => up((b) => ({ ...b, heading }))} />
      <Field edit={edit} multiline label={e.fields.intro} value={block.intro} onChange={(intro) => up((b) => ({ ...b, intro }))} />
      <ul class="tile-grid">
        {block.tiles.map((tile, i) => (
          <li key={i}>
            <span class="icon-circle icon-circle--tint">
              <Icon name={tile.icon} size={26} />
            </span>
            <Field edit={edit} as="span" label={e.fields.tile(i + 1)} value={tile.text} onChange={(text) => set(i, { text })} />
          </li>
        ))}
      </ul>
      <Buttons edit={edit} buttons={block.buttons} onChange={(buttons) => up((b) => ({ ...b, buttons }))} />
    </section>
  );
}

function TextSection({ block, edit, up }: { block: Extract<Block, { type: 'text' }>; edit?: EditApi; up: Update<typeof block> }) {
  const id = `${block.id}-title`;
  return (
    <section class="container section" aria-labelledby={id}>
      <Field edit={edit} as="h2" id={id} label={e.fields.heading} value={block.heading} onChange={(heading) => up((b) => ({ ...b, heading }))} />
      <Field edit={edit} multiline label={e.fields.text} value={block.text} onChange={(text) => up((b) => ({ ...b, text }))} />
      <Buttons edit={edit} buttons={block.buttons} onChange={(buttons) => up((b) => ({ ...b, buttons }))} />
    </section>
  );
}

function ImageSection({ block, edit, up }: { block: Extract<Block, { type: 'image' }>; edit?: EditApi; up: Update<typeof block> }) {
  return (
    <section class="container section">
      <figure class="home-figure">
        {block.picture.kind === 'none' ? edit && <p class="card">{e.noPictureYet}</p> : <PictureView picture={block.picture} framed />}
        <Field edit={edit} as="p" class="caption" label={e.fields.caption} value={block.caption} onChange={(caption) => up((b) => ({ ...b, caption }))} />
      </figure>
    </section>
  );
}

/** One block, drawn. */
export function BlockView({ block, edit }: { block: Block; edit?: EditApi }) {
  // Each block only changes itself, so the editor can keep one undo list for the whole page.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up: Update<any> = (change) => edit?.update(block.id, change);
  switch (block.type) {
    case 'hero': return <Hero block={block} edit={edit} up={up} />;
    case 'cards': return <Cards block={block} edit={edit} up={up} />;
    case 'lessons': return <Lessons block={block} edit={edit} up={up} />;
    case 'band': return <Band block={block} edit={edit} up={up} />;
    case 'split': return <Split block={block} edit={edit} up={up} />;
    case 'tiles': return <Tiles block={block} edit={edit} up={up} />;
    case 'text': return <TextSection block={block} edit={edit} up={up} />;
    case 'image': return <ImageSection block={block} edit={edit} up={up} />;
  }
}

/** The public page: every block that isn't hidden. */
export function HomeBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.filter((b) => !b.hidden).map((block) => (
        <BlockView block={block} key={block.id} />
      ))}
    </>
  );
}
