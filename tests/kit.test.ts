import { describe, expect, it } from 'vitest';
import { classifyFile, validateKit, type KitFileInfo } from '../src/lib/kit';

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)].slice(0, 16));
const pdf = (name: string, size = 1000): KitFileInfo => classifyFile(name, size, new TextEncoder().encode('%PDF-1.4 abcdefgh'));
const png = (name: string): KitFileInfo => classifyFile(name, 500, bytes(0x89, 0x50, 0x4e, 0x47));

const slides = {
  version: 1,
  slides: [
    { layout: 'title', title: 'Calling a friend', subtitle: 'Week 1' },
    { layout: 'step', step: 1, title: 'Tap Contacts', body: ['Find the person icon.'], image: { file: 'contacts.png', alt: 'The contacts screen' } },
  ],
};
const kit = (over: Record<string, unknown> = {}) => ({
  kit_version: 1,
  lesson: { slug: 'week-01-calling-a-friend', week_number: 1, title: 'Calling a friend', summary: 'Make a call.', topic: 'Phone calls', devices: ['iphone', 'android'], level: 'beginner', duration_minutes: 45, objectives: ['Open Contacts'], license: 'CC BY-SA 4.0' },
  slides,
  teacher_guide_md: '# Guide',
  video_script_md: '',
  files: { worksheet: 'w.pdf', handout: 'h.pdf', answer_key: null, teacher_guide_pdf: null },
  images: ['contacts.png'],
  ...over,
});
const goodFiles = () => [pdf('w.pdf'), pdf('h.pdf'), png('contacts.png')];

describe('classifyFile', () => {
  it('trusts the first bytes, not the name', () => {
    expect(classifyFile('x.pdf', 10, new TextEncoder().encode('MZ not a pdf!!!!')).problem).toContain("isn't a real PDF");
    expect(classifyFile('x.png', 10, bytes(1, 2, 3)).problem).toContain("isn't a real PNG");
    expect(classifyFile('x.jpg', 10, bytes(0xff, 0xd8, 0xff, 0xe0)).problem).toBeUndefined();
    expect(classifyFile('x.webp', 10, new TextEncoder().encode('RIFF1234WEBPVP8 ')).problem).toBeUndefined();
  });
  it('rejects odd names, types, and sizes', () => {
    expect(classifyFile('my file.pdf', 10, new TextEncoder().encode('%PDF-1')).problem).toContain("isn't allowed");
    expect(classifyFile('run.exe', 10, bytes()).problem).toContain('not a type we accept');
    expect(classifyFile('big.pdf', 11 * 1024 * 1024, new TextEncoder().encode('%PDF-1')).problem).toContain('10 MB');
  });
  it('refuses pictures that carry code', () => {
    expect(classifyFile('a.svg', 50, bytes(), '<svg xmlns="x"><circle/></svg>').problem).toBeUndefined();
    expect(classifyFile('a.svg', 50, bytes(), '<svg onload="x()"></svg>').problem).toContain('event handler');
    expect(classifyFile('a.svg', 50, bytes(), '<svg><script>x</script></svg>').problem).toContain('code or embedded content');
    expect(classifyFile('a.svg', 50, bytes(), 'hello').problem).toContain("isn't a real SVG");
  });
  it('refuses the sneaky ways to hide code in a picture', () => {
    const sneaky = [
      '<svg/onload=alert(1)></svg>',
      '<svg xmlns="x"><circle/onclick="x()"/></svg>',
      '<svg"onload="x()"></svg>',
      '<svg><a href="https://tracker.example/x"><circle/></a></svg>',
      '<svg><a xlink:href="java&#115;cript:x()"><circle/></a></svg>',
      '<svg><a href="javascript:x()"><circle/></a></svg>',
      '<svg><a href="jav\tascript:x()"><circle/></a></svg>',
      '<svg><image href="data:image/png;base64,AAAA"/></svg>',
      '<svg><style>@import url(https://tracker.example/a.css);</style></svg>',
      '<svg><rect style="fill:url(https://tracker.example/a)"/></svg>',
      '<!DOCTYPE svg [<!ENTITY x "boom">]><svg>&x;</svg>',
      '<svg><foreignObject><div/></foreignObject></svg>',
      '<svg><SCRIPT>x()</SCRIPT></svg>',
    ];
    for (const text of sneaky) expect(classifyFile('a.svg', 80, bytes(), text).problem, text).toBeTruthy();
  });
  it('still accepts an ordinary drawing, including links inside the file', () => {
    const fine = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><use href="#a"/><rect fill="url(#g)" width="5" height="5"/></svg>';
    expect(classifyFile('ok.svg', 80, bytes(), fine).problem).toBeUndefined();
  });
});

