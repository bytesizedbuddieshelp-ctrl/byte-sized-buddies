import type { APIRoute } from 'astro';

// Public pages only. Lesson pages join the list in Phase 3.
const paths = ['/', '/lessons', '/for-senior-homes', '/ask', '/teach', '/about', '/privacy', '/license'];

export const GET: APIRoute = ({ site }) => {
  // Sitemaps need full web addresses. Until PUBLIC_SITE_URL is set, the list stays empty.
  const urls = site ? paths.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`) : [];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
