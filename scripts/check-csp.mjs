// Checks the built site (dist/) against the security rules, after `astro build`:
//   * every page has a Content Security Policy,
//   * every inline script on a page is allowed by that page's policy (by its fingerprint),
//   * no inline event handlers (onclick="..."), which a policy would block,
//   * public/_headers is in the build.
// Run by `npm run check`. Plain words on failure, so it is clear what to fix.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const problems = [];

function pages(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

const files = pages(dist);
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const short = file.slice(dist.length);
  const meta = html.match(/<meta http-equiv="content-security-policy" content="([^"]*)"/i);
  if (!meta) {
    problems.push(`${short}: has no Content Security Policy.`);
    continue;
  }
  const policy = meta[1];
  for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc=/.test(attrs) || !body.trim()) continue;
    const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
    if (!policy.includes(hash)) problems.push(`${short}: an inline script is not allowed by the policy (${hash}).`);
  }
  const handler = html.match(/<[^>]+\son[a-z]+="/i);
  if (handler) problems.push(`${short}: has an inline event handler (${handler[0].slice(0, 60)}...). Use addEventListener instead.`);
}

if (!existsSync(join(dist, '_headers'))) problems.push('dist/_headers is missing. It should be copied from public/_headers.');

if (problems.length) {
  console.error(`Security policy check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Security policy check passed: ${files.length} pages.`);
