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
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: options.allowImages ? ['style'] : ['style', 'img', 'picture', 'source'],
    FORBID_ATTR: ['style'],
  });
}
