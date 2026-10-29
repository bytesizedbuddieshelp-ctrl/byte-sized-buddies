// The landing page as data (a list of blocks), so the owner can edit, move, and add things in /admin/site.
// It is saved in the public "settings" table under the key "home_page". Anyone can read it, so everything
// is checked again when it is read: text is cut to length, links are limited to safe kinds, and picture
// names must match the ones the editor makes. A saved page that is missing or damaged falls back to the
// original page (defaultBlocks), so the landing page can never break.
import type { SupabaseClient } from '@supabase/supabase-js';
import { copy } from '../content/copy';
import { iconPaths, type IconName } from './icons';
import { restGet } from './publicApi';

export const HOME_KEY = 'home_page';
export const MAX_BLOCKS = 40;
export const MAX_ITEMS = 8;
export const MAX_BUTTONS = 3;

export type ButtonStyle = 'primary' | 'secondary';
export interface PageButton {
  label: string;
  href: string;
  style: ButtonStyle;
}

/** The drawings that come with the site. "hero" and "handouts" are big; learn, try, and keep are the small card pictures. */
export const BUILTIN_PICTURES = ['hero', 'handouts', 'learn', 'try', 'keep'] as const;
export type BuiltinPicture = (typeof BUILTIN_PICTURES)[number];

export type Picture =
  | { kind: 'none' }
  | { kind: 'builtin'; name: BuiltinPicture }
  | { kind: 'upload'; file: string; alt: string };

export interface BlockBase {
  id: string;
  hidden?: boolean;
}
export interface Fact {
  icon: IconName;
  title: string;
  text: string;
}
export interface HeroBlock extends BlockBase {
  type: 'hero';
  kicker: string;
  title: string;
  text: string;
  buttons: PageButton[];
  picture: Picture;
  facts: Fact[];
}
export interface Card {
  picture: Picture;
  title: string;
  text: string;
}
export interface CardsBlock extends BlockBase {
  type: 'cards';
  heading: string;
  numbered: boolean;
  cards: Card[];
}
export interface LessonsBlock extends BlockBase {
  type: 'lessons';
  heading: string;
  intro: string;
}
export interface BandBlock extends BlockBase {
  type: 'band';
  heading: string;
  text: string;
  buttons: PageButton[];
  listHeading: string;
  list: string[];
}
export interface SplitBlock extends BlockBase {
  type: 'split';
  heading: string;
  text: string;
  buttons: PageButton[];
  picture: Picture;
  /** Picture on the left instead of the right. */
  pictureFirst: boolean;
}
export interface Tile {
  icon: IconName;
  text: string;
}
export interface TilesBlock extends BlockBase {
  type: 'tiles';
  heading: string;
  intro: string;
  tiles: Tile[];
  buttons: PageButton[];
}
export interface TextBlock extends BlockBase {
  type: 'text';
  heading: string;
  text: string;
  buttons: PageButton[];
}
export interface ImageBlock extends BlockBase {
  type: 'image';
  picture: Picture;
  caption: string;
}

export type Block = HeroBlock | CardsBlock | LessonsBlock | BandBlock | SplitBlock | TilesBlock | TextBlock | ImageBlock;
export type BlockType = Block['type'];
/** A block before it has an id (Omit on its own would flatten the union). */
type Draft = Block extends infer B ? (B extends Block ? Omit<B, 'id'> : never) : never;
export const BLOCK_TYPES: BlockType[] = ['hero', 'cards', 'lessons', 'band', 'split', 'tiles', 'text', 'image'];

export const ICON_NAMES = Object.keys(iconPaths) as IconName[];

// ---- Safety checks ---------------------------------------------------------------------------

