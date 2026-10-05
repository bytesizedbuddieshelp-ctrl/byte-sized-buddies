import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { classifyFile, validateKit } from '../src/lib/kit';

// The sample kit in docs/sample-kit is what the owner imports to test the lesson tools. It must always be valid.
const dir = join(__dirname, '..', 'docs', 'sample-kit');

describe('docs/sample-kit', () => {
  const files = readdirSync(dir)
    .filter((name) => name !== 'kit.json' && name !== 'README.md')
    .map((name) => {
      const bytes = readFileSync(join(dir, name));
      return classifyFile(name, statSync(join(dir, name)).size, new Uint8Array(bytes.subarray(0, 16)));
    });
  const kit = JSON.parse(readFileSync(join(dir, 'kit.json'), 'utf8'));

  it('passes the importer with no errors and no warnings', () => {
    const result = validateKit(kit, files);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.summary).toBe('Week 1: Calling a friend. 5 slides, 1 worksheet, 1 handout. No warnings.');
  });

  it('has real files: two PDFs of one page each, and two PNG pictures', () => {
    const kinds = Object.fromEntries(files.map((f) => [f.name, f.kind]));
    expect(kinds).toEqual({ 'contacts.png': 'png', 'phone-home.png': 'png', 'week-01-handout.pdf': 'pdf', 'week-01-worksheet.pdf': 'pdf' });
    for (const pdf of ['week-01-handout.pdf', 'week-01-worksheet.pdf']) {
      const text = readFileSync(join(dir, pdf)).toString('latin1');
      expect((text.match(/\/Type\s*\/Page[^s]/g) ?? []).length, pdf).toBe(1);
    }
  });

  it('fails if a named file is missing', () => {
    const result = validateKit(kit, files.filter((f) => f.name !== 'week-01-handout.pdf'));
    expect(result.errors.join()).toContain('week-01-handout.pdf');
  });
});
