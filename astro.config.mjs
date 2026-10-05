import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import preact from '@astrojs/preact';

// PUBLIC_SITE_URL is the full web address of the site, for example https://example.com
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const site = process.env.PUBLIC_SITE_URL || env.PUBLIC_SITE_URL || undefined;

// Adds a /styleguide page while you work on your computer (npm run dev).
// It is never part of the real website: the build leaves it out.
const devStyleguide = {
  name: 'dev-styleguide',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command === 'dev') {
        injectRoute({ pattern: '/styleguide', entrypoint: './src/dev/styleguide.astro' });
      }
    },
  },
};

export default defineConfig({
  site,
  output: 'static',
  // /about is served from about.html, so Cloudflare does not redirect it to /about/.
  build: { format: 'file' },
  trailingSlash: 'never',
  integrations: [preact(), devStyleguide],
});
