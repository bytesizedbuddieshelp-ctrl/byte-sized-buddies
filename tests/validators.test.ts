import { describe, expect, it } from 'vitest';
import { isValidEmail, lengthBetween } from '../src/lib/validators';

describe('isValidEmail', () => {
  it('accepts normal emails', () => {
    expect(isValidEmail('maria@example.com')).toBe(true);
    expect(isValidEmail('  maria.lopez+bsb@mail.example.org ')).toBe(true);
  });
  it('rejects emails that are not finished', () => {
    for (const bad of ['', 'maria', 'maria@', '@example.com', 'maria@example', 'ma ria@example.com', 'a@b.c']) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});

describe('lengthBetween', () => {
  it('counts after trimming spaces', () => {
    expect(lengthBetween('  hi  ', 5, 10)).toBe('short');
    expect(lengthBetween('hello', 5, 10)).toBe('ok');
    expect(lengthBetween('x'.repeat(11), 5, 10)).toBe('long');
  });
});
