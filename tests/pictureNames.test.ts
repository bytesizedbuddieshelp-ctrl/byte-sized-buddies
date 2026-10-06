import { describe, expect, it } from 'vitest';
import { matchKey, matchPictures, safeFileName } from '../src/lib/pictureNames';
import { FILE_NAME } from '../src/lib/kit';

describe('picture names', () => {
  it('cleans names the website would refuse', () => {
    const mac = safeFileName('Screenshot 2026-10-05 at 3.45.12 PM.png');
    expect(mac).toBe('Screenshot-2026-10-05-at-3.45.12-PM.png');
    expect(FILE_NAME.test(mac)).toBe(true);
    expect(safeFileName('café photo (1).JPG')).toBe('cafe-photo-1.jpg');
    expect(safeFileName('  .png')).toBe('picture.png');
  });

  it('treats case, extension, and separators as the same name', () => {
    expect(matchKey('Contacts.PNG')).toBe(matchKey('contacts.jpg'));
    expect(matchKey('contacts_screen.png')).toBe(matchKey('contacts-screen.webp'));
    expect(matchKey('Contacts Screen.png')).toBe('contacts-screen');
  });

  it('gives each slide its picture, and reports what is left over', () => {
    const r = matchPictures(['phone-home.png', 'contacts.png', 'call.png'], ['Phone_Home.jpg', 'contacts.png', 'extra.png']);
    expect(r.found).toEqual({ 'phone-home.png': 'Phone_Home.jpg', 'contacts.png': 'contacts.png' });
    expect(r.missing).toEqual(['call.png']);
    expect(r.unused).toEqual(['extra.png']);
  });

  it('never guesses between two look-alike pictures', () => {
    const r = matchPictures(['contacts.png'], ['Contacts.jpg', 'contacts.webp']);
    expect(r.missing).toEqual(['contacts.png']);
  });
});
