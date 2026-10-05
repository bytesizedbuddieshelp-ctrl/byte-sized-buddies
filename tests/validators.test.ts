import { describe, expect, it } from 'vitest';
import { isValidEmail, lengthBetween, replySubject } from '../src/lib/validators';

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

describe('replySubject', () => {
  it('adds "Re:" once', () => {
    expect(replySubject('Visit next week', 'x')).toBe('Re: Visit next week');
    expect(replySubject('RE: Visit next week', 'x')).toBe('RE: Visit next week');
  });
  it('keeps the subject on one line and short', () => {
    expect(replySubject('Hello\r\nBcc: someone@example.com', 'x')).toBe('Re: Hello Bcc: someone@example.com');
    expect(replySubject('a'.repeat(500), 'x')).toHaveLength(200);
  });
  it('uses the fallback when there is no subject', () => {
    expect(replySubject('  ', 'Your message')).toBe('Re: Your message');
    expect(replySubject(null, 'Your message')).toBe('Re: Your message');
  });
});