/** Picture files the editor uploads. They live in the public lesson-files bucket, in a "site" folder. */
export const SITE_FILE = /^site\/[A-Za-z0-9][A-Za-z0-9._-]{0,110}\.(png|jpe?g|webp|svg)$/i;
const HREF_SITE = /^\/(?!\/)[A-Za-z0-9\-._~/?#=&%]*$/;
const HREF_WEB = /^https:\/\/[^\s"'<>]+$/;
const HREF_MAIL = /^mailto:[^\s@"'<>]+@[^\s@"'<>]+$/;
const HREF_ANCHOR = /^#[A-Za-z0-9_-]+$/;

/** A link the page may use: a page on this site ("/lessons"), a secure web address, an email link, or an anchor. */
export function isSafeHref(href: string): boolean {
  const h = href.trim();
  return h.length > 0 && h.length <= 300 && (HREF_SITE.test(h) || HREF_WEB.test(h) || HREF_MAIL.test(h) || HREF_ANCHOR.test(h));
}

const clean = (value: unknown, max: number, fallback = ''): string => (typeof value === 'string' ? value.replace(/\r/g, '').slice(0, max) : fallback);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const list = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
const record = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

function readButtons(value: unknown): PageButton[] {
  return list(value, MAX_BUTTONS).flatMap((raw) => {
    const b = record(raw);
    const href = clean(b.href, 300).trim();
    const label = clean(b.label, 60).replace(/\n/g, ' ');
    if (!label.trim() || !isSafeHref(href)) return [];
    return [{ label, href, style: oneOf(b.style, ['primary', 'secondary'] as const, 'secondary') }];
  });
}

function readPicture(value: unknown): Picture {
  const p = record(value);
  if (p.kind === 'builtin' && (BUILTIN_PICTURES as readonly unknown[]).includes(p.name)) return { kind: 'builtin', name: p.name as BuiltinPicture };
  if (p.kind === 'upload' && typeof p.file === 'string' && SITE_FILE.test(p.file)) return { kind: 'upload', file: p.file, alt: clean(p.alt, 200).replace(/\n/g, ' ') };
  return { kind: 'none' };
}

const readIcon = (value: unknown, fallback: IconName): IconName => (typeof value === 'string' && value in iconPaths ? (value as IconName) : fallback);
const lines = (value: unknown, max: number, each: number): string[] => list(value, max).map((v) => clean(v, each).replace(/\n/g, ' '));

function readBlock(raw: unknown): Draft | null {
  const b = record(raw);
  const hidden = b.hidden === true ? true : undefined;
  switch (b.type) {
    case 'hero':
      return {
        type: 'hero', hidden,
        kicker: clean(b.kicker, 120), title: clean(b.title, 160), text: clean(b.text, 600),
        buttons: readButtons(b.buttons), picture: readPicture(b.picture),
        facts: list(b.facts, MAX_ITEMS).map((f) => ({ icon: readIcon(record(f).icon, 'check'), title: clean(record(f).title, 80), text: clean(record(f).text, 200) })),
      };
    case 'cards':
      return {
        type: 'cards', hidden,
        heading: clean(b.heading, 160), numbered: b.numbered !== false,
        cards: list(b.cards, MAX_ITEMS).map((c) => ({ picture: readPicture(record(c).picture), title: clean(record(c).title, 100), text: clean(record(c).text, 400) })),
      };
    case 'lessons':
      return { type: 'lessons', hidden, heading: clean(b.heading, 160), intro: clean(b.intro, 600) };
    case 'band':
      return {
        type: 'band', hidden,
        heading: clean(b.heading, 160), text: clean(b.text, 800), buttons: readButtons(b.buttons),
        listHeading: clean(b.listHeading, 120), list: lines(b.list, MAX_ITEMS, 160),
      };
    case 'split':
      return {
        type: 'split', hidden,
        heading: clean(b.heading, 160), text: clean(b.text, 1200), buttons: readButtons(b.buttons),
        picture: readPicture(b.picture), pictureFirst: b.pictureFirst === true,
      };
    case 'tiles':
      return {
        type: 'tiles', hidden,
        heading: clean(b.heading, 160), intro: clean(b.intro, 600), buttons: readButtons(b.buttons),
        tiles: list(b.tiles, MAX_ITEMS).map((t) => ({ icon: readIcon(record(t).icon, 'check'), text: clean(record(t).text, 200) })),
      };
    case 'text':
      return { type: 'text', hidden, heading: clean(b.heading, 160), text: clean(b.text, 3000), buttons: readButtons(b.buttons) };
    case 'image':
      return { type: 'image', hidden, picture: readPicture(b.picture), caption: clean(b.caption, 200).replace(/\n/g, ' ') };
    default:
      return null;
  }
}

/** Reads saved page data. Returns null when it isn't a usable page, so the caller shows the original page. */
export function parseHomePage(value: unknown): Block[] | null {
  const data = record(value);
  if (data.version !== 1 || !Array.isArray(data.blocks)) return null;
  const taken = new Set<string>();
  const blocks: Block[] = [];
  for (const raw of data.blocks.slice(0, MAX_BLOCKS)) {
    const block = readBlock(raw);
    if (!block) continue;
    let id = clean(record(raw).id, 40);
    if (!/^[a-z0-9-]{1,40}$/.test(id) || taken.has(id)) id = freshId(block.type, taken);
    taken.add(id);
    blocks.push({ ...block, id } as Block);
  }
  return blocks;
}

export function serializeHomePage(blocks: Block[]): { version: 1; blocks: Block[] } {
  return { version: 1, blocks };
}

// ---- The original page -----------------------------------------------------------------------

const t = copy.home;

/** The landing page as it was built: the same words as src/content/copy.ts. */
export function defaultBlocks(): Block[] {
  const spots: BuiltinPicture[] = ['learn', 'try', 'keep'];
  return [
    {
      id: 'hero', type: 'hero',
      kicker: t.heroKicker, title: copy.tagline, text: copy.mission,
      buttons: [
        { label: t.heroButtons.visit, href: '/for-senior-homes#contact', style: 'primary' },
        { label: t.heroButtons.lessons, href: '/lessons', style: 'secondary' },
      ],
      picture: { kind: 'builtin', name: 'hero' },
      facts: t.facts.map((f) => ({ icon: f.icon as IconName, title: f.title, text: f.text })),
    },
    {
      id: 'visit', type: 'cards', heading: t.visit.heading, numbered: true,
      cards: t.visit.steps.map((s, i) => ({ picture: { kind: 'builtin', name: spots[i] } as Picture, title: s.title, text: s.text })),
    },
    { id: 'lessons', type: 'lessons', heading: t.lessons.heading, intro: t.lessons.intro },
    {
      id: 'homes', type: 'band', heading: t.homes.heading, text: t.homes.text,
      buttons: [
        { label: t.homes.button, href: '/for-senior-homes#contact', style: 'primary' },
        { label: t.homes.more, href: '/for-senior-homes', style: 'secondary' },
      ],
      listHeading: t.homes.needHeading, list: [...t.homes.needs],
    },
    {
      id: 'free', type: 'split', heading: t.free.heading, text: t.free.text,
      buttons: [
        { label: t.free.button, href: '/teach', style: 'secondary' },
        { label: t.heroButtons.lessons, href: '/lessons', style: 'secondary' },
      ],
      picture: { kind: 'builtin', name: 'handouts' }, pictureFirst: false,
    },
    {
      id: 'promise', type: 'tiles', heading: t.promise.heading, intro: t.promise.intro,
      tiles: t.promise.items.map((text, i) => ({ icon: t.promise.icons[i] as IconName, text })),
      buttons: t.promise.moreLinks.map((l) => ({ label: l.label, href: l.href, style: 'secondary' as const })),
    },
  ];
}

// ---- Editing helpers (pure, so they can be tested) -------------------------------------------

export function freshId(type: string, taken: Set<string>): string {
  for (let n = 1; ; n++) {
    const id = `${type}-${n}`;
    if (!taken.has(id)) return id;
  }
}

export const idsOf = (blocks: Block[]) => new Set(blocks.map((b) => b.id));

/** A new block with starter words the owner can type over. */
export function newBlock(type: BlockType, blocks: Block[]): Block {
  const id = freshId(type, idsOf(blocks));
  switch (type) {
    case 'hero':
      return { id, type, kicker: 'A short line above the title', title: 'A big title', text: 'A sentence or two about this page.', buttons: [], picture: { kind: 'none' }, facts: [] };
    case 'cards':
      return { id, type, heading: 'A row of cards', numbered: false, cards: [1, 2, 3].map((n) => ({ picture: { kind: 'none' } as Picture, title: `Card ${n}`, text: 'Write a sentence here.' })) };
    case 'lessons':
      return { id, type, heading: 'What you can learn', intro: 'Our newest lessons appear here by themselves.' };
    case 'band':
      return { id, type, heading: 'A banner with a list', text: 'Say what this is about.', buttons: [], listHeading: 'A short list', list: ['First thing', 'Second thing'] };
    case 'split':
      return { id, type, heading: 'A picture beside words', text: 'Write a few sentences here, then choose a picture in Block options.', buttons: [], picture: { kind: 'none' }, pictureFirst: false };
    case 'tiles':
      return { id, type, heading: 'A group of short points', intro: 'One sentence that introduces them.', tiles: [1, 2, 3, 4].map((n) => ({ icon: 'check' as IconName, text: `Point ${n}` })), buttons: [] };
    case 'text':
      return { id, type, heading: 'A new heading', text: 'Click here and type your words.', buttons: [] };
    case 'image':
      return { id, type, picture: { kind: 'none' }, caption: '' };
  }
}

export function moveBlock(blocks: Block[], from: number, to: number): Block[] {
  if (from === to || from < 0 || from >= blocks.length) return blocks;
  const target = Math.max(0, Math.min(blocks.length - 1, to));
  const copyList = [...blocks];
  const [item] = copyList.splice(from, 1);
  copyList.splice(target, 0, item);
  return copyList;
}

export function insertBlock(blocks: Block[], block: Block, afterId: string | null): Block[] {
  const at = afterId === null ? blocks.length : blocks.findIndex((b) => b.id === afterId) + 1;
  return [...blocks.slice(0, at), block, ...blocks.slice(at)];
}

export function duplicateBlock(blocks: Block[], id: string): Block[] {
  const source = blocks.find((b) => b.id === id);
  if (!source) return blocks;
  const copyOf = { ...structuredClone(source), id: freshId(source.type, idsOf(blocks)) } as Block;
  return insertBlock(blocks, copyOf, id);
}

export const removeBlock = (blocks: Block[], id: string): Block[] => blocks.filter((b) => b.id !== id);

/** A problem that should stop a save, in plain words, or '' when the page is fine. */
export function problemsIn(blocks: Block[]): string[] {
  const found: string[] = [];
  const check = (where: string, pic?: Picture, buttons?: PageButton[]) => {
    if (pic?.kind === 'upload' && !pic.alt.trim()) found.push(`${where}: describe the picture for people who can't see it.`);
    for (const b of buttons ?? []) if (!isSafeHref(b.href)) found.push(`${where}: the link "${b.href}" can't be used. Start it with / or https://.`);
  };
  blocks.forEach((b, i) => {
    const where = `Block ${i + 1}`;
    if ('picture' in b) check(where, b.picture, 'buttons' in b ? b.buttons : undefined);
    else if ('buttons' in b) check(where, undefined, b.buttons);
    if (b.type === 'cards') b.cards.forEach((c, n) => check(`${where}, card ${n + 1}`, c.picture));
  });
  return found;
}

// ---- Loading and saving ----------------------------------------------------------------------

/** The saved page, as a stranger sees it. null when nothing is saved (use defaultBlocks). */
export async function loadHomePage(): Promise<Block[] | null> {
  const rows = await restGet<{ value: unknown }[]>(`settings?select=value&key=eq.${HOME_KEY}&is_public=eq.true&limit=1`);
  return rows[0] ? parseHomePage(rows[0].value) : null;
}

export async function saveHomePage(supabase: SupabaseClient, blocks: Block[]): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: HOME_KEY, value: serializeHomePage(blocks), is_public: true, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Throws the saved page away, so the original page comes back. */
export async function resetHomePage(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from('settings').delete().eq('key', HOME_KEY);
  if (error) throw error;
}
