import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { supabaseUrl } from './config';

// Turns markdown into safe HTML. Everything goes through DOMPurify before it reaches the page.
// Images are off by default: an answer should not be able to load pictures from other websites.
let hooked = false;

// Pictures are allowed only when they come from our own lesson-files storage, never from other websites.
const ownImages = () => `${supabaseUrl}/storage/v1/object/public/lesson-files/`;

export function renderMarkdown(markdown: string, options: { allowImages?: boolean; demoteHeadings?: boolean } = {}): string {
  if (!hooked) {
    // Links open safely and never pass on where the reader came from.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('href')) {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    // Pictures: only our own lesson-files storage. This runs after the attributes are cleaned, so it sees
    // the final result. Other ways to load a picture (srcset, lazy-load tricks) are removed outright.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName !== 'IMG') return;
      for (const name of ['srcset', 'sizes', 'lowsrc', 'dynsrc', 'longdesc', 'ping']) node.removeAttribute(name);
      const src = node.getAttribute('src') ?? '';
      if (!supabaseUrl || !src.startsWith(ownImages())) node.parentNode?.removeChild(node);
    });
    hooked = true;
  }
  const html = marked.parse(markdown ?? '', { async: false, gfm: true, breaks: false }) as string;
  // No forms or other embedded things either: nothing in an answer should be able to ask for a password
  // or load another page. Videos are added separately by youtube.ts.
  const blocked = ['style', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'svg', 'math'];
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: options.allowImages ? [...blocked, 'picture', 'source'] : [...blocked, 'img', 'picture', 'source'],
    FORBID_ATTR: ['style', 'srcset', 'sizes'],
  });
  // Text inside a page should not start a new top-level heading: h1 becomes h2, h2 becomes h3, and so on.
  return options.demoteHeadings ? clean.replace(/<(\/?)h([1-5])(?=[\s>])/g, (_, slash, n) => `<${slash}h${Number(n) + 1}`) : clean;
}