describe('validateKit', () => {
  it('accepts a good kit and writes a friendly summary', () => {
    const r = validateKit(kit(), goodFiles());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.summary).toBe('Week 1: Calling a friend. 2 slides, 1 worksheet, 1 handout. No warnings.');
    expect(r.lesson?.files).toEqual({ worksheet: 'w.pdf', handout: 'h.pdf' });
  });

  it('needs every named file to be dropped in', () => {
    const r = validateKit(kit(), [pdf('w.pdf'), png('contacts.png')]);
    expect(r.errors.join('\n')).toContain('"h.pdf"');
    expect(r.lesson).toBeNull();
  });

  it('needs a slide image to be in the images list and the files', () => {
    expect(validateKit(kit({ images: [] }), goodFiles()).errors.join()).toContain('"contacts.png", but it isn\'t in the kit\'s "images" list');
    const missing = validateKit(kit(), [pdf('w.pdf'), pdf('h.pdf')]).errors;
    expect(missing.join()).toContain('lists the image "contacts.png"');
    expect(missing.join()).not.toContain("isn't in the kit's");
  });

  it('turns slide problems into errors that name the slide', () => {
    const bad = { version: 1, slides: [{ layout: 'idea', title: 'x', body: ['ok'] }, { layout: 'step', title: 'No number' }] };
    expect(validateKit(kit({ slides: bad }), goodFiles()).errors.join()).toContain('Slide 2');
  });

  it('warns about missing handout, missing worksheet, and big PDFs', () => {
    const r = validateKit(kit({ files: { worksheet: null, handout: null } }), [png('contacts.png')]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toContain('no handout');
    expect(r.warnings.join('\n')).toContain('no worksheet');
    expect(r.summary).toContain('0 worksheets, 0 handouts. 2 warnings.');
    const big = validateKit(kit(), [pdf('w.pdf', 6 * 1024 * 1024), pdf('h.pdf'), png('contacts.png')]);
    expect(big.warnings.join()).toContain('over 5 MB');
  });

  it('checks the lesson details', () => {
    const lesson = (o: Record<string, unknown>) => ({ ...(kit().lesson as object), ...o });
    for (const [name, change] of [
      ['slug', { slug: 'Has Spaces' }],
      ['week', { week_number: 0 }],
      ['title', { title: '' }],
      ['devices', { devices: ['windows'] }],
      ['level', { level: 'expert' }],
      ['duration', { duration_minutes: 2 }],
    ] as const) {
      expect(validateKit(kit({ lesson: lesson(change) }), goodFiles()).errors.length, name).toBeGreaterThan(0);
    }
  });

  it('refuses things that are not a kit', () => {
    expect(validateKit(null, []).errors).toHaveLength(1);
    expect(validateKit({ kit_version: 2 }, []).errors.join()).toContain('kit_version');
    expect(validateKit({ kit_version: 1 }, []).errors.join()).toContain('"lesson"');
  });

  it('reports a bad file even if the kit is fine', () => {
    const fake = classifyFile('h.pdf', 10, new TextEncoder().encode('not a pdf at all!'));
    expect(validateKit(kit(), [pdf('w.pdf'), fake, png('contacts.png')]).errors.join()).toContain("isn't a real PDF");
  });

  it('accepts extra worksheets and counts them in the summary', () => {
    const extras = [{ file: 'x1.pdf', title: 'Extra practice: Favorites' }, { file: 'x2.pdf', title: 'Puzzle' }];
    const r = validateKit(kit({ extras }), [...goodFiles(), pdf('x1.pdf'), pdf('x2.pdf')]);
    expect(r.errors).toEqual([]);
    expect(r.lesson?.extras).toEqual(extras);
    expect(r.summary).toContain('2 extra worksheets');
    expect(validateKit(kit(), goodFiles()).lesson?.extras).toEqual([]);
  });

  it('checks extra worksheets: present, a PDF, titled, not reused, not too many', () => {
    const errs = (extras: unknown, files = [...goodFiles(), pdf('x1.pdf')]) => validateKit(kit({ extras }), files).errors.join(' ');
    expect(errs([{ file: 'missing.pdf', title: 'A' }])).toContain("wasn't selected");
    expect(errs([{ file: 'contacts.png', title: 'A' }], goodFiles())).toContain('should be a PDF');
    expect(errs([{ file: 'x1.pdf' }])).toContain('needs a "file"');
    expect(errs([{ file: 'x1.pdf', title: 'x'.repeat(81) }])).toContain('80 characters');
    expect(errs([{ file: 'w.pdf', title: 'Again' }])).toContain('used twice');
    expect(errs('x1.pdf')).toContain('"extras" should be a list');
    expect(errs(Array.from({ length: 11 }, () => ({ file: 'x1.pdf', title: 'A' })))).toContain('up to 10');
  });
});
