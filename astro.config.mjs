import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

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
  output: 'static',
  integrations: [preact(), devStyleguide],
});
