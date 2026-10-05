import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Turns markdown into safe HTML. Everything goes through DOMPurify before it reaches the page.
// Images are off by default: an answer should not be able to load pictures from other websites.
let hooked = false;

export function renderMarkdown(markdown: string, options: { allowImages?: boolean } = {}): string {
  if (!hooked) {
    // Links open safely and never pass on where the reader came from.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('href')) {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    hooked = true;
  }
  const html = marked.parse(markdown ?? '', { async: false, gfm: true, breaks: false }) as string;
  // No forms or other embedded things either: nothing in an answer should be able to ask for a password
  // or load another page. Videos are added separately by youtube.ts.
  const blocked = ['style', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'svg', 'math'];
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: options.allowImages ? blocked : [...blocked, 'img', 'picture', 'source'],
    FORBID_ATTR: ['style'],
  });
}
