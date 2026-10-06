// Full-page screenshots of the admin pages, without signing in to the real database.
// Run: npm run screenshots:admin   (it builds first). Pictures go to test-results/admin-*.png.
//
// How: Playwright opens the built site in your Chrome, puts a pretend signed-in session in that test browser,
// and answers every database request itself with made-up sample data (below). Nothing reaches your real
// Supabase project, and the sample data is never part of the website.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const out = join(root, 'test-results');
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  console.log('Admin screenshots skipped: PUBLIC_SUPABASE_URL is not set in .env (the pages need it to start).');
  process.exit(0);
}
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const widths = process.argv.slice(2).map(Number).filter(Boolean);
const WIDTHS = widths.length ? widths : [1440, 390];
const PAGES = [
  '/admin/dashboard',
  '/admin/tickets',
  '/admin/tickets#open',
  '/admin/inbox',
  '/admin/inbox#requests',
  '/admin/lessons',
  '/admin/lesson-edit?slug=week-01-calling-a-friend',
  '/admin/present',
  '/admin/remote',
  '/admin/studio',
];

// ---- Made-up sample data (clearly fake) --------------------------------------------------------
const ago = (hours) => new Date(Date.now() - hours * 3600_000).toISOString();
const kit = JSON.parse(readFileSync(join(root, 'docs/sample-kit/kit.json'), 'utf8'));
const data = {
  tickets: [
    { id: 't1', token: 'a'.repeat(64), created_at: ago(2), status: 'new', requester_name: 'Sample Person A', facility: 'Sample Gardens', requester_email: 'a@example.com', device: 'iphone', urgency: 'this_week', question: 'How do I make the text on my phone bigger? It is hard to read the messages from my grandson.', internal_notes: null, answer_md: null, answer_video_youtube_id: null, answered_at: null },
    { id: 't2', token: 'b'.repeat(64), created_at: ago(26), status: 'new', requester_name: 'Sample Person B', facility: null, requester_email: null, device: 'tablet', urgency: 'whenever', question: 'A box popped up asking me to update. Is it safe to press it?', internal_notes: null, answer_md: null, answer_video_youtube_id: null, answered_at: null },
    { id: 't3', token: 'c'.repeat(64), created_at: ago(50), status: 'in_progress', requester_name: 'Sample Person C', facility: 'Sample Court', requester_email: 'c@example.com', device: 'android', urgency: 'before_next_visit', question: 'How do I send a photo to my daughter?', internal_notes: 'Show the share button next visit.', answer_md: 'Open **Photos**, tap the picture, then tap **Share**.', answer_video_youtube_id: null, answered_at: null },
    { id: 't4', token: 'd'.repeat(64), created_at: ago(120), status: 'answered', requester_name: 'Sample Person D', facility: 'Sample Gardens', requester_email: 'd@example.com', device: 'computer', urgency: 'whenever', question: 'How do I join a video call?', internal_notes: null, answer_md: 'Click the link in the email, then **Join**.', answer_video_youtube_id: null, answered_at: ago(100) },
  ],
  contact_requests: [
    { id: 'r1', created_at: ago(5), status: 'new', contact_name: 'Sample Staff A', facility: 'Sample Gardens', role: 'Activity director', email: 'staff-a@example.com', phone: null, learner_count: 'About 10', devices: ['iphone', 'tablet'], preferred_times: 'Tuesday afternoons', message: 'Our residents would love help with video calls.', internal_notes: null },
    { id: 'r2', created_at: ago(72), status: 'replied', contact_name: 'Sample Staff B', facility: 'Sample Court', role: 'Coordinator', email: 'staff-b@example.com', phone: '555-0100', learner_count: '6', devices: ['android'], preferred_times: 'Mornings', message: null, internal_notes: 'Visit planned.' },
  ],
  inbox_messages: [
    { id: 'm1', gmail_message_id: 'g1', gmail_thread_id: 'th1', from_name: 'Sample Sender A', from_email: 'sender-a@example.com', subject: 'Re: We got your question', body_text: 'Thank you so much. The bigger text worked.\n\nSee you next week.', received_at: ago(3), is_read: false, handled: false },
    { id: 'm2', gmail_message_id: 'g2', gmail_thread_id: 'th2', from_name: 'Sample Sender B', from_email: 'sender-b@example.com', subject: 'Question about next visit', body_text: 'Could we move the visit to Thursday?', received_at: ago(30), is_read: true, handled: false },
  ],
  outbox: [
    { id: 'o1', kind: 'reply', to_email: 'sender-b@example.com', subject: 'Re: Question about next visit', body_text: 'Thursday works. See you then.', gmail_thread_id: 'th2', status: 'sent', error: null, created_at: ago(20), sent_at: ago(19) },
  ],
  lessons: [
    { id: 'l1', slug: kit.lesson.slug, week_number: kit.lesson.week_number, title: kit.lesson.title, summary: kit.lesson.summary, topic: kit.lesson.topic, devices: kit.lesson.devices, level: kit.lesson.level, duration_minutes: 45, objectives: kit.lesson.objectives, slides: kit.slides, teacher_guide_md: kit.teacher_guide_md, video_script_md: kit.video_script_md, files: {}, video_ids: [], license: 'CC BY-SA 4.0', status: 'published', published_at: ago(48), created_at: ago(200), updated_at: ago(48) },
    { id: 'l2', slug: 'week-02-sample-draft', week_number: 2, title: 'Sample draft lesson', summary: 'A draft for the screenshots.', topic: 'Photos', devices: ['any'], level: 'beginner', duration_minutes: 45, objectives: [], slides: { version: 1, slides: [] }, teacher_guide_md: null, video_script_md: null, files: {}, video_ids: [], license: 'CC BY-SA 4.0', status: 'draft', published_at: null, created_at: ago(30), updated_at: ago(2) },
  ],
  videos: [],
  settings: [],
};

