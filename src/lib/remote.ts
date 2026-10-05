// The phone remote (CLAUDE.md section 7.3). Pure logic: codes, message names, and checks.
// The presenter window and the phone talk over a private Supabase Realtime Broadcast channel named remote:<code>.

/** No I, L, or O, because they look like 1 and 0. Letters only, so a code is easy to read aloud. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

export function makeRemoteCode(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  // Throw away bytes that would make some letters likelier than others.
  const limit = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of random(new Uint8Array(16))) {
      if (byte < limit && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

/** Cleans up what someone typed. Returns null if it can't be a code. */
export function normalizeCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

export const topicFor = (code: string) => `remote:${code}`;
export const localChannelFor = (code: string) => `bsb-present-${code}`;

/** What the phone can ask the presenter to do. */
export type Command =
  | { t: 'next' }
  | { t: 'prev' }
  | { t: 'blank' }
  | { t: 'timer'; run: boolean }
  | { t: 'trytimer'; run: boolean }
  | { t: 'goto'; n: number };

export const EVENTS = {
  next: 'next',
  prev: 'prev',
  blank: 'blank',
  timerStart: 'timer:start',
  timerPause: 'timer:pause',
  tryStart: 'trytimer:start',
  tryPause: 'trytimer:pause',
  goto: 'goto',
  hello: 'hello',
  state: 'state',
  bye: 'bye',
} as const;

/** Turns a broadcast event into a command. Anything strange gives null and is ignored. */
export function parseCommand(event: string, payload: unknown, slideCount: number): Command | null {
  switch (event) {
    case EVENTS.next:
      return { t: 'next' };
    case EVENTS.prev:
      return { t: 'prev' };
    case EVENTS.blank:
      return { t: 'blank' };
    case EVENTS.timerStart:
      return { t: 'timer', run: true };
    case EVENTS.timerPause:
      return { t: 'timer', run: false };
    case EVENTS.tryStart:
      return { t: 'trytimer', run: true };
    case EVENTS.tryPause:
      return { t: 'trytimer', run: false };
    case EVENTS.goto: {
      const n = typeof payload === 'object' && payload !== null ? (payload as { n?: unknown }).n : undefined;
      return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < slideCount ? { t: 'goto', n } : null;
    }
    default:
      return null;
  }
}

export interface Clock {
  total: number;
  remaining: number;
  running: boolean;
}

/** The practice timer on a "Try it" slide. */
export interface TryTimer {
  minutes: number;
  remaining: number;
  running: boolean;
}

/** What the presenter tells the phone. */
export interface RemoteState {
  index: number;
  total: number;
  title: string;
  next: string | null;
  notes: string;
  blank: boolean;
  clock: Clock;
  /** Only when the current slide has a practice timer. */
  tryTimer: TryTimer | null;
}

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

export function parseState(payload: unknown): RemoteState | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const clock = p.clock as Record<string, unknown> | undefined;
  if (!whole(p.index) || !whole(p.total) || p.total < 1 || p.index < 0 || p.index >= p.total || typeof p.blank !== 'boolean') return null;
  if (!clock || !whole(clock.total) || !whole(clock.remaining) || typeof clock.running !== 'boolean') return null;
  const tt = p.tryTimer as Record<string, unknown> | null | undefined;
  const tryTimer: TryTimer | null =
    tt && whole(tt.minutes) && whole(tt.remaining) && typeof tt.running === 'boolean' ? { minutes: tt.minutes, remaining: tt.remaining, running: tt.running } : null;
  return {
    index: p.index,
    total: p.total,
    title: clip(p.title, 120),
    next: typeof p.next === 'string' ? clip(p.next, 120) : null,
    notes: clip(p.notes, 2000),
    blank: p.blank,
    clock: { total: clock.total, remaining: clock.remaining, running: clock.running },
    tryTimer,
  };
}

/** Time left, written as 44:05 (or -1:30 when over time). */
export function formatClock(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const s = Math.abs(seconds);
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const WARNING_SECONDS = 5 * 60;
export type ClockMood = 'fine' | 'warning' | 'over';
export function clockMood(remaining: number): ClockMood {
  return remaining <= 0 ? 'over' : remaining <= WARNING_SECONDS ? 'warning' : 'fine';
}

/** The phone shows a guess of the time left between messages, so the clock moves smoothly. */
export function clockNow(clock: Clock, receivedAtMs: number, nowMs: number): number {
  if (!clock.running) return clock.remaining;
  return clock.remaining - Math.floor((nowMs - receivedAtMs) / 1000);
}

// Messages between the presenter window and the audience window (same computer, BroadcastChannel).
export interface AudienceInit {
  type: 'init';
  slides: unknown;
  lessonName: string;
  images: Record<string, string>;
  index: number;
  blank: boolean;
  tryText: string | null;
}
export type LocalMessage =
  | AudienceInit
  | { type: 'update'; index: number; blank: boolean; tryText: string | null }
  | { type: 'hello' }
  | { type: 'bye' }
  | { type: 'cmd'; t: 'next' | 'prev' | 'blank' | 'first' | 'last' };
