import { describe, expect, it } from 'vitest';
import { copy } from '../src/content/copy';
import { defaultBlocks, duplicateBlock, insertBlock, isSafeHref, moveBlock, newBlock, parseHomePage, problemsIn, removeBlock, serializeHomePage, type Block } from '../src/lib/homePage';

describe('the original page', () => {
  it('uses the words from copy.ts', () => {
    const [hero] = defaultBlocks();
    expect(hero.type === 'hero' && hero.title).toBe(copy.tagline);
  });
  it('survives being saved and read back', () => {
    const blocks = defaultBlocks();
    expect(parseHomePage(JSON.parse(JSON.stringify(serializeHomePage(blocks))))).toEqual(blocks.map((b) => ({ ...b, hidden: undefined })));
  });
  it('has the six sections in order', () => {
    expect(defaultBlocks().map((b) => b.type)).toEqual(['hero', 'cards', 'lessons', 'band', 'split', 'tiles']);
  });
});

describe('isSafeHref', () => {
  it.each(['/lessons', '/for-senior-homes#contact', 'https://example.org/a?b=1', 'mailto:me@example.org', '#contact'])('allows %s', (h) => {
    expect(isSafeHref(h)).toBe(true);
  });
  it.each(['javascript:alert(1)', 'data:text/html,hi', '//evil.example', 'http://example.org', '', 'https://a b', ' vbscript:x'])('refuses %s', (h) => {
    expect(isSafeHref(h)).toBe(false);
  });
});

describe('parseHomePage', () => {
  it('gives null for anything that is not a page', () => {
    for (const bad of [null, 'x', 5, {}, { version: 2, blocks: [] }, { version: 1 }, { version: 1, blocks: 'no' }]) expect(parseHomePage(bad)).toBeNull();
  });
  it('drops unknown blocks and unsafe buttons', () => {
    const page = parseHomePage({
      version: 1,
      blocks: [
        { type: 'script', id: 'x' },
        { type: 'text', id: 'a', heading: 'Hi', text: 'There', buttons: [{ label: 'Bad', href: 'javascript:alert(1)' }, { label: 'Good', href: '/lessons', style: 'primary' }] },
      ],
    });
    expect(page).toHaveLength(1);
    expect(page![0].type === 'text' && page![0].buttons).toEqual([{ label: 'Good', href: '/lessons', style: 'primary' }]);
  });
  it('refuses picture files outside the site folder', () => {
    const page = parseHomePage({
      version: 1,
      blocks: [
        { type: 'image', id: 'a', picture: { kind: 'upload', file: 'site/ok.png', alt: 'A' } },
        { type: 'image', id: 'b', picture: { kind: 'upload', file: '../secret.png', alt: 'B' } },
        { type: 'image', id: 'c', picture: { kind: 'upload', file: 'site/x.html', alt: 'C' } },
      ],
    })!;
    expect(page.map((b) => b.type === 'image' && b.picture.kind)).toEqual(['upload', 'none', 'none']);
  });
  it('fixes repeated or invalid ids and cuts long text', () => {
    const page = parseHomePage({ version: 1, blocks: [{ type: 'text', id: 'a', heading: 'x'.repeat(999) }, { type: 'text', id: 'a' }, { type: 'text', id: 'BAD ID!' }] })!;
    expect(new Set(page.map((b) => b.id)).size).toBe(3);
    expect(page[0].type === 'text' && page[0].heading).toHaveLength(160);
  });
  it('keeps an empty page empty (the owner may remove everything)', () => {
    expect(parseHomePage({ version: 1, blocks: [] })).toEqual([]);
  });
});

describe('editing helpers', () => {
  const three = (): Block[] => [newBlock('text', []), { ...newBlock('text', []), id: 'text-2' }, { ...newBlock('text', []), id: 'text-3' }];
  it('moves a block and keeps it in range', () => {
    expect(moveBlock(three(), 0, 2).map((b) => b.id)).toEqual(['text-2', 'text-3', 'text-1']);
    expect(moveBlock(three(), 2, -5).map((b) => b.id)).toEqual(['text-3', 'text-1', 'text-2']);
  });
  it('gives new blocks their own ids', () => {
    const blocks = three();
    expect(newBlock('text', blocks).id).toBe('text-4');
  });
  it('inserts after a block, or at the end', () => {
    const blocks = three();
    const extra = newBlock('image', blocks);
    expect(insertBlock(blocks, extra, 'text-1').map((b) => b.id)).toEqual(['text-1', 'image-1', 'text-2', 'text-3']);
    expect(insertBlock(blocks, extra, null).at(-1)).toBe(extra);
  });
  it('duplicates without sharing data, and removes', () => {
    const blocks = three();
    const doubled = duplicateBlock(blocks, 'text-2');
    expect(doubled).toHaveLength(4);
    expect(doubled[2].id).toBe('text-4');
    expect(doubled[2]).not.toBe(doubled[1]);
    expect(removeBlock(doubled, 'text-4')).toHaveLength(3);
  });
});

describe('problemsIn', () => {
  it('asks for a description of every uploaded picture', () => {
    const image = { ...newBlock('image', []), picture: { kind: 'upload', file: 'site/a.png', alt: ' ' } } as Block;
    expect(problemsIn([image])[0]).toMatch(/describe the picture/);
  });
  it('flags a link that cannot be used', () => {
    const text = { ...newBlock('text', []), buttons: [{ label: 'Go', href: 'ftp://x', style: 'primary' }] } as Block;
    expect(problemsIn([text])[0]).toMatch(/can't be used/);
  });
  it('is quiet for the original page', () => {
    expect(problemsIn(defaultBlocks())).toEqual([]);
  });
});

import { sitePicturePath } from '../src/lib/sitePictures';
import { SITE_FILE } from '../src/lib/homePage';

describe('sitePicturePath', () => {
  it('makes a path the page will accept, even from an awkward name', () => {
    expect(SITE_FILE.test(sitePicturePath('My Photo (1).JPG', 1700000000000))).toBe(true);
    expect(SITE_FILE.test(sitePicturePath('ünï cödé.png', 5))).toBe(true);
  });
  it('keeps two uploads of the same name apart', () => {
    expect(sitePicturePath('a.png', 1000)).not.toBe(sitePicturePath('a.png', 2000));
  });
});
