import type { APIRoute } from 'astro';

// Tells search engines to skip the private pages. Adds the sitemap once PUBLIC_SITE_URL is set.
export const GET: APIRoute = ({ site }) => {
  const lines = ['User-agent: *', 'Disallow: /admin/', 'Disallow: /answer'];
  if (site) lines.push('', `Sitemap: ${new URL('/sitemap.xml', site).href}`);
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
