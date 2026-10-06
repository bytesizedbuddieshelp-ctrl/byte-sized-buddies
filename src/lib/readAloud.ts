// Helpers for the "Read this aloud" button. The browser's own voice does the reading, on this device.

/** Splits text into pieces a browser voice can read without stopping early (some voices cut off after about 15 seconds). */
export function splitForSpeech(text: string, maxLength = 220): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = (clean.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [clean]).map((x) => x.trim()).filter(Boolean);
  const pieces: string[] = [];
  let current = '';
  const push = () => {
    if (current.trim()) pieces.push(current.trim());
    current = '';
  };
  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      push();
      // A very long sentence is cut at spaces.
      let rest = sentence.trim();
      while (rest.length > maxLength) {
        const cut = rest.lastIndexOf(' ', maxLength);
        const at = cut > 40 ? cut : maxLength;
        pieces.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest;
      continue;
    }
    if ((current + ' ' + sentence).trim().length > maxLength) push();
    current = `${current} ${sentence}`.trim();
  }
  push();
  return pieces;
}

/** The words a reader would hear for an element: headings and text, without buttons, pictures, or hidden parts. */
export function speakableText(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll('script, style, svg, img, button, input, select, textarea, [hidden], [aria-hidden="true"], .no-read').forEach((node) => node.remove());
  // A pause after each heading, paragraph, and list item makes the voice sound natural.
  clone.querySelectorAll('h1, h2, h3, h4, p, li').forEach((node) => {
    if (!/[.!?:]$/.test((node.textContent ?? '').trim())) node.append('.');
  });
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}
