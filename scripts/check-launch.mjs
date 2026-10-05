// Lists what still needs filling in before launch: [PLACEHOLDERS] in the site's words and pages.
// Run: npm run check:launch. It changes nothing. See docs/LAUNCH-CHECKLIST.md for the full list.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const found = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(astro|tsx?|md|json|html|webmanifest)$/.test(name)) {
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/\[(YOUR [A-Z ]+|REVIEW BEFORE LAUNCH)\]/g)) found.push(`${relative(root, path)}:${i + 1}  ${m[0]}`);
      });
    }
  }
}
walk(join(root, 'src'));
walk(join(root, 'public'));

if (found.length) {
  console.log(`Still to fill in before launch (${found.length}):\n  ${found.join('\n  ')}\n\nThe rest of the launch list is in docs/LAUNCH-CHECKLIST.md.`);
  process.exit(1);
}
console.log('No placeholders left. Finish the rest of docs/LAUNCH-CHECKLIST.md.');
