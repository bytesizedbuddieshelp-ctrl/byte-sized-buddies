// Byte-Sized Buddies copy checker.
// Scans src/ and content/ for words our voice rules ban (CLAUDE.md section 2.5).
// Comments are ignored. Run it with: npm run check
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BANNED = [
  'easy',
  'easily',
  'simple',
  'simply',
  'just',
  'obviously',
  'basically',
  'elderly',
  'seniors',
  'tech illiterate',
];

const SCAN_DIRS = ['src', 'content'];
const SCAN_EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.md', '.mdx', '.html', '.json', '.txt']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.git']);

// Replace comments with spaces (keeping line breaks) so line numbers stay right.
function blank(match) {
  return match.replace(/[^\n]/g, ' ');
}

export function stripComments(text, ext) {
  let out = text.replace(/<!--[\s\S]*?-->/g, blank);
  if (ext !== '.md' && ext !== '.mdx' && ext !== '.html') {
    out = out.replace(/\/\*[\s\S]*?\*\//g, blank);
    // A line comment starts at the beginning of a line or after a space, so "https://" is safe.
    out = out.replace(/(^|\s)\/\/.*$/gm, blank);
  }
  return out;
}

// Whole words only. A match stuck to "-", "_", "$" or a dot before it is a code name, not a sentence.
const pattern = new RegExp(`(?<![\\w$.-])(${BANNED.join('|')})(?![\\w$-])`, 'gi');

export function findBanned(text, ext = '.md') {
  const clean = stripComments(text, ext);
  const lines = clean.split('\n');
  const found = [];
  lines.forEach((line, index) => {
    for (const match of line.matchAll(pattern)) {
      found.push({ word: match[1], line: index + 1, column: match.index + 1, text: line.trim() });
    }
  });
  return found;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
    } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
      yield join(dir, entry.name);
    }
  }
}

function main() {
  let problems = 0;
  let files = 0;
  for (const dir of SCAN_DIRS) {
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      files += 1;
      const hits = findBanned(readFileSync(file, 'utf8'), extname(file));
      for (const hit of hits) {
        problems += 1;
        console.error(`${file}:${hit.line}:${hit.column}  banned word "${hit.word}"  ->  ${hit.text}`);
      }
    }
  }
  if (problems > 0) {
    console.error(`\nCopy check failed: ${problems} banned word(s). See "Voice" in CLAUDE.md section 2.5.`);
    process.exit(1);
  }
  console.log(`Copy check passed: ${files} files, no banned words.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
