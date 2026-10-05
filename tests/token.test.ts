import { describe, expect, it } from 'vitest';
import { makeToken } from '../src/lib/token';

describe('makeToken', () => {
  it('makes 64 lowercase hex characters (256 bits)', () => {
    expect(makeToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('makes a different token each time', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => makeToken()));
    expect(tokens.size).toBe(200);
  });

  it('pads small bytes with a zero', () => {
    expect(makeToken((b) => b.fill(1))).toBe('01'.repeat(32));
  });
});
