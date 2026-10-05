# Byte-Sized Buddies website

Free, patient, hands-on technology lessons for older adults, and free materials for anyone who wants to teach them.

**Learn it. Try it. Keep it.**

This folder holds the website. It is built with [Astro](https://astro.build) and hosted free on Cloudflare.

## What is where

| Folder or file | What it is |
|---|---|
| `CLAUDE.md` | The full plan for the site. Claude Code reads it every session. |
| `brand/` | The brand book: colors, fonts, logos, and the words we use. Do not edit it. |
| `src/pages/` | One file per page. `index.astro` is the home page. |
| `src/components/` | Reusable pieces: header, footer, buttons, cards, form fields. |
| `src/layouts/Base.astro` | The frame every page sits in (skip link, header, footer). |
| `src/content/copy.ts` | Words that appear on every page, kept in one place. |
| `src/styles/global.css` | Base styles. It loads the brand colors from `brand/tokens.css`. |
| `public/` | Files served as they are: logos and the browser tab icon. |
| `scripts/check-copy.mjs` | Looks for banned words (see "Voice" in `CLAUDE.md`). |
| `scripts/check-rls.mjs` | Tests the database locks as a stranger (`npm run check:rls`). |
| `supabase/` | The database: `schema.sql` builds it, `seed.sql` adds starter data. |
| `docs/` | `DEPLOY.md` (setup steps), `SECURITY.md` (the rules and how to test them), `KIT-FORMAT.md` (the lesson kit format), and `sample-kit/` (a kit to try). |
| `tests/` | Small automatic tests for the helper code. |
| `wrangler.jsonc` | Tells Cloudflare to publish the finished site from the `dist` folder. |

## Run it on your computer

You need [Node.js](https://nodejs.org) version 22.12 or newer.

1. Open a terminal in this folder.
2. Run `npm install`. It downloads the tools the site needs into `node_modules`.
3. Run `npm run dev`. It starts a preview at <http://localhost:4321>.
4. While it runs, <http://localhost:4321/styleguide> shows every component. That page only exists on your computer. It never goes online.
5. Press `Ctrl+C` in the terminal to stop it.

## Check your work

Run `npm run check`. It does three things:

1. Looks through `src/` for banned words, such as the ones that make people feel they are the problem.
2. Runs the small automatic tests (`npm test` runs just these).
3. Builds the site, to make sure nothing is broken.

Run it before every commit.

Run `npm run check:rls` after you set up the database. It acts like a stranger on the internet and proves the database locks work. See `docs/SECURITY.md`.

## Put it online

Cloudflare is connected to the GitHub repository. When you push to the `main` branch, Cloudflare builds the site and publishes it. You do not need to click anything.

## Your site address (PUBLIC_SITE_URL)

Link previews and the sitemap need the full web address of your site, such as `https://byte-sized-buddies.your-name.workers.dev`. Until you set it, the site works but leaves out the sitemap entries and the preview image address.

To set it on Cloudflare: open your project, go to **Settings**, find **Variables and secrets** (build section), add `PUBLIC_SITE_URL` with your address, and save. Then push any change, or retry the build.

## Pages

| Address | What it is |
|---|---|
| `/` | Landing page |
| `/for-senior-homes` | How a visit works, and the "Request a visit" form |
| `/ask` | The "Ask a question" form |
| `/lessons` | The free lesson library, with filters and search |
| `/lesson?slug=...` | One lesson: downloads, a slide preview, videos, and the teacher guide |
| `/teach` | "Teach it yourself" (words live in `src/content/teach-it-yourself.md`) |
| `/about` | About (write your story in `src/content/about.md`) |
| `/privacy`, `/license` | Plain-language privacy and license pages |
| `/answer?t=...` | The private page where someone reads the answer to their question |
| `/admin/present`, `/admin/remote` | Presenter mode (two windows) and the phone remote (needs `docs/DEPLOY.md` Step 12) |
| `/admin` | Owner sign-in. Then `/admin/dashboard`, `/admin/tickets`, `/admin/inbox`, and `/admin/lessons` |

## Lessons

Make a lesson kit in a Claude chat (see `docs/KIT-FORMAT.md`), then import it in **Admin, Lessons, Import a kit**. It saves as a **draft**. Check it with **Preview**, then press **Publish**. To try it first, import the sample kit in `docs/sample-kit/`.

## The database

Everything the forms and the admin area save lives in Supabase. Follow `docs/DEPLOY.md` to set it up. The whole database is in `supabase/schema.sql`. Until you do, both forms say "isn't connected yet" and nothing breaks.

## Secrets

Copy `.env.example` to `.env` and fill it in (`docs/DEPLOY.md`, Step 8). Never commit `.env`. Never put the Supabase `service_role` or secret key anywhere in this project. Only the public key goes here.

## License

Lessons are shared under CC BY-SA 4.0. The name and logo are not part of that license.
