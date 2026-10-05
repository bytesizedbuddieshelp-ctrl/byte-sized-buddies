import { describe, expect, it } from 'vitest';
import { crc32, makeZip } from '../src/lib/zip';

describe('crc32', () => {
  it('matches the known value for "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('makeZip', () => {
  it('writes entries a zip reader can find, with correct sizes and checks', () => {
    const files = [
      { name: 'kit.json', data: new TextEncoder().encode('{"kit_version":1}') },
      { name: 'files/handout.pdf', data: new TextEncoder().encode('%PDF-1.4 hello') },
      { name: 'empty.txt', data: new Uint8Array(0) },
    ];
    const zip = makeZip(files, new Date(2026, 9, 5, 12, 30, 10));
    const view = new DataView(zip.buffer);
    // end record
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(3);
    // walk the central directory and compare with the files
    let at = view.getUint32(end + 16, true);
    const decoder = new TextDecoder();
    for (const file of files) {
      expect(view.getUint32(at, true)).toBe(0x02014b50);
      const crc = view.getUint32(at + 16, true);
      const size = view.getUint32(at + 24, true);
      const nameLength = view.getUint16(at + 28, true);
      const localAt = view.getUint32(at + 42, true);
      expect(decoder.decode(zip.slice(at + 46, at + 46 + nameLength))).toBe(file.name);
      expect(size).toBe(file.data.length);
      expect(crc).toBe(crc32(file.data));
      // the local header points at the same bytes
      expect(view.getUint32(localAt, true)).toBe(0x04034b50);
      const dataAt = localAt + 30 + view.getUint16(localAt + 26, true);
      expect(Array.from(zip.slice(dataAt, dataAt + size))).toEqual(Array.from(file.data));
      at += 46 + nameLength;
    }
  });
});
