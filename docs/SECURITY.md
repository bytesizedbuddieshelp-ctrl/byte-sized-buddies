# Security notes

This is the plain-language version of section 11 of `CLAUDE.md`, with how to test each rule.
For the threat model, see `.claude/claude-security-guidance.md`.

## The idea

The website is only files. All the protection lives in the database. Every table uses **row-level security** (RLS), which means the database itself decides who may read or change each row. Hiding a page is never security.

## What a stranger can and cannot do

| A signed-out visitor can | A signed-out visitor cannot |
|---|---|
| Read **published** lessons | Read draft lessons |
| Read **public** settings (site address, opener and closer videos) | Read private settings |
| Send a question (`submit_ticket`) | Read, list, or change any ticket |
| Send a visit request (`submit_contact_request`) | Read or change any visit request |
| Read **one** answer, if they hold its private token (`get_ticket`) | Read the inbox, the outbox, owners, or the bridge secret |
| | Upload, change, or delete lesson files |
| | Create an account (sign-ups are off) |
| | Call the Gmail bridge functions without the secret |

## Test it: the automatic check

```
npm run check:rls
```

It sends requests the way a stranger could, using only the public key from `.env`, and prints `PASS` or `FAIL` for each rule. Run it after every database change, and before launch.

If the **sign-ups** line fails, the script created a stray user. Delete it in Supabase under **Authentication**, **Users**, and turn sign-ups off.

## Test it: by hand, as a stranger

1. Open a **private window** on your live site. Do not sign in.
2. Open the browser console and look for failed requests while you use the Ask page. You should see only calls to `rpc/submit_ticket` and nothing that reads tickets.
3. Go to `/admin/tickets`. You should be sent to the sign-in page.
4. Go to `/answer?t=abc`. You should see "We can't find that link".

## Test it: as the owner

1. Sign in at `/admin`. Tickets and visit requests should load.
2. Open `/answer?t=` with the private link of an answered ticket. You should see the answer.
3. Save a **draft** answer and open the private link. The draft must **not** appear until you press **Send answer**.
4. Sign out. Go back to `/admin/tickets`. You should be sent to the sign-in page.

## The rules, and where they live

| Rule | Where it is enforced |
|---|---|
| RLS on every table | `supabase/schema.sql` (each table has `enable row level security`) |
| Strangers use only guarded functions | `supabase/schema.sql` (each function revokes access first, then grants only what is needed) |
| Sign-ups off | Supabase dashboard (`docs/DEPLOY.md`, Step 2) and checked by `npm run check:rls` |
| No `service_role` key | Never in this repository. Only the public key is used, in `.env` and in Cloudflare build variables |
| Markdown is cleaned before it shows | `src/lib/markdown.ts` uses DOMPurify |
| YouTube videos | `src/lib/youtube.ts` accepts only an 11-character ID and builds a `youtube-nocookie.com` address. The playlist player (`src/components/video/PlaylistPlayer.tsx`) skips any ID that doesn't pass, and loads nothing from YouTube until the visitor presses Play |
| Studio recordings | Recordings stay in the owner's browser until downloaded. They are never uploaded to Supabase. Only YouTube IDs are saved (`videos`, `lessons.video_ids`, `tickets.answer_video_youtube_id`, and the public `opener_video` and `closer_video` settings) |
| Private tokens | Made in the browser with `crypto.getRandomValues` (64 hex characters). The answer page is `noindex` |
| Drafts stay private (lessons) | The database only lets strangers read lessons with `status = 'published'`. Unpublish a lesson and it disappears for everyone but you |
| Uploaded files | Only the owner may upload. `src/lib/kit.ts` checks the first bytes of every file, so a renamed file is refused. SVG pictures with scripts, event handlers, or links to other websites are refused. The bucket also limits file types and size (10 MB) |
| Pictures in teacher guides | `src/lib/markdown.ts` keeps a picture only if it comes from our own `lesson-files` storage. Other websites cannot load anything through a guide |
| Draft answers stay private | `get_ticket` returns the answer only after the ticket has been answered |
| Spam | A hidden `website` field, and no more than 20 new tickets or requests per hour |
| Gmail bridge secret | Lives only in Apps Script (Script Properties). The database stores only its SHA-256 fingerprint in `bridge_secret`, which nobody can read through the API. Every `bridge_*` function checks it first and answers "not allowed" otherwise |
| Gmail stays private | The bridge copies only emails with the **BSB** label, skips your own sent mail, and cuts each email to 8,000 characters. Emails show as plain text, never as web code |
| Email headers | The database refuses line breaks in an email's address or subject, and the bridge checks again before sending, so nobody can sneak in extra recipients |
| Email misuse | Anyone can type any email address into a form. The database queues at most 30 confirmation emails an hour in total and 3 a day to one inbox (`name+tag@` counts as `name@`), so the forms cannot be used to flood a stranger |

