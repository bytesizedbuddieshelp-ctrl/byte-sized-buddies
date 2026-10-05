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
  // Content Security Policy: a list of where the browser may load things from. Astro adds it to every
  // page as a <meta> tag, with fingerprints (hashes) of its own small scripts made fresh on every build.
  // public/_headers adds the rules a <meta> tag can't hold (for example, no other site may frame ours).
  // If you add a new outside service, it must be listed here, or the browser will block it.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "img-src 'self' data: blob: https://*.supabase.co",
        "media-src 'self' blob:",
        "frame-src https://www.youtube-nocookie.com",
        "font-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      // YouTube's player controller loads only after a visitor presses Play on a video.
      scriptDirective: { resources: ["'self'", 'https://www.youtube.com'] },
      // Preact sets a few sizes as inline styles (slide scaling, progress bars), so inline styles stay allowed.
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
});
