// Full-page screenshots of every public page, with Playwright and the Chrome on this computer.
// Run: npm run screenshots   (it builds first). Pictures go to test-results/ (not saved to git).
// Add widths as arguments to choose them, for example: npm run screenshots -- 1440 390
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const out = join(root, 'test-results');
const widths = process.argv.slice(2).map(Number).filter(Boolean);
const WIDTHS = widths.length ? widths : [390, 768, 1280, 1440, 1920];
const PAGES = ['/', '/about', '/for-senior-homes', '/ask', '/lessons', '/lesson?slug=this-lesson-does-not-exist', '/answer?t=0000', '/teach', '/privacy', '/license', '/no-such-page', '/admin'];

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const t of path === '/' ? ['/index.html'] : [path, `${path}.html`]) {
    const file = join(dist, t);
    if (file.startsWith(dist) && existsSync(file)) {
      try {
        const body = readFileSync(file);
        res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
        return res.end(body);
      } catch {
        // a folder; keep looking
      }
    }
  }
  res.writeHead(404, { 'Content-Type': types['.html'] });
  res.end(readFileSync(join(dist, '404.html')));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const path of PAGES) {
      await page.goto(base + path, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(800);
      const name = (path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home') + `-${width}.png`;
      await page.screenshot({ path: join(out, name), fullPage: true });
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`Saved ${PAGES.length * WIDTHS.length} screenshots in test-results/ (${WIDTHS.join(', ')}px).`);