## Safe habits

- Never paste a key, password, or token into a chat or a commit.
- `.env` is private. `.env.example` has fake placeholders only.
- If a secret key ever leaks, reset it in the Supabase dashboard and tell a parent or guardian.
- Run `npm audit` now and then.

## The Gmail bridge

- The bridge secret never leaves Script Properties. Only its fingerprint is in the database, and it is only ever compared inside the database (`bridge_ok`).
- The `service_role` key is never used, not even by the bridge. It uses the public key plus the secret.
- Make a new secret with `npm run bridge:secret`, in your own Terminal, never in a chat.
- If the secret leaks, run `npm run bridge:secret` again, save the new fingerprint in the SQL Editor, and replace `BRIDGE_SECRET` in Script Properties. The old secret stops working right away. Full steps: `apps-script/README.md`, "If the secret leaks".
- Test it: `npm run check:rls` calls the bridge with a wrong secret and expects "not allowed".

## Security headers

- **Content Security Policy** (where the browser may load things from): added to every page by Astro (`security.csp` in `astro.config.mjs`), with fingerprints of Astro's own small scripts made fresh on every build. `npm run check` fails if any inline script on any page is not covered (`scripts/check-csp.mjs`).
- **`public/_headers`** (read by Cloudflare): no other site may show ours in a frame, `nosniff`, `strict-origin-when-cross-origin` referrers, camera, microphone, and screen sharing only for our own pages, and `noindex` for `/admin` and `/answer`.
- Two choices differ from the first plan, on purpose:
  - `script-src` also allows `https://www.youtube.com`. YouTube's player controller lives there. It loads only after a visitor presses Play on a video.
  - `style-src` allows inline styles. The slide viewer, progress bars, and meters set sizes as inline styles. Styles can't run code, so the risk is small.
- Allowed connections: our own site, `*.supabase.co` (database, files, and the remote's realtime channel), and `www.youtube-nocookie.com` frames. Adding any other service means adding it to `astro.config.mjs` first.

## Final review (Phase 7, October 2026)

Checked against the 11 rules in `CLAUDE.md`, section 11:

| Rule | Result |
|---|---|
| 1. RLS on every table; strangers read only published lessons and public settings | Pass: `npm run check:rls`, 22 checks |
| 2. Sign-ups off; only the owner | Pass: checked by `npm run check:rls` |
| 3. No `service_role` key anywhere | Pass: searched every file in git; only the warning comment in `.env.example` mentions it |
| 4. Markdown cleaned; YouTube IDs only, on youtube-nocookie.com | Pass: every inserted HTML string goes through `renderMarkdown` (DOMPurify), except the fixed icon drawings in our own code |
| 5. Content Security Policy and headers | Pass, with the two choices above |
| 6. Private tokens: 256 bits, `noindex`, never in referrers | Pass: other sites receive only our site's address, never the page address with the token |
| 7. Checks in the browser and in the database; spam trap; rate limits | Pass |
| 8. No logging of secrets or personal data | Pass: no logging in the site code; the Gmail bridge logs only counts |
| 9. Few, pinned dependencies; `npm audit` | Pass: exact versions in `package.json`; `npm audit` found 0 problems |
| 10. `.gitignore` covers secrets, builds, recordings | Pass: `.env*` (except `.env.example`), `node_modules`, `dist`, `.astro`, `*.webm`, `*.mp4`, `test-results` |

Run the review again before any big change: `npm run check`, `npm run check:rls`, and `npm audit`.
