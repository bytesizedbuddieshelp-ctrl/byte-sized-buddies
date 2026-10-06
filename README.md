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
| `apps-script/` | The Gmail bridge: `Code.gs` runs in your Google account; `README.md` shows how to install it. |
| `scripts/make-bridge-secret.mjs` | Makes the Gmail bridge secret (`npm run bridge:secret`, in your own Terminal). |
| `supabase/` | The database: `schema.sql` builds it, `seed.sql` adds starter data. |
| `docs/` | `ADMIN-GUIDE.md` (your weekly routine), `TEACHING-GUIDE.md` (running a visit), `LAUNCH-CHECKLIST.md`, `LIMITS.md` (free-plan limits), `DEPLOY.md` (setup steps), `SECURITY.md` (the rules and how to test them), `KIT-FORMAT.md` (the lesson kit format), and `sample-kit/` (a kit to try). |
| `scripts/check-csp.mjs`, `scripts/check-a11y.mjs` | Check the built site's security policy and accessibility (part of `npm run check`). |
| `src/components/illustrations/` | The flat brand pictures on the public pages (devices, slides, handouts). Colors come from the brand tokens. |
| `scripts/screenshots.mjs` | Full-page screenshots with Playwright (`npm run screenshots`). |
| `scripts/admin-screenshots.mjs` | Screenshots and an accessibility check of the admin pages, signed in with a pretend session and made-up sample data, without touching the real database (`npm run screenshots:admin`). |
| `scripts/check-launch.mjs` | Lists placeholders still to fill in before launch (`npm run check:launch`). |
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

Run `npm run check`. It does five things:

1. Looks through `src/` for banned words, such as the ones that make people feel they are the problem.
2. Runs the small automatic tests (`npm test` runs only these).
3. Builds the site, to make sure nothing is broken.
4. Checks every page's security policy covers its scripts.
5. Opens every public page in an invisible Chrome window and runs an accessibility check (axe), at phone and laptop widths. It is skipped if Chrome isn't installed.

`npm run screenshots` builds the site and uses Playwright (with WebKit, the engine inside Safari) to save full-page pictures of every public page at 390, 768, 1280, 1440, and 1920 pixels wide in `test-results/` (not saved to git). Choose widths with `npm run screenshots -- 1440 390`.

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
| `/admin/studio` | The video studio: record an opener, a screen demo, and a closer, then attach the YouTube links to a lesson or an answer |
| `/admin/present`, `/admin/remote` | Presenter mode (two windows) and the phone remote (needs `docs/DEPLOY.md` Step 12) |
| `/admin` | Owner sign-in. Then `/admin/dashboard`, `/admin/tickets`, `/admin/inbox` (Contact exchange: Gmail emails and senior-home requests), and `/admin/lessons` |

## Email

The website never touches Gmail directly. A small script in your Google account (the Gmail bridge) copies emails labeled **BSB** to the website and sends the emails the website queues. Set it up with `apps-script/README.md`.

## Lessons

Make a lesson kit in a Claude chat (see `docs/KIT-FORMAT.md`), then import it in **Admin, Lessons, Import a kit**. It saves as a **draft**. Check it with **Preview**, then press **Publish**. To try it first, import the sample kit in `docs/sample-kit/`.

## Videos

Open **Admin, Studio** in Chrome or Edge on a computer.

1. Choose the lesson. Its video script shows on the teleprompter.
2. Turn on the camera and microphone. Check the sound level says "Good".
3. Record the opener (camera), the main part (your screen), and the closer (camera). You hear three beeps before each recording starts. Play each take back, and download the ones you keep.
4. Upload the files to YouTube yourself (Unlisted or Public, "not made for kids"). Paste the links in **Publish**, choose the lesson or question, and press **Save video**.

**No green screen needed:** sit in front of a plain wall, open **Background** under the camera preview, choose **Replace my wall**, and click the wall in the preview. Pick Garden, Forest, plain cream, or your own picture. **Download this background** saves it as a picture too.

**Drawing:** when you record the main part, keep **Let me draw on the recording** ticked. As soon as you start sharing your screen, a **drawing tab** opens by itself, showing your screen with the tools. Switch to it (click the tab, or Ctrl+Tab) and draw on your screen with the pen, highlighter, arrow, or circle. It shows in the video. Switch back to your app to keep going, and press **Stop recording** in either tab. (Chrome must allow pop-ups for the site. If it doesn't, press **Open drawing tab** in the studio and choose "Always allow pop-ups".) Lines fade away after 3 seconds (you can turn that off). Keys: P pen, H highlighter, A arrow, C circle, 1 to 3 for colors, Z undo, X clear. Share a window, not your whole screen.

Record your opener and closer once, tick **Make this my standard opener** (or closer), and reuse them next time. Video answers to questions play your standard opener and closer around the answer.

Takes are kept only in the open page. Download them before you close it. Videos are never stored in Supabase.

## The database

Everything the forms and the admin area save lives in Supabase. Follow `docs/DEPLOY.md` to set it up. The whole database is in `supabase/schema.sql`. Until you do, both forms say "isn't connected yet" and nothing breaks.

## Secrets

Copy `.env.example` to `.env` and fill it in (`docs/DEPLOY.md`, Step 8). Never commit `.env`. Never put the Supabase `service_role` or secret key anywhere in this project. Only the public key goes here.

## License

Lessons are shared under CC BY-SA 4.0. The name and logo are not part of that license.
