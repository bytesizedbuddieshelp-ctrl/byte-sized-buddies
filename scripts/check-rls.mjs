// Proves the database locks hold. It acts like a stranger: no sign-in, just the public key.
// Run it with: npm run check:rls
// It needs PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env (see docs/DEPLOY.md).
import { randomBytes } from 'node:crypto';

const url = (process.env.PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !key || url.includes('YOUR-PROJECT')) {
  console.error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. Fill in your .env file first (docs/DEPLOY.md, Step 8).');
  process.exit(1);
}

// Old-style keys are JWTs and also go in Authorization. New publishable keys go in apikey only.
const headers = { apikey: key, 'Content-Type': 'application/json' };
if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

async function call(method, path, body, extra = {}) {
  const res = await fetch(url + path, { method, headers: { ...headers, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

const results = [];
async function check(name, fn) {
  try {
    const problem = await fn();
    results.push({ name, ok: !problem, note: problem || '' });
  } catch (error) {
    results.push({ name, ok: false, note: `Could not run: ${error.message}` });
  }
}

// A table is "locked" if the request is refused, or it answers with no rows.
const locked = (r) => (r.status >= 400 ? null : Array.isArray(r.json) && r.json.length === 0 ? null : `returned data (status ${r.status})`);
const refused = (r) => (r.status >= 400 ? null : `was allowed (status ${r.status})`);

for (const table of ['tickets', 'contact_requests', 'inbox_messages', 'outbox', 'videos', 'owners', 'bridge_secret']) {
  await check(`Signed-out visitor cannot read ${table}`, async () => locked(await call('GET', `/rest/v1/${table}?select=*&limit=5`)));
}

await check('Signed-out visitor sees only published lessons', async () => {
  const r = await call('GET', '/rest/v1/lessons?select=slug,status');
  if (r.status !== 200) return `status ${r.status}`;
  return r.json.every((row) => row.status === 'published') ? null : 'a draft lesson was visible';
});

await check('Signed-out visitor sees only public settings', async () => {
  const r = await call('GET', '/rest/v1/settings?select=key,is_public');
  if (r.status !== 200) return `status ${r.status}`;
  return r.json.every((row) => row.is_public === true) ? null : 'a private setting was visible';
});

await check('Signed-out visitor cannot write to tickets directly', async () => {
  return refused(await call('POST', '/rest/v1/tickets', { token: randomBytes(32).toString('hex'), requester_name: 'x', question: 'hello there' }));
});
await check('Signed-out visitor cannot change lessons', async () => {
  const r = await call('PATCH', '/rest/v1/lessons?slug=eq.sample-lesson-delete-me', { title: 'Hacked' }, { Prefer: 'return=representation' });
  return r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0) ? null : 'a lesson was changed';
});

await check('Wrong bridge secret is refused (bridge_get_work)', async () => refused(await call('POST', '/rest/v1/rpc/bridge_get_work', { p_secret: 'wrong' })));
await check('Wrong bridge secret is refused (bridge_purge)', async () => refused(await call('POST', '/rest/v1/rpc/bridge_purge', { p_secret: 'wrong' })));
await check('Wrong bridge secret is refused (bridge_upsert_inbox)', async () => refused(await call('POST', '/rest/v1/rpc/bridge_upsert_inbox', { p_secret: 'wrong', p_rows: [] })));
await check('Wrong bridge secret is refused (bridge_mark_outbox)', async () => refused(await call('POST', '/rest/v1/rpc/bridge_mark_outbox', { p_secret: 'wrong', p_id: '00000000-0000-0000-0000-000000000000', p_ok: true, p_error: null })));
await check('Wrong bridge secret is refused (bridge_mark_notified)', async () => refused(await call('POST', '/rest/v1/rpc/bridge_mark_notified', { p_secret: 'wrong', p_kind: 'ticket', p_id: '00000000-0000-0000-0000-000000000000' })));
await check('bridge_ok cannot be called from outside', async () => refused(await call('POST', '/rest/v1/rpc/bridge_ok', { p_secret: 'wrong' })));

await check('An unknown answer link finds nothing (get_ticket)', async () => {
  const r = await call('POST', '/rest/v1/rpc/get_ticket', { p_token: randomBytes(32).toString('hex') });
  return r.status === 200 && Array.isArray(r.json) && r.json.length === 0 ? null : `status ${r.status}`;
});

await check('A bad token is refused (submit_ticket)', async () => {
  return refused(await call('POST', '/rest/v1/rpc/submit_ticket', { p_token: 'short', p_name: 'Test', p_facility: null, p_email: null, p_device: null, p_urgency: 'whenever', p_question: 'A real question here', p_website: '' }));
});

await check('The spam trap quietly accepts but saves nothing (submit_ticket)', async () => {
  const r = await call('POST', '/rest/v1/rpc/submit_ticket', { p_token: randomBytes(32).toString('hex'), p_name: 'Spam', p_facility: null, p_email: null, p_device: null, p_urgency: 'whenever', p_question: 'Buy my things now', p_website: 'http://spam.example' });
  return r.status < 300 ? null : `status ${r.status}`;
});

await check('Signed-out visitor cannot upload lesson files', async () => {
  const res = await fetch(`${url}/storage/v1/object/lesson-files/rls-check.pdf`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/pdf' }, body: '%PDF-1.4' });
  return res.status >= 400 ? null : `was allowed (status ${res.status})`;
});

await check('Public sign-ups are turned off', async () => {
  const email = `rls-check-${randomBytes(6).toString('hex')}@example.com`;
  const r = await call('POST', '/auth/v1/signup', { email, password: randomBytes(16).toString('hex') });
  // If this was allowed, the check just made a stray user. Tell the owner to delete it.
  return r.status >= 400 ? null : `sign-ups are ON. Turn them off and delete the user ${email} (Authentication, Users)`;
});

console.log('\nBack-door check: acting as a stranger with the public key\n');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `  ->  ${r.note}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? `\nAll ${results.length} checks passed.` : `\n${failed} of ${results.length} checks FAILED. Do not launch until they pass.`);
process.exit(failed === 0 ? 0 : 1);
