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
| YouTube videos | `src/lib/youtube.ts` accepts only an 11-character ID and builds a `youtube-nocookie.com` address |
| Private tokens | Made in the browser with `crypto.getRandomValues` (64 hex characters). The answer page is `noindex` |
| Drafts stay private (lessons) | The database only lets strangers read lessons with `status = 'published'`. Unpublish a lesson and it disappears for everyone but you |
| Uploaded files | Only the owner may upload. `src/lib/kit.ts` checks the first bytes of every file, so a renamed file is refused. SVG pictures with scripts, event handlers, or links to other websites are refused. The bucket also limits file types and size (10 MB) |
| Pictures in teacher guides | `src/lib/markdown.ts` keeps a picture only if it comes from our own `lesson-files` storage. Other websites cannot load anything through a guide |
| Draft answers stay private | `get_ticket` returns the answer only after the ticket has been answered |
| Spam | A hidden `website` field, and no more than 20 new tickets or requests per hour |
| Email misuse | Anyone can type any email address into a form. The database queues at most 30 confirmation emails an hour in total and 3 a day to one inbox (`name+tag@` counts as `name@`), so the forms cannot be used to flood a stranger |

## Safe habits

- Never paste a key, password, or token into a chat or a commit.
- `.env` is private. `.env.example` has fake placeholders only.
- If a secret key ever leaks, reset it in the Supabase dashboard and tell a parent or guardian.
- Run `npm audit` now and then.

## Still to come

The headers file (`public/_headers`), the Gmail bridge secret notes, and the final review are in later phases.
