# Security guidance for Byte-Sized Buddies

This file turns section 11 of `CLAUDE.md` into a threat model. Use it when writing or reviewing code. If this file and `CLAUDE.md` disagree, `CLAUDE.md` wins.

## What we protect

| Asset | Why it matters |
|---|---|
| Names, emails, phones, and questions from the contact and ticket forms | Real people's information. Only the owner may see it. |
| Private answer links (`/answer?t=TOKEN`) | The token is the only thing guarding a requester's answer. |
| The owner's Supabase login and the `owners` row | Whoever controls these controls the whole admin. |
| The bridge secret (Apps Script) | It lets a caller read the outbox and write the inbox. |
| Lesson content and brand | Must not be vandalized or replaced. |
| Residents' personal information | We never collect it. The forms say so. |

## Who might attack, and how

| Threat | Example | Defense (CLAUDE.md section 11) |
|---|---|---|
| Anonymous visitor reads private data | Calls the Supabase REST API directly for `tickets` | Rule 1: RLS on every table. Anonymous users read only published lessons and public settings. |
| Anonymous visitor guesses a token | Tries many `/answer?t=` values | Rule 6: tokens are 128+ bits, made in the browser. `get_ticket` matches exactly and returns one row. |
| Stranger creates an admin account | Uses the Supabase sign-up endpoint | Rule 2: public sign-ups disabled. Only users listed in `owners` count as owner. |
| Spam or flooding of public forms | A script posts thousands of tickets | Rule 7: honeypot field `website`, a limit of 20 per hour in the database function, and length checks. |
| Cross-site scripting (XSS) | A ticket or lesson holds `<script>` or `onerror=` | Rule 4: DOMPurify on all markdown. Never `innerHTML` with unsanitized text. YouTube only by 11-character ID on `youtube-nocookie.com`. |
| Email header injection | A subject line contains `\r\n` to add recipients | Database `check` constraints on `outbox`, and a second check in `Code.gs`. |
| Leaked secret | A key is committed or pasted in chat | Rules 3 and 10: no `service_role` key anywhere. `.env*` is ignored. The bridge secret is stored only as a hash in the database. Never ask the owner to paste a secret in chat. |
| Token leaks through links | A `Referer` header sends the answer URL to another site | Rule 6 and rule 5: `Referrer-Policy: strict-origin-when-cross-origin`, `noindex` on answer pages, no analytics or ad scripts. |
| Clickjacking or script injection from other sites | Another page frames ours | Rule 5: CSP with `script-src 'self'`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`. |
| Malicious upload | A PDF or SVG with a script is uploaded to Storage | Only the owner may write to `lesson-files`. Accept only PDF, PNG, JPG, WebP, SVG up to 10 MB. Never render uploaded SVG inline. |
| Vulnerable dependency | A package has a known flaw | Rule 9: pin versions, run `npm audit`, keep the list short. |
| Data kept too long | Old tickets pile up | `bridge_purge` deletes old rows. The privacy page states the retention time. |

## Rules to follow while coding

1. Hiding a page is never security. Every admin screen checks `getSession()` and `is_owner()`, and the database enforces it again with RLS.
2. Every new table gets `enable row level security` in the same change that creates it.
3. Every `security definer` function sets `search_path = public, extensions`, validates its inputs, and is revoked from `public` before any grant.
4. Never log secrets or personal data. Never print an environment variable that holds a key.
5. Only `PUBLIC_*` environment variables reach the browser. Never add the `service_role` key anywhere.
6. Treat every string from a form, from Supabase, or from a kit file as untrusted until it is validated or sanitized.
7. Check headers in `public/_headers` against real behavior (YouTube, Supabase realtime, camera, microphone, screen capture) after any change.
8. Before adding any dependency, plugin, or MCP server, ask the owner. Section 3.2 lists the approved plugins.

## Out of scope

Nation-state attackers, physical access to the owner's devices, and attacks on Supabase, Cloudflare, Google, or YouTube themselves. The owner should still use a strong, unique password and turn on two-factor sign-in when Phase 7 adds it.
