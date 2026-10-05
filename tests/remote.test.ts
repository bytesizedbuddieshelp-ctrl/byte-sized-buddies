import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, clockMood, countdownLeft, clockNow, formatClock, makeRemoteCode, normalizeCode, parseCommand, parseState, topicFor } from '../src/lib/remote';

describe('makeRemoteCode', () => {
  it('makes four letters with no I, L, or O', () => {
    for (let i = 0; i < 500; i++) expect(makeRemoteCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(CODE_ALPHABET).not.toMatch(/[ILO0-9]/);
  });
  it('makes different codes each time', () => {
    expect(new Set(Array.from({ length: 300 }, () => makeRemoteCode())).size).toBeGreaterThan(250);
  });
  it('does not favor some letters (bytes that would bias are skipped)', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) for (const c of makeRemoteCode()) counts[c] = (counts[c] ?? 0) + 1;
    const values = Object.values(counts);
    expect(Math.min(...values) / Math.max(...values)).toBeGreaterThan(0.8);
  });
  it('skips random bytes that are too high', () => {
    // 253 and up would make A, B, C more likely, so they must be skipped.
    let calls = 0;
    const code = makeRemoteCode((b) => { calls++; return b.fill(calls === 1 ? 255 : 3); });
    expect(code).toBe('DDDD');
    expect(calls).toBe(2);
  });
});

describe('normalizeCode', () => {
  it('accepts a code however it was typed', () => {
    expect(normalizeCode('kfpd')).toBe('KFPD');
    expect(normalizeCode(' K F-P D ')).toBe('KFPD');
  });
  it('refuses codes that cannot exist', () => {
    for (const bad of ['', 'ABC', 'ABCDE', 'ABCI', 'ABCL', 'ABCO', 'AB12']) expect(normalizeCode(bad), bad).toBeNull();
  });
});

describe('parseCommand', () => {
  it('reads each message from the phone', () => {
    expect(parseCommand('next', {}, 5)).toEqual({ t: 'next' });
    expect(parseCommand('prev', undefined, 5)).toEqual({ t: 'prev' });
    expect(parseCommand('blank', null, 5)).toEqual({ t: 'blank' });
    expect(parseCommand('timer:start', {}, 5)).toEqual({ t: 'timer', run: true });
    expect(parseCommand('timer:pause', {}, 5)).toEqual({ t: 'timer', run: false });
    expect(parseCommand('trytimer:start', {}, 5)).toEqual({ t: 'trytimer', run: true });
    expect(parseCommand('trytimer:pause', {}, 5)).toEqual({ t: 'trytimer', run: false });
    expect(parseCommand('goto', { n: 2 }, 5)).toEqual({ t: 'goto', n: 2 });
  });
  it('ignores anything strange', () => {
    for (const [event, payload] of [['goto', { n: 5 }], ['goto', { n: -1 }], ['goto', { n: 1.5 }], ['goto', { n: '2' }], ['goto', null], ['explode', {}], ['', {}]] as const) {
      expect(parseCommand(event, payload, 5), event + JSON.stringify(payload)).toBeNull();
    }
  });
});

describe('parseState', () => {
  const good = { index: 1, total: 5, title: 'Tap Contacts', next: 'Try it', notes: 'Go slowly.', blank: false, clock: { total: 2700, remaining: 2650, running: true }, tryTimer: null };
  it('accepts a good state', () => expect(parseState(good)).toEqual(good));
  it('reads a practice timer, and ignores a broken one', () => {
    const tryTimer = { minutes: 5, remaining: 290, running: true };
    expect(parseState({ ...good, tryTimer })!.tryTimer).toEqual(tryTimer);
    expect(parseState({ ...good, tryTimer: { minutes: '5' } })!.tryTimer).toBeNull();
    expect(parseState({ ...good, tryTimer: undefined })!.tryTimer).toBeNull();
  });
  it('cuts long text', () => {
    const state = parseState({ ...good, title: 'x'.repeat(500), notes: 'y'.repeat(5000) })!;
    expect(state.title).toHaveLength(120);
    expect(state.notes).toHaveLength(2000);
  });
  it('refuses broken states', () => {
    for (const bad of [null, 'x', {}, { ...good, index: 5 }, { ...good, index: -1 }, { ...good, total: 0 }, { ...good, blank: 'no' }, { ...good, clock: null }, { ...good, clock: { total: 1, remaining: '2', running: true } }]) {
      expect(parseState(bad)).toBeNull();
    }
  });
});

describe('clock helpers', () => {
  it('writes minutes and seconds', () => {
    expect(formatClock(2700)).toBe('45:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-90)).toBe('-1:30');
  });
  it('warns with five minutes left, and says when time is over', () => {
    expect(clockMood(2700)).toBe('fine');
    expect(clockMood(301)).toBe('fine');
    expect(clockMood(300)).toBe('warning');
    expect(clockMood(1)).toBe('warning');
    expect(clockMood(0)).toBe('over');
    expect(clockMood(-5)).toBe('over');
  });
  it('guesses the time left between messages', () => {
    expect(clockNow({ total: 100, remaining: 50, running: true }, 1000, 4500)).toBe(47);
    expect(clockNow({ total: 100, remaining: 50, running: false }, 1000, 9000)).toBe(50);
  });
});

describe('countdownLeft', () => {
  it('stands still when stopped', () => expect(countdownLeft(300, null, 99999)).toBe(300));
  it('counts real seconds from when it started, however late the ticks are', () => {
    expect(countdownLeft(300, 1000, 1000)).toBe(300);
    expect(countdownLeft(300, 1000, 1999)).toBe(300);
    expect(countdownLeft(300, 1000, 2000)).toBe(299);
    expect(countdownLeft(300, 1000, 61000)).toBe(240); // a throttled tab that only ticked once a minute is still right
  });
  it('never runs backwards if the clock is odd', () => expect(countdownLeft(300, 5000, 4000)).toBe(300));
  it('can go below zero', () => expect(countdownLeft(10, 0, 15000)).toBe(-5));
});

it('names the private channel after the code', () => expect(topicFor('KFPD')).toBe('remote:KFPD'));
