// Accessibility check for the built site (dist/). Run after `astro build`; `npm run check` does both.
//
// It serves dist/ on this computer, opens every public page in an invisible Chrome window, and:
//   * runs axe-core (WCAG 2.2 AA rules) and lists every problem it finds,
//   * checks that nothing scrolls sideways on a 320px-wide phone screen,
//   * lists buttons and form fields smaller than 48px (the brand's smallest tap target).
//
// Add --shots to also save screenshots at 320, 768, and 1280 pixels wide into test-results/.
// Add --verbose to print how many axe rules each page passed.
// It needs Google Chrome (or Chromium). Without it, the check is skipped with a message.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const shots = process.argv.includes('--shots');
const verbose = process.argv.includes('--verbose');

const PAGES = [
  '/',
  '/about',
  '/for-senior-homes',
  '/ask',
  '/lessons',
  '/lesson?slug=this-lesson-does-not-exist',
  '/answer?t=0000',
  '/teach',
  '/privacy',
  '/license',
  '/no-such-page',
  '/admin',
];
// The 768px (tablet) width is only loaded for screenshots; the checks run at 320 and 1280.
const WIDTHS = shots ? [320, 768, 1280] : [320, 1280];

const CHROMES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chromePath = CHROMES.find((p) => existsSync(p));
if (!chromePath) {
  console.log('Accessibility check skipped: Google Chrome was not found. Install Chrome, or set CHROME_PATH.');
  process.exit(0);
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error('Accessibility check: dist/ is empty. Run `npm run build` first.');
  process.exit(1);
}

// A tiny web server for dist/, with the same addresses as the live site (/about serves about.html).
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const tries = path === '/' ? ['/index.html'] : [path, `${path}.html`, join(path, 'index.html')];
  for (const t of tries) {
    const file = join(dist, t);
    if (file.startsWith(dist) && existsSync(file) && !file.endsWith('/')) {
      try {
        const body = readFileSync(file);
        res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
        return res.end(body);
      } catch {
        // a folder, not a file; keep looking
      }
    }
  }
  res.writeHead(404, { 'Content-Type': types['.html'] });
  res.end(readFileSync(join(dist, '404.html')));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// Start Chrome with its own throwaway profile, so the owner's browser and logins are never touched.
const profile = mkdtempSync(join(tmpdir(), 'bsb-a11y-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

function cleanup() {
  chrome.kill();
  server.close();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Chrome may still be closing; the system cleans temp folders later.
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let port = 0;
for (let i = 0; i < 100 && !port; i++) {
  await sleep(100);
  try {
    port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
  } catch {
    // not ready yet
  }
}
if (!port) {
  cleanup();
  console.error('Accessibility check: Chrome did not start.');
  process.exit(1);
}

// Talk to Chrome through its DevTools connection.
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let nextId = 1;
const waiting = new Map();
const listeners = new Set();
socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && waiting.has(msg.id)) {
    const { resolve, reject } = waiting.get(msg.id);
    waiting.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    listeners.forEach((fn) => fn(msg));
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

await send('Page.enable');
await send('Runtime.enable');

async function open(path, width) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
  const loaded = new Promise((resolve) => {
    const fn = (msg) => {
      if (msg.method === 'Page.loadEventFired') {
        listeners.delete(fn);
        resolve();
      }
    };
    listeners.add(fn);
  });
  await send('Page.navigate', { url: base + path });
  await Promise.race([loaded, sleep(15000)]);
  // Give the interactive parts (islands) time to start and to load lessons from the database.
  await sleep(2500);
}

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const problems = [];
const notes = [];
if (shots) mkdirSync(join(root, 'test-results'), { recursive: true });

try {
  for (const path of PAGES) {
    for (const width of WIDTHS) {
      await open(path, width);

      if (width === 1280 || width === 320) {
        await evaluate(axeSource);
        const found = await evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })
          .then(r => ({ passes: r.passes.length, title: document.title, violations: r.violations.map(v => ({ id: v.id, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ')) })) }))`);
        if (verbose) console.log(`${path} at ${width}px ("${found.title}"): ${found.passes} rules passed, ${found.violations.length} failed.`);
        for (const v of found.violations) problems.push(`${path} at ${width}px: ${v.help} (${v.id}) at ${v.nodes.join(', ')}`);
      }

      if (width === 320) {
        const wide = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
        if (wide > 1) problems.push(`${path} at 320px: the page scrolls sideways by ${wide}px.`);
        const small = await evaluate(`[...document.querySelectorAll('button, input:not([type=hidden]), select, textarea, a.button, [role=button]')]
          .filter(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
            return r.width > 0 && s.visibility !== 'hidden' && !el.closest('.hp, .skip-link') && el.type !== 'checkbox' && el.type !== 'radio' && (r.height < 47.5 || r.width < 47.5); })
          .map(el => (el.textContent.trim() || el.getAttribute('aria-label') || el.name || el.tagName).slice(0, 40) + ' (' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height) + ')')`);
        for (const s of small) notes.push(`${path} at 320px: small tap target: ${s}`);
      }

      if (shots) {
        const { cssContentSize } = await send('Page.getLayoutMetrics');
        const height = Math.min(Math.ceil(cssContentSize.height), 8000);
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
        const name = (path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home') + `-${width}.png`;
        writeFileSync(join(root, 'test-results', name), Buffer.from(data, 'base64'));
      }
    }
  }
} finally {
  socket.close();
  cleanup();
}

if (notes.length) console.log(`Things to look at:\n- ${notes.join('\n- ')}`);
if (problems.length) {
  console.error(`Accessibility check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Accessibility check passed: ${PAGES.length} pages at ${WIDTHS.join(', ')}px.${shots ? ' Screenshots are in test-results/.' : ''}`);
