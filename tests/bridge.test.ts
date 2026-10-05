import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Runs apps-script/Code.gs here, with pretend Gmail and database stand-ins, so the
// bridge's choices can be tested without touching real email.
const source = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');

interface FakeMessage {
  id: string;
  from: string;
  replies: string[];
}

function message(id: string, from: string): FakeMessage {
  return { id, from, replies: [] };
}

function load({ threads = [] as { id: string; messages: FakeMessage[] }[], quota = 100, work = {} as Record<string, unknown> } = {}) {
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  const sent: { to: string; subject: string }[] = [];
  const cache = new Map<string, string>();
  const props: Record<string, string> = {
    SUPABASE_URL: 'https://example.supabase.co/',
    SUPABASE_ANON_KEY: 'anon',
    BRIDGE_SECRET: 'secret',
    OWNER_EMAIL: 'Owner@Example.com',
    SITE_URL: 'https://site.example',
  };
  const gmailThread = (t: { id: string; messages: FakeMessage[] }) => ({
    getId: () => t.id,
    getMessages: () =>
      t.messages.map((m) => ({
        getId: () => m.id,
        getFrom: () => m.from,
        getSubject: () => 'Hello',
        getPlainBody: () => 'Body text',
        getDate: () => new Date('2026-10-01T12:00:00Z'),
        reply: (body: string) => m.replies.push(body),
      })),
  });
  const context = {
    console: { log: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null }) },
    UrlFetchApp: {
      fetch: (url: string, options: { payload: string }) => {
        const fn = url.split('/rpc/')[1];
        calls.push({ fn, body: JSON.parse(options.payload) });
        const reply = fn === 'bridge_get_work' ? JSON.stringify(work) : '';
        return { getResponseCode: () => 200, getContentText: () => reply };
      },
    },
    CacheService: {
      getScriptCache: () => ({
        getAll: (keys: string[]) => Object.fromEntries(keys.filter((k) => cache.has(k)).map((k) => [k, cache.get(k)])),
        putAll: (values: Record<string, string>) => Object.entries(values).forEach(([k, v]) => cache.set(k, v)),
      }),
    },
    GmailApp: {
      search: () => threads.map(gmailThread),
      getThreadById: (id: string) => {
        const t = threads.find((x) => x.id === id);
        return t ? gmailThread(t) : null;
      },
      sendEmail: (to: string, subject: string) => sent.push({ to, subject }),
    },
    MailApp: { getRemainingDailyQuota: () => quota },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { bridge: context as unknown as Record<string, (...args: unknown[]) => unknown>, calls, sent, cache };
}

describe('Gmail bridge', () => {
  it('reads sender names and addresses', () => {
    const { bridge } = load();
    expect(bridge.parseFrom_('"Ana Lee" <ana@example.com>')).toEqual({ name: 'Ana Lee', email: 'ana@example.com' });
    expect(bridge.parseFrom_('ana@example.com')).toEqual({ name: 'ana@example.com', email: 'ana@example.com' });
  });

  it("replies to the other person's latest message, even when the owner wrote last", () => {
    const ana1 = message('m1', 'Ana <ana@example.com>');
    const ana2 = message('m2', 'Ana <ana@example.com>');
    const mine = message('m3', 'Me <owner@example.com>');
    const { bridge } = load({ threads: [{ id: 't1', messages: [ana1, ana2, mine] }] });
    bridge.replyInThread_('t1', 'Thanks', 'owner@example.com');
    expect(ana2.replies).toEqual(['Thanks']);
    expect(mine.replies).toEqual([]);
  });

  it('gives a plain reason when the conversation is gone', () => {
    const { bridge } = load();
    expect(() => bridge.replyInThread_('missing', 'Hi', 'owner@example.com')).toThrow(/not found/);
  });

  it("copies other people's emails, skips the owner's, and does not re-read copied ones", () => {
    const threads = [{ id: 't1', messages: [message('m1', 'Ana <ana@example.com>'), message('m2', 'owner@example.com')] }];
    const { bridge, calls } = load({ threads });
    expect(bridge.pushInbox_('newer_than:7d')).toBe(1);
    const rows = calls[0].body.p_rows as { gmail_message_id: string; from_email: string }[];
    expect(rows.map((r) => r.gmail_message_id)).toEqual(['m1']);
    expect(calls[0].body.p_secret).toBe('secret');
    expect(bridge.pushInbox_('newer_than:7d')).toBe(0);
  });

  it('stops sending before Gmail runs out for the day', () => {
    const outbox = Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, kind: 'ticket_received', to_email: `p${i}@example.com`, subject: 'Hi', body_text: 'x' }));
    const { bridge, sent, calls } = load({ quota: 8, work: { outbox } });
    bridge.processWork_();
    expect(sent).toHaveLength(3); // 8 left today, minus a reserve of 5
    expect(calls.filter((c) => c.fn === 'bridge_mark_outbox')).toHaveLength(3);
  });

  it('marks a bad email as an error instead of sending it', () => {
    const outbox = [{ id: 'o1', kind: 'reply', to_email: 'a@example.com\nBcc: x@example.com', subject: 'Hi', body_text: 'x' }];
    const { bridge, sent, calls } = load({ work: { outbox } });
    bridge.processWork_();
    expect(sent).toHaveLength(0);
    expect(calls.find((c) => c.fn === 'bridge_mark_outbox')?.body).toMatchObject({ p_id: 'o1', p_ok: false });
  });

  it('tells the owner about new questions with a link to the tickets page', () => {
    const work = { notify_tickets: [{ id: 'k1', requester_name: 'Sam', question: 'How do I zoom?' }] };
    const { bridge, sent, calls } = load({ work });
    bridge.processWork_();
    expect(sent).toEqual([{ to: 'owner@example.com', subject: 'New question from Sam' }]);
    expect(calls.find((c) => c.fn === 'bridge_mark_notified')?.body).toMatchObject({ p_kind: 'ticket', p_id: 'k1' });
  });
});
