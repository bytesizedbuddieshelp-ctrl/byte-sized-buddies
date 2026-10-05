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
| `wrangler.jsonc` | Tells Cloudflare to publish the finished site from the `dist` folder. |

## Run it on your computer

You need [Node.js](https://nodejs.org) version 22.12 or newer.

1. Open a terminal in this folder.
2. Run `npm install`. It downloads the tools the site needs into `node_modules`.
3. Run `npm run dev`. It starts a preview at <http://localhost:4321>.
4. While it runs, <http://localhost:4321/styleguide> shows every component. That page only exists on your computer. It never goes online.
5. Press `Ctrl+C` in the terminal to stop it.

## Check your work

Run `npm run check`. It does two things:

1. Looks through `src/` for banned words, such as the ones that make people feel they are the problem.
2. Builds the site, to make sure nothing is broken.

Run it before every commit.

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
| `/lessons` | Lesson library (a "first lessons are on the way" card until Phase 3) |
| `/teach` | "Teach it yourself" (words live in `src/content/teach-it-yourself.md`) |
| `/about` | About (write your story in `src/content/about.md`) |
| `/privacy`, `/license` | Plain-language privacy and license pages |

Both forms check what people type, but they do not send anything yet. They connect to the database in Phase 2.

## Secrets

Copy `.env.example` to `.env` when the database arrives in Phase 2. Never commit `.env`. Never put the Supabase `service_role` key anywhere in this project.

## License

Lessons are shared under CC BY-SA 4.0. The name and logo are not part of that license.