// A tiny filter for the database's query words (status=eq.new, status=in.(a,b)).
function filterRows(rows, params) {
  return rows.filter((row) =>
    [...params].every(([key, value]) => {
      if (['select', 'order', 'limit', 'offset'].includes(key)) return true;
      const [op, ...rest] = value.split('.');
      const want = rest.join('.');
      if (op === 'eq') return String(row[key]) === want;
      if (op === 'in') return want.replace(/^\(|\)$/g, '').split(',').includes(String(row[key]));
      if (op === 'is') return row[key] === null;
      return true;
    }),
  );
}

// ---- A pretend session for the test browser ----------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'owner@example.com', app_metadata: {}, user_metadata: {}, created_at: ago(1000) };
const session = { access_token: `${b64({ alg: 'none' })}.${b64({ sub: user.id, exp, role: 'authenticated', aal: 'aal1' })}.x`, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'pretend', user };

// ---- Serve dist/ ---------------------------------------------------------------------------------
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
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
        // a folder
      }
    }
  }
  res.writeHead(404);
  res.end('not found');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

mkdirSync(out, { recursive: true });
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const problems = [];
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const width of WIDTHS) {
    // bypassCSP lets the test tool add axe to the page. It applies to this test browser only, never to the website.
    const context = await browser.newContext({ viewport: { width, height: 900 }, bypassCSP: true });
    await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [`sb-${projectRef}-auth-token`, JSON.stringify(session)]);
    // Every request to the database is answered here, with the sample data.
    await context.route(/supabase\.co/, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      // The page is on a different address than the database, so answers must allow it to read them (CORS).
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
      const json = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { ...cors, ...headers }, body: JSON.stringify(body) });
      if (url.pathname.startsWith('/auth/')) return json(url.pathname.includes('/user') ? user : session);
      if (url.pathname.endsWith('/rpc/is_owner')) return json(true);
      if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null);
      const table = url.pathname.replace('/rest/v1/', '');
      if (url.pathname.startsWith('/storage/')) return json([]);
      if (!(table in data)) return json([]);
      if (req.method() !== 'GET' && req.method() !== 'HEAD') return json([], 201);
      const rows = filterRows(data[table], url.searchParams);
      const range = { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` };
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...cors, ...range }, body: '' });
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return json(single ? rows[0] ?? null : rows, 200, range);
    });
    const page = await context.newPage();
    for (const path of PAGES) {
      await page.goto(base + path.replace(/#.*$/, ''), { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1200);
      // "#open" opens the first item in the list, to show the detail view.
      if (path.endsWith('#open')) await page.locator('.admin-row').first().click().catch(() => {});
      if (path.endsWith('#requests')) await page.getByRole('button', { name: /Senior-home requests/ }).click().catch(() => {});
      await page.waitForTimeout(800);
      // Accessibility check (WCAG 2.2 AA) on each admin page, with the sample data showing.
      await page.addScriptTag({ path: axePath });
      const found = await page.evaluate(() =>
        window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((v) => `${v.help} (${v.id}) at ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`)),
      );
      for (const f of found) problems.push(`${path} at ${width}px: ${f}`);
      const name = 'admin-' + (path.replace(/^\/admin\/?/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'login') + `-${width}.png`;
      await page.screenshot({ path: join(out, name), fullPage: true });
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (problems.length) {
  console.error(`Admin accessibility problems:\n- ${[...new Set(problems)].join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Admin accessibility check passed.');
}
console.log(`Saved ${PAGES.length * WIDTHS.length} admin screenshots in test-results/ (${WIDTHS.join(', ')}px). Sample data only.`);
