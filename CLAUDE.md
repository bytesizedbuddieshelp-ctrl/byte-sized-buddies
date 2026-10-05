# Byte-Sized Buddies: project spec for Claude Code

> Save this file as `CLAUDE.md` in the root of the project folder. Claude Code reads it at the start of every session, so the whole spec stays in memory while you build.

You are building the website for **Byte-Sized Buddies**, a student-run volunteer project that teaches basic technology to older adults in senior homes, and shares every lesson for free with anyone in the world. Read this whole file before you write any code. Then read everything in `brand/` (the brand book). If this file and `brand/README.md` disagree about **looks or voice**, `brand/README.md` wins. If they disagree about **structure or features**, this file wins.

---

## 0. Who you are working with, and how to behave

- The owner is a **high school junior and a beginner**. They are a minor. They want to learn while building.
- **Explain in plain language.** Before running any command, say in one sentence what it does and why. After each step, say what changed and how to see it.
- **Work in small steps.** Make one thing work, show how to test it, then continue. Commit to git after every working step with a clear message.
- **Stop at the end of every phase** (section 12). Give a short "How to test this phase" list and wait for the owner to say "continue". Do not start the next phase on your own.
- **Never ask the owner to paste a secret (password, API key, token) into this chat.** Tell them where to put it (a `.env` file, a dashboard field, Script Properties). Never print secrets. Never commit `.env`. Create `.env.example` with fake placeholders.
- **Everything must be free.** Do not add paid services, paid packages, or anything that needs a credit card. If something would cost money, stop and say so. The only allowed cost is an optional custom domain (about $10 to $15 a year), added last.
- **Some accounts need a parent or guardian.** The owner is under 18. Some services (domain registrars, hosting, databases) require account holders to be adults. When you reach a step that creates an account, remind the owner to check the service's age rules and to have a parent or guardian own the account if needed.
- **Do not invent facts.** No lorem ipsum, no fake testimonials, no made-up statistics, no fake partner names. Use clear placeholders in square brackets, like `[YOUR FIRST NAME]` and `[YOUR WEBSITE]`.
- **Check current documentation** (Astro, Supabase, Cloudflare, Google Apps Script) before using an API from memory. Versions and limits change. If a doc contradicts this file, tell the owner and pick the working option.
- **Ask before** installing anything not listed in section 3, deleting files, or changing the database schema after Phase 2.
- If you are unsure what the owner wants, ask **one** short question, with a recommended default.

---

## 1. The project in one page

**Name:** Byte-Sized Buddies. Always written exactly this way: capital B on each word, a hyphen in Byte-Sized. Never "BSB" in public text.

**Tagline:** Learn it. Try it. Keep it. (Three short sentences, with periods.)

**Mission:** Free, patient, hands-on technology lessons for older adults, and free materials for anyone who wants to teach them.

**Promise:** You leave every session able to do one real thing you couldn't do before.

**Three audiences**

| Audience | What they need |
|---|---|
| Older adults (learners) | To feel respected, unhurried, safe to make mistakes. |
| Senior home staff and activity directors | To trust us: organized, reliable, safe, free, no hassle. |
| Volunteers and teachers worldwide | Clear, ready-to-use materials to download, adapt, and share. |

**What the owner does each week:** visits a senior home and teaches one lesson (about 45 minutes). Each lesson is a **kit** with: a teacher guide, a slideshow, a one-page worksheet, a one-page handout, an optional short video, and a take-home challenge. The owner writes kits in a Claude chat, then imports them into this website. The website stores them, shows them to the public, and powers the owner's teaching tools.

**What the website does**

1. Public: a landing page, a page for senior homes with a contact form, a "quick question" ticket form, a free lesson library, a "Teach it yourself" page, About, Privacy, License.
2. Private (owner only): login, a dashboard, help tickets, a contact exchange that connects to the owner's Gmail, a lesson manager (slides, worksheets, handouts, videos by week), a presenter mode, a phone-as-remote, and a video studio.
3. Sharing: all lessons are free to download, print, and adapt (Creative Commons).

**Out of scope. Do NOT build:** phone screen mirroring or sharing, live video calls, payments or donations, comments or forums, accounts for senior homes or learners, analytics trackers or ad scripts, chat widgets, anything that stores residents' personal information.

---

## 2. Brand and design: exact specifications

The brand book is in `brand/` (`README.md`, `tokens.json`, `tokens.css`, `copy-bank.md`, `teaching-materials.md`, `logos/`, `fonts/`). **Use the files. Never redraw, retype, recolor, or approximate the logo.**

### 2.1 Colors (palette name: Garden). Use CSS variables from `brand/tokens.css`, never raw hex in components.

| Variable | Hex | Use |
|---|---|---|
| `--forest` | #2F5D50 | The brand. Buttons, headings, links, logo. White text on it is 7.5:1. |
| `--forest-deep` | #1F4237 | Hover/pressed, banners, header and footer backgrounds. Cream text on it is 10:1. |
| `--forest-tint` | #DCE9E3 | Soft panels, "Remember" boxes, table header rows. |
| `--sunshine` | #FFD166 | Accent: highlights, badges, number circles, the logo crumb. **Never as text on cream or white.** Ink text on it is 11:1. |
| `--sunshine-soft` | #FFF1C7 | "Try it" and challenge boxes. Ink text only. |
| `--cream` | #FAF7F0 | Default page background everywhere. |
| `--paper` | #FFFFFF | Cards and areas that sit above cream. |
| `--ink` | #222222 | Body text (14:1 on cream). |
| `--ink-muted` | #55605B | Secondary text and captions (6:1). Never lighter. |
| `--rule` | #D9D4C7 | Hairlines and card lines. Decorative only, never the only boundary of an input. |
| `--brick` | #A63D2F | Errors and warnings only, always with an icon and words. |
| `--focus` | #1A56B8 | Keyboard focus ring: 3px, 2px offset. The only blue. |

Color alone must never carry meaning. Say it in words too.

### 2.2 Type

- **Fraunces** (file `brand/fonts/Fraunces-Soft.woff2`) for titles and the wordmark.
- **Atkinson Hyperlegible** (Regular and Bold woff2 files) for everything people read.
- Self-host the font files. Do not load Google Fonts. Use `font-display: swap`.
- Scale: website hero headline 56px/62px (Fraunces 700); page title 40px/46px; section heading 28px/36px; body-lg 22px/34px; **body 20px/30px (never smaller)**; label (buttons, form labels) 18px/24px bold; caption 18px/26px (the smallest allowed size on screen).
- Slides (1920x1080 canvas): slide-title 72/80, slide-body 44/60 (never below 40px), slide-step 56/68 bold.
- Left-align text. No ALL CAPS paragraphs, no italics for long text, no light weights, no gray lighter than `--ink-muted`.

### 2.3 Shape, space, motion

- Spacing tokens: 4, 8, 16, 24, 32, 48, 72px (`--space-1` to `--space-7`). Page section spacing 72px. Card padding at least 24px.
- Radius: `--radius-sm` 10px (inputs, tags), `--radius-md` 18px (buttons, cards), `--radius-lg` 28px (big panels, slides), `--radius-pill` (badges). **No sharp boxes.**
- Flat paper look: cards use `box-shadow: var(--shadow-card)` (a 2px `--rule` line under the card). **No blurry shadows, no gradients, no glass effects.**
- **Buttons** at least 56px tall and 160px wide, bold 18px label, sentence case ("Request a visit", not "Request A Visit"). Primary: `--forest` background, white text, `--forest-deep` on hover. Secondary: cream background, 3px `--forest` border, forest text. Every tap target is at least 48px.
- Every interactive element has a visible focus ring using `--focus`.
- Motion: minimal. Respect `prefers-reduced-motion` (turn all transitions and animations off). Nothing auto-plays or auto-advances.
- Icons: large, outlined, 2.5px stroke, round caps, always with a visible text label. Write inline SVG icons yourself in one `Icon` component. No emoji anywhere in the UI.

### 2.4 Logo usage (files in `brand/logos/`)

| File | Use |
|---|---|
| `byte-sized-buddies-logo-horizontal.svg` | Website header on light backgrounds, letterhead. |
| `byte-sized-buddies-logo-horizontal-reversed.svg` | On forest/dark backgrounds (footer, hero band, title slides). |
| `byte-sized-buddies-logo-stacked.svg` | Posters, flyers, social cards, the About page. |
| `byte-sized-buddies-mark.svg`, `-mark-reversed.svg`, `-mark-mono.svg` | Small spaces: footer, slide corner, avatar. Mono is one-color printing. |
| `favicon.svg` | Browser tab icon (also generate PNG icons: 32, 180, 192, 512). |

Rules: clear space around the logo equals the crumb height; minimum width 32px (mark) and 160px (horizontal logo); never stretch, rotate, recolor, shadow, or place on busy photos. Header logo is a link to `/`, with an accessible name "Byte-Sized Buddies, home".

### 2.5 Voice (apply to every word of UI copy, errors, emails, and docs)

A patient neighbor: warm, plain, respectful.

- Short sentences, everyday words, one action per sentence. "Tap the green phone icon. It opens your calls."
- Say what will happen next. Normalize mistakes: "Everyone gets stuck here. Let's try again."
- Say "older adults" (or use names). "Learners" in volunteer materials.
- **Banned words in all copy: easy, easily, simple, simply, just, obviously, basically.** Also never "elderly", "tech illiterate", or "seniors" in headlines aimed at older adults. (The phrase "senior homes" is fine when speaking to staff.)
- No baby talk, no exclamation-mark piles, no slang, no fear-based copy. Scam safety uses calm rules ("Hang up. Call the number on your card.").
- Sentence case for headings and buttons. Digits for steps ("Step 1"); spell out one to nine in running text.
- **Enforce it:** add `scripts/check-copy.mjs` that scans `src/` and `content/` for the banned words (case-insensitive, whole words, ignoring code identifiers) and fails `npm run check`. Run it before each commit. Comments and this spec file are exempt.

### 2.6 Imagery

Photos of learners or volunteers only with **written consent** from the person and the facility; none ship by default. Prefer screenshots, close-ups of hands on devices, and big annotated arrows. Every image needs real alt text. Do not use stock photos of older adults looking confused.

---

## 3. Technology decisions (already made; don't re-litigate)

| Need | Choice | Why |
|---|---|---|
| Site framework | **Astro** (latest stable), static output (`output: 'static'`), TypeScript | Fast, accessible by default, easy for a beginner, free to host |
| Interactive parts | **Preact** islands (`@astrojs/preact`) | Small. Only for admin screens, forms, presenter, remote, studio |
| Styling | Plain CSS with the tokens (`brand/tokens.css`), CSS modules or scoped Astro styles. **No Tailwind, no UI kit.** | Exact brand control |
| Backend | **Supabase** free tier: Postgres, Auth, Storage, Realtime | Free, one dashboard |
| Client library | `@supabase/supabase-js` v2 | |
| Markdown | `marked` + `DOMPurify` (sanitize everything before inserting HTML) | |
| Hosting | **Cloudflare** (Pages or Workers static assets: check which is currently recommended for a new static site, and use the free option). **Fallback: GitHub Pages.** | Unlimited static bandwidth, free HTTPS |
| Email bridge | **Google Apps Script** running in the owner's Gmail account (no Google app verification needed for personal use) | Free; no Gmail API review |
| Video hosting | **YouTube** (unlisted or public) embedded with `youtube-nocookie.com` | Free; no video storage limits |
| Slide remote | **Supabase Realtime Broadcast** | Free; no server |
| Recording | Browser **MediaRecorder** + `getDisplayMedia` + `getUserMedia` | Free; no software |
| Tests | Vitest for pure logic; Playwright for 3 to 5 key flows; `axe-core` accessibility checks | Free |

No backend server of our own. No serverless functions of our own. All security is enforced by **Postgres row-level security** (section 6) and never by hiding pages.

**Supabase free tier facts to design around** (verify current numbers on supabase.com/pricing): about 500 MB database, 1 GB file storage, 5 GB monthly bandwidth, and projects **pause after about a week of inactivity**. The Apps Script bridge (section 9) calls Supabase every few minutes, which also keeps the project awake. Mention these limits in `docs/LIMITS.md`.

### 3.1 Repository layout

```
/
  CLAUDE.md                  (this file)
  README.md                  (plain-language setup for the owner)
  brand/                     (brand book: do not edit; copy assets from here)
  public/                    (favicon files, robots.txt, _headers, _redirects)
  src/
    components/              (Astro + Preact components)
    layouts/
    pages/                   (public pages, plus /admin/*)
    content/                 (about.md, privacy.md, teach-it-yourself.md, copy.ts)
    lib/                     (supabase client, kit importer, slide renderer, markdown, validators)
    styles/                  (global.css imports ../../brand/tokens.css)
  supabase/
    schema.sql               (the whole database, runnable in the SQL editor)
    seed.sql                 (one draft sample lesson for testing)
  apps-script/
    Code.gs                  (Gmail bridge)
    README.md                (how to install it)
  scripts/
    check-copy.mjs           (banned-word check)
  docs/
    DEPLOY.md  ADMIN-GUIDE.md  KIT-FORMAT.md  LIMITS.md  SECURITY.md  TEACHING-GUIDE.md
  .env.example  .gitignore
```

Environment variables (public, safe in the browser): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL`. **Never** put the Supabase `service_role` key anywhere in this project, in any file, or in the browser.

### 3.2 Approved Claude Code plugins
The owner approved exactly these plugins from the official marketplace:
frontend-design, security-guidance, context7, and playwright. Do not install
any other plugin, MCP server, or marketplace without asking me first.
- frontend-design: use it for layout, spacing, and component craft. The brand
  folder overrides every style choice (palette, fonts, logo, radius, flat
  shadows, no gradients). If the skill suggests anything that conflicts with
  brand/README.md, follow the brand.
- security-guidance: leave it on. Also create .claude/claude-security-guidance.md
  describing the threat model from section 11.
- context7: use it to check current Astro, Preact, Supabase, and Cloudflare
  docs before using an API from memory.
- playwright: after each page or component, open it at 320px, 768px, and
  1280px wide, take screenshots, and check them against the brand rules
  (colors, type sizes, spacing, 48px tap targets). Fix differences before
  telling me it's done. Also use it for the accessibility checks.

---

## 4. Site map and page specs

### 4.1 Public pages

| Route | Page |
|---|---|
| `/` | Landing |
| `/about` | About (the owner's own story: loaded from `src/content/about.md`; leave `[YOUR STORY]` placeholder with writing prompts as an HTML comment; do not write the story) |
| `/for-senior-homes` | What a visit looks like, what we need, contact form |
| `/lessons` | Free lesson library |
| `/lesson?slug=...` | One lesson (query-string route; client-rendered from Supabase) |
| `/ask` | Quick-question ticket form |
| `/answer?t=TOKEN` | Private page where a requester reads their answer |
| `/teach` | "Teach it yourself" guide |
| `/privacy` | Privacy |
| `/license` | How materials may be used |
| `/404` | Friendly not-found page |

**Header (every page):** horizontal logo (left), nav: Lessons, For senior homes, Ask a question, Teach it yourself, About. Primary button "Request a visit" (links to `/for-senior-homes#contact`). On small screens the nav becomes a large, labeled "Menu" button opening a full-width list (keyboard accessible, focus trapped while open, Escape closes). A "Skip to main content" link is the first focusable element.

**Footer (every page):** reversed mark, "Byte-Sized Buddies · Free to print and share · [YOUR WEBSITE]", links to Privacy and License, the tagline. A small line: "Student-led volunteer project." No social links until the owner provides them (leave them out, don't use placeholders that show).

### 4.2 Landing page (`/`)

Use the copy in `brand/copy-bank.md`. Sections, in order:
1. **Hero** (cream, big): H1 "Learn it. Try it. Keep it." (display-xl). Subhead: the mission sentence. Two buttons: "Request a visit" (primary), "Get free lessons" (secondary).
2. **How a visit works:** three cards with sunshine number circles: Learn it / Try it / Keep it, text from the copy bank.
3. **What you can learn:** a grid of up to 6 published lessons pulled live from Supabase (title, week badge, device badges, one-line summary). If none are published yet, show a calm "Our first lessons are on the way" card instead (never fake lessons).
4. **For senior homes:** short panel on `--forest-tint` with "What we need from you", a button to the contact form.
5. **Free for everyone:** the "Teach it yourself" teaser, with a button to `/teach`.
6. **A promise to families and staff (safety):** a short list: we never ask learners to type real passwords in class; we use practice accounts; photos and video only with written consent; free, always.

### 4.3 For senior homes (`/for-senior-homes`)

- "How a visit works" (45-minute lesson flow from `brand/teaching-materials.md`).
- "What we need from you": a room, a screen or TV (optional), Wi-Fi if available, a staff contact person.
- "What we bring": everything, free, large-print handouts.
- **Contact form** (`id="contact"`), fields: Your name (required), Facility name (required), Your role, Email (required), Phone (optional), Approximate number of learners, Devices they usually use (checkboxes: iPhone, Android phone, tablet, computer, not sure), Best days and times (free text), Anything else we should know. Helper text: "Please don't include passwords, medical details, or bank information." Hidden honeypot field named `website` (must stay empty). Labels above fields, big inputs (min height 56px), visible labels (no placeholder-only labels), errors in plain words next to the field with an icon, and a summary at the top that receives focus after a failed submit. On success: a calm confirmation ("Thank you. We'll reply within [two] days.") and no page reload.
- Submits via the `submit_contact_request` database function (section 6).

### 4.4 Ask a question (`/ask`) and the private answer page

- Form fields: Your name (required), Facility (optional), Email (optional but recommended: explain "so we can send your answer"), Device (iPhone, Android phone, tablet, computer, not sure), How soon (whenever / this week / before our next visit), Your question (required, 5 to 2000 characters). Helper text from the copy bank. Honeypot.
- On submit the **browser** creates a random token (at least 32 bytes from `crypto.getRandomValues`, hex) and sends it with the ticket. After success, show a page that says "We got your question", the private answer link (`/answer?t=TOKEN`), a copy-link button, and "Save this link. It's the only way to find your answer." If an email was given, the bridge emails the same link.
- `/answer?t=TOKEN` calls `get_ticket(p_token)`. Shows status in words (Received, We're working on it, Answered), the question, and the answer (sanitized markdown) with an embedded YouTube video if one is attached. Never lists other tickets. Add `<meta name="robots" content="noindex">`. If the token is unknown, show a gentle "We can't find that link" message.

### 4.5 Lesson library (`/lessons`) and lesson page (`/lesson?slug=`)

- Library: filter chips (All, iPhone, Android, Beginner, Intermediate; each with text, not color only), search box (title and topic), cards sorted by week number. Each card: week badge (sunshine pill), title, summary, device badges, duration. Only `status = 'published'` lessons are visible.
- Lesson page sections: title and summary; "What you'll be able to do" (objectives); **Downloads** (Teacher guide, Slides, Worksheet, Handout, Answer key if present): big labeled buttons with file type and size; **Preview the slides** (embedded viewer, see 7.1); **Video** (if present, the playlist player, see 7.4); **Teacher guide** rendered inline (sanitized markdown); license line; "Tell us how it went" link to `/for-senior-homes#contact`.
- "Download slides as PDF" = the browser's print dialog using a print stylesheet that puts one slide per landscape page (16:9), black text on white, no UI chrome.
- Missing lesson: friendly not-found state.
- Lessons are CC BY-SA 4.0 by default (editable per lesson); show it on every lesson page.

### 4.6 Teach it yourself (`/teach`) and static content pages

- `/teach` content from `src/content/teach-it-yourself.md` (you write a first version from `brand/teaching-materials.md`: the 45-minute flow, what to bring, how to run a hands-on class, scam-safety rule, consent rules, how to adapt and share, how to tell the owner how it went). Link to the lesson library.
- `/privacy`: plain language. What we collect (contact and ticket forms; the information the person types), why, who can see it (only the owner), how long we keep it (answered tickets about 90 days), that we use no advertising or tracking, that we use Supabase (database), Cloudflare (hosting), Google (email), and YouTube (videos, via the privacy-friendly embed). Say plainly: "This page is not legal advice; the owner should have a parent or guardian review it." Mark with `[REVIEW BEFORE LAUNCH]` in a comment.
- `/license`: CC BY-SA 4.0 summary, how to credit ("Byte-Sized Buddies, bytesizedbuddies.org [YOUR WEBSITE]"), and a note that logos and the name are not part of the license (do not reuse the logo for a different project).

---

## 5. Admin (owner only)

All admin routes live under `/admin/*`, include `<meta name="robots" content="noindex">`, and are `robots.txt` disallowed. They are static pages with Preact islands. **Security comes from Supabase Auth plus RLS, not from hiding the pages.** Every admin screen first checks `getSession()` and `is_owner()`; if not signed in, redirect to `/admin`.

### 5.1 Login (`/admin`)

- Email and password (Supabase Auth). **Public sign-ups are disabled** in Supabase (the owner's user is created by hand in the dashboard; see docs/DEPLOY.md). Show a big, plain form. "Sign out" in the admin header.
- Stretch (Phase 7): TOTP two-factor enrollment page.
- Never show whether an email exists. Error: "That email or password didn't work."
- Session timeouts handled gracefully (a "Please sign in again" message).

### 5.2 Admin shell and dashboard (`/admin/dashboard`)

Left nav (becomes top menu on small screens): Dashboard, Tickets, Contact exchange, Lessons, Present, Remote, Studio. Counters with words: "3 new tickets", "1 new request from a senior home", "2 unread emails", "Next steps". A "This week" card showing the most recent published lesson and quick buttons (Present, Open handout). Use the same brand tokens and 18px+ type; admin is not an exception to accessibility.

### 5.3 Tickets (`/admin/tickets`)

- List with filters: New, In progress, Answered, Closed; sort newest first. Each row: name, facility, urgency in words, device, a snippet, time.
- Detail: the full question; internal notes (private); **Answer composer** (markdown with a live sanitized preview; optional YouTube link or video from the studio; "Save draft", "Send answer"). "Send answer" sets status `answered`, `answered_at`, and if the requester gave an email, inserts an `outbox` row (kind `ticket_answered`) containing the private answer link (`PUBLIC_SITE_URL/answer?t=TOKEN`). Confirm dialog before sending.
- Buttons: Mark in progress, Close, Reopen. Soft-delete is not needed; "Delete ticket" asks for confirmation and warns it is permanent.
- Keyboard accessible; success and error messages announced with `aria-live`.

### 5.4 Contact exchange (`/admin/inbox`): Gmail on the website

Shows two things in one place:
1. **Senior-home requests** from the contact form (`contact_requests`): status New/Replied/Scheduled/Closed, details, notes.
2. **Emails** copied from the owner's Gmail by the Apps Script bridge (`inbox_messages`): only messages that carry the Gmail label `BSB` (the owner applies the label, or sets a Gmail filter to label mail from the website). List with sender, subject, snippet, time, unread state; open to read the plain-text body; **reply composer** that inserts an `outbox` row (kind `reply`, with the Gmail thread id) which the bridge sends from the owner's own Gmail within a few minutes. Show the state of each reply: Queued, Sent, or Error (with the reason). Mark handled. Note on screen: "Replies go out within about 5 minutes."
3. A "Reply from Gmail instead" link that opens `https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...` in a new tab, as a fallback.

### 5.5 Lessons manager (`/admin/lessons`)

- List of all lessons by week with status (Draft/Published), last updated, and buttons: Edit, Present, Preview public page, Publish/Unpublish, Delete (confirm; type the title to confirm).
- **New or edit lesson form:** slug (auto from title, editable, lowercase letters and hyphens), week number, title, one-line summary, topic, devices (iPhone, Android, any), level (Beginner/Intermediate), duration (minutes), objectives (list editor), license, teacher guide (markdown editor + preview), video script (markdown), slides (JSON editor with validation + a visual list of slides with reorder; see 7.1), files (upload areas for worksheet PDF, handout PDF, answer-key PDF, teacher-guide PDF, and slide images), videos (YouTube IDs or links, in order).
- **Import a kit:** a drop zone that accepts a `kit.json` (format in section 8) **plus** the PDFs and images it names, all selected at once. It validates, shows a friendly summary ("Week 3: Photos. 13 slides, 1 worksheet, 1 handout. 2 warnings"), then saves as **Draft**. The owner reviews and clicks Publish. Warnings (not errors) for: a slide body over 25 words, a missing image alt text, a PDF over 5 MB, missing handout or worksheet.
- Uploads go to the public Storage bucket `lesson-files` at `lessons/<slug>/<filename>`. Accept PDF, PNG, JPG, WebP, SVG only; reject anything over 10 MB with a clear message; keep a running "Storage used: X of about 1 GB" meter (sum from the `lessons` table's recorded file sizes).
- Export button: downloads all lessons as one JSON backup, and each lesson's kit as a zip (kit.json + files) for sharing.

### 5.6 Presenter mode and phone remote: see section 7.2 and 7.3. Video studio: section 7.4.

---

## 6. Database (Supabase Postgres): write this as `supabase/schema.sql`

Create the following. Enable RLS on **every** table. The owner is identified by a row in `owners` (inserted once, by hand, after the owner's auth user is created). Anonymous visitors never read tables directly except published lessons and public settings; all other anonymous actions are `security definer` functions with strict validation.

```sql
create extension if not exists pgcrypto;

-- Who is the owner?
create table public.owners (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.owners enable row level security;       -- no policies: nobody reads it directly
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.owners where user_id = auth.uid()); $$;

-- Site settings (some public, like opener/closer video ids and the site URL)
create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy "owner all" on public.settings for all using (public.is_owner()) with check (public.is_owner());
create policy "public read public settings" on public.settings for select using (is_public);

-- Lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  week_number int check (week_number between 1 and 200),
  title text not null check (char_length(title) between 1 and 120),
  summary text check (char_length(summary) <= 400),
  topic text,
  devices text[] not null default '{any}',
  level text not null default 'beginner' check (level in ('beginner','intermediate')),
  duration_minutes int not null default 45,
  objectives text[] not null default '{}',
  slides jsonb not null default '{"version":1,"slides":[]}',
  teacher_guide_md text,
  video_script_md text,
  files jsonb not null default '{}',      -- {"worksheet":{"path":"...","bytes":123},"handout":{...},"answer_key":{...},"teacher_guide_pdf":{...},"images":[{"name":"x.png","path":"...","bytes":1}]}
  video_ids jsonb not null default '[]',  -- ordered list of {"youtube_id":"...","label":"..."}
  license text not null default 'CC BY-SA 4.0',
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lessons enable row level security;
create policy "owner all" on public.lessons for all using (public.is_owner()) with check (public.is_owner());
create policy "public read published" on public.lessons for select using (status = 'published');

-- Videos made in the studio (or any YouTube link the owner wants to keep)
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete set null,
  ticket_id uuid,
  title text not null,
  kind text not null default 'lesson' check (kind in ('lesson','ticket_answer','opener','closer','other')),
  segments jsonb not null default '[]',   -- ordered [{"youtube_id":"...","label":"Opener"}, ...]
  script_md text,
  created_at timestamptz not null default now()
);
alter table public.videos enable row level security;
create policy "owner all" on public.videos for all using (public.is_owner()) with check (public.is_owner());

-- Help tickets
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) >= 32),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','in_progress','answered','closed')),
  requester_name text not null check (char_length(requester_name) between 1 and 80),
  facility text check (char_length(facility) <= 120),
  requester_email text check (char_length(requester_email) <= 200),
  device text check (device in ('iphone','android','tablet','computer','not_sure')),
  urgency text not null default 'whenever' check (urgency in ('whenever','this_week','before_next_visit')),
  question text not null check (char_length(question) between 5 and 2000),
  internal_notes text,
  answer_md text,
  answer_video_youtube_id text,
  answered_at timestamptz,
  owner_notified_at timestamptz
);
alter table public.tickets enable row level security;
create policy "owner all" on public.tickets for all using (public.is_owner()) with check (public.is_owner());

-- Requests from senior homes
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','replied','scheduled','closed')),
  contact_name text not null check (char_length(contact_name) between 1 and 80),
  facility text not null check (char_length(facility) between 1 and 120),
  role text check (char_length(role) <= 80),
  email text not null check (char_length(email) between 5 and 200),
  phone text check (char_length(phone) <= 40),
  learner_count text check (char_length(learner_count) <= 40),
  devices text[] not null default '{}',
  preferred_times text check (char_length(preferred_times) <= 300),
  message text check (char_length(message) <= 2000),
  internal_notes text,
  owner_notified_at timestamptz
);
alter table public.contact_requests enable row level security;
create policy "owner all" on public.contact_requests for all using (public.is_owner()) with check (public.is_owner());

-- Gmail copies (written only by the bridge) and outgoing mail queue
create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id text not null,
  from_name text, from_email text, subject text,
  body_text text,                    -- plain text, truncated to 8000 chars by the bridge
  received_at timestamptz not null,
  is_read boolean not null default false,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.inbox_messages enable row level security;
create policy "owner all" on public.inbox_messages for all using (public.is_owner()) with check (public.is_owner());

create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reply','ticket_received','ticket_answered','contact_received','note_to_owner')),
  to_email text not null check (char_length(to_email) <= 200 and to_email !~ '[\r\n]'),
  subject text not null check (char_length(subject) <= 200 and subject !~ '[\r\n]'),
  body_text text not null check (char_length(body_text) <= 10000),
  gmail_thread_id text,               -- set for replies
  status text not null default 'queued' check (status in ('queued','sent','error')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.outbox enable row level security;
create policy "owner all" on public.outbox for all using (public.is_owner()) with check (public.is_owner());

-- Bridge secret (hash only)
create table public.bridge_secret (id int primary key default 1 check (id = 1), secret_hash text not null);
alter table public.bridge_secret enable row level security;     -- no policies
create or replace function public.bridge_ok(p_secret text) returns boolean
language sql stable security definer set search_path = public, extensions as
$$ select coalesce((select secret_hash = encode(digest(p_secret,'sha256'),'hex') from public.bridge_secret where id = 1), false); $$;
revoke all on function public.bridge_ok(text) from public, anon, authenticated;
```

### 6.1 Functions (all `security definer`, `set search_path = public, extensions`; revoke from `public`, then grant `execute` to `anon, authenticated` only for the ones marked public)

**Public (anonymous allowed):**
- `submit_ticket(p_token text, p_name text, p_facility text, p_email text, p_device text, p_urgency text, p_question text, p_website text)`: if `p_website` is not empty, return silently (honeypot). Validate lengths and token length (at least 32). Rate limit: raise an exception ("Too many questions right now. Please try again later.") if more than 20 tickets were created in the last hour. Insert the ticket. If `p_email` looks valid, insert an `outbox` row `ticket_received` whose body includes the private link (read `site_url` from public `settings`). Do not return the token.
- `get_ticket(p_token text)` returns one row: `status, requester_name, question, answer_md, answer_video_youtube_id, answered_at, created_at`, matching the token exactly. Nothing else.
- `submit_contact_request(p_name text, p_facility text, p_role text, p_email text, p_phone text, p_learner_count text, p_devices text[], p_times text, p_message text, p_website text)`: honeypot, validation, rate limit (more than 20 per hour fails), insert, and an `outbox` `contact_received` confirmation to the sender.

**Bridge (callable by anon but guarded by `bridge_ok(p_secret)`; if the secret is wrong, return nothing or raise "not allowed"):**
- `bridge_get_work(p_secret text)` returns json: `{ outbox: [up to 20 queued rows], notify_tickets: [tickets with owner_notified_at is null], notify_contacts: [contact_requests with owner_notified_at is null] }`.
- `bridge_mark_outbox(p_secret text, p_id uuid, p_ok boolean, p_error text)`: set status, `sent_at`, `error`. For kinds `ticket_received`, `ticket_answered`, `contact_received`, replace `body_text` with `'[sent]'` after a successful send, so private links don't linger.
- `bridge_mark_notified(p_secret text, p_kind text, p_id uuid)`: set `owner_notified_at = now()` on the ticket or contact request.
- `bridge_upsert_inbox(p_secret text, p_rows jsonb)`: upsert on `gmail_message_id`; never overwrite `is_read` or `handled`.
- `bridge_purge(p_secret text)`: delete tickets answered/closed more than 90 days ago, sent outbox rows older than 30 days, inbox messages older than 90 days. Return counts.

### 6.2 Storage

Create a **public** bucket `lesson-files`. Policies on `storage.objects`: only the owner (`public.is_owner()`) may insert, update, or delete in that bucket. Everyone may read (public bucket). Allowed types and the 10 MB limit are also enforced in the client.

### 6.3 Seed and checks

`supabase/seed.sql` inserts public settings (`site_url` placeholder, `opener_video` null, `closer_video` null) and **one draft** sample lesson named "Sample lesson (delete me)". Write `docs/SECURITY.md` listing how to test RLS: signed-out requests can read only published lessons and public settings; cannot read tickets, contacts, inbox, or outbox; cannot call bridge functions with a wrong secret. Write a small script or checklist that proves it.

---

## 7. Teaching tools

### 7.1 Slide format and viewer

Slides are **JSON, rendered by the website** in the brand style (so every kit looks consistent, works offline, can be remote-controlled, and prints cleanly). Canvas is 1920x1080, scaled to fit the window with letterboxing, text never below 40px at canvas size.

```json
{
  "version": 1,
  "slides": [
    { "layout": "title",  "title": "Calling a Friend", "subtitle": "Week 1", "notes": "Welcome everyone. Ask a warm-up question." },
    { "layout": "idea",   "title": "The green phone", "body": ["It opens your calls."], "image": { "file": "phone-home.png", "alt": "A phone home screen with the green phone icon circled" }, "notes": "" },
    { "layout": "step",   "step": 1, "title": "Tap Contacts", "body": ["Find the person icon at the bottom."], "image": { "file": "contacts.png", "alt": "..." }, "notes": "" },
    { "layout": "tryit",  "title": "Try it now", "body": ["Find a name in your contacts. Tap it."], "timer_minutes": 5, "notes": "Walk around and help." },
    { "layout": "recap",  "title": "Today you learned", "bullets": ["Open Contacts.", "Tap a name.", "Tap the green phone."] },
    { "layout": "keepit", "title": "Keep it", "body": ["Take your handout home.", "This week's challenge: call one person you love."] }
  ]
}
```

Layouts and styling (from `brand/teaching-materials.md`): **title** = `--forest-deep` background, reversed logo, 72px cream title, sunshine bar; **idea** = cream background, title in forest, `slide-body`, fewer than 25 words; **step** = a sunshine circle with the number, `slide-step` text, screenshot taking at least half the slide; **tryit** = a `--sunshine-soft` panel labeled "Try it" at the top, optional visible countdown timer; **recap** = up to 4 bullets; **keepit** = forest tint panel. Footer on every slide: the mark (32px) and the lesson name (28px minimum). Corners `--radius-lg`. Margins 48px. `image.file` refers to a file uploaded for this lesson (resolve to its public Storage URL).

Viewer features: keyboard (arrows, Space, Home, End, Escape), big on-screen Previous/Next buttons, slide counter ("3 of 14"), a progress bar, fullscreen, "Blank screen" toggle (B key), optional notes panel (only in presenter mode), print stylesheet (one slide per landscape page), and `aria-live` slide titles for screen readers. Validate with a JSON schema; show friendly errors that name the slide number.

### 7.2 Presenter mode (`/admin/present?slug=`)

The owner's laptop is usually connected to a TV or projector. So presenter mode has **two windows**:
- **Control window** (owner's screen): current slide, next slide preview, speaker notes (large), timer for the lesson (45-minute clock, with a gentle color-and-words warning at 5 minutes left), a slide strip to jump around, the 4-letter **remote code**, buttons: Open audience window, Blank, Fullscreen.
- **Audience window** (opened with `window.open`, dragged to the TV, then fullscreen): shows only the slide. No notes, no admin UI.
Both stay in sync with `BroadcastChannel`. A single-window fallback (no notes) is available too. Everything runs offline once loaded. Add "Download slides as PDF" in the control window as a backup in case Wi-Fi fails.

### 7.3 Phone remote (`/admin/remote`)

- Open `/admin/remote` on the owner's phone (signed in as the owner). Enter the 4-letter code shown in presenter mode.
- Uses a **Supabase Realtime Broadcast** channel named `remote:<code>`. Messages: `next`, `prev`, `goto:<n>`, `blank`, `timer:start|pause`, plus `state` messages from the presenter back to the phone (slide index, total, title, notes, blank status).
- Phone UI: two huge buttons (Back, Next; at least 30% of the screen height), the slide number and title, the notes for the current slide in readable type, Blank and Timer buttons. Use the Screen Wake Lock API so the phone doesn't sleep. Short vibration on press where supported. Show a clear connected/disconnected state in words, auto-reconnect, and a "Reconnect" button.
- The code is random per presenter session (4 letters, no confusing characters like O and I) and expires when the presenter window closes.
- Tell the owner in docs: "If the Wi-Fi is bad, use your phone as a hotspot, or use the keyboard."
- **There is no phone screen sharing or mirroring. Don't build it.**

### 7.4 Video studio (`/admin/studio`)

Works best in desktop Chrome or Edge; say so on the page and detect unsupported browsers with a friendly message.

- A three-part workflow: **Opener**, **Main (screen demo)**, **Closer**. Each part is a separate clip. The studio lets the owner:
  - choose a camera and microphone (device pickers), see a live mic level meter;
  - **Record the opener** with the camera (and mic);
  - **Record the main part** with a screen/window/tab share (`getDisplayMedia`, with the mic mixed in; optionally tab audio) and an optional small camera bubble overlay (compose with a canvas, capture the canvas stream);
  - **Record the closer** with the camera;
  - 3-2-1 countdown, Pause/Resume, Stop, play back, **Re-record**, and keep multiple takes;
  - a **teleprompter** panel that shows the lesson's `video_script_md` in big text with adjustable size and speed. (Warn: record a different window or tab than the teleprompter, or the script will appear in the video.)
  - **Reuse a standard opener/closer:** the owner can mark one recorded opener and one closer as the defaults; they're stored as YouTube IDs in public settings (`opener_video`, `closer_video`) so future videos can skip recording them.
- Output: each clip downloads to the owner's computer as `.webm` (or `.mp4` if the browser records it). Then the owner uploads the clips to YouTube (unlisted or public) by hand, and pastes the YouTube links into the studio's "Publish" step, which saves a `videos` row (ordered segments: opener, main, closer) and can attach it to a lesson (`lessons.video_ids`) or to a ticket answer (`answer_video_youtube_id` uses the main clip).
- **The playlist player** (public lesson page and answer page): plays the segments back-to-back using the YouTube IFrame API on `youtube-nocookie.com`, with a "Part 1 of 3" label, large controls, and captions on if available. No autoplay.
- Do not store video files in Supabase. Do not try to merge videos in the browser in the first version.
- Add a short on-page checklist: "Close other tabs. Quiet room. Hide passwords and personal messages before you share your screen."

---

## 8. The "kit" import format (so lessons made in chat drop right in)

Write this up in `docs/KIT-FORMAT.md` and make the importer enforce it. The owner generates kits in a Claude chat and downloads files that match this exactly.

`kit.json`:
```json
{
  "kit_version": 1,
  "lesson": {
    "slug": "week-01-calling-a-friend",
    "week_number": 1,
    "title": "Calling a friend",
    "summary": "Find the green phone, pick a name, and make your first call.",
    "topic": "Phone calls",
    "devices": ["iphone", "android"],
    "level": "beginner",
    "duration_minutes": 45,
    "objectives": ["Open the phone app", "Call someone from Contacts"],
    "license": "CC BY-SA 4.0"
  },
  "slides": { "version": 1, "slides": [ /* as in 7.1 */ ] },
  "teacher_guide_md": "# Teacher guide ...",
  "video_script_md": "## Opener ...",
  "files": {
    "worksheet": "week-01-worksheet.pdf",
    "handout": "week-01-handout.pdf",
    "answer_key": "week-01-answer-key.pdf",
    "teacher_guide_pdf": null
  },
  "images": ["phone-home.png", "contacts.png"]
}
```
Rules the importer enforces: `slug` unique and valid; `devices` from the allowed list; every file named in `files` and `images` must be present among the dropped files; PDFs are real PDFs; images have alt text in the slides; the importer never overwrites an existing slug unless the owner confirms "Replace this lesson".

---

## 9. Gmail bridge (Google Apps Script): `apps-script/Code.gs` and `apps-script/README.md`

Purpose: show the owner's labeled emails on the website, send replies and notification emails from the owner's Gmail, and keep Supabase awake. Runs inside the owner's Google account on a 5-minute timer. **Do not use the Gmail API from the website.** Everything goes through Supabase tables and the bridge functions in section 6.1.

Write `Code.gs` like this (adjust details after checking current Apps Script docs):

```javascript
// Byte-Sized Buddies Gmail bridge. Runs in the owner's own Google account.
// Script Properties required: SUPABASE_URL, SUPABASE_ANON_KEY, BRIDGE_SECRET, OWNER_EMAIL, GMAIL_LABEL (default "BSB"), SITE_URL

function cfg_() {
  const p = PropertiesService.getScriptProperties();
  return {
    url: p.getProperty('SUPABASE_URL'), anon: p.getProperty('SUPABASE_ANON_KEY'),
    secret: p.getProperty('BRIDGE_SECRET'), owner: p.getProperty('OWNER_EMAIL'),
    label: p.getProperty('GMAIL_LABEL') || 'BSB'
  };
}

function rpc_(fn, body) {
  const c = cfg_();
  const res = UrlFetchApp.fetch(c.url + '/rest/v1/rpc/' + fn, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: c.anon, Authorization: 'Bearer ' + c.anon },
    payload: JSON.stringify(Object.assign({ p_secret: c.secret }, body || {}))
  });
  if (res.getResponseCode() >= 300) throw new Error(fn + ' failed: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  const t = res.getContentText();
  return t ? JSON.parse(t) : null;
}

function tick() {            // the 5-minute trigger runs this
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try { pushInbox_(); processWork_(); }
  finally { lock.releaseLock(); }
}

function pushInbox_() {
  const c = cfg_();
  const threads = GmailApp.search('label:' + c.label + ' newer_than:30d', 0, 30);
  const rows = [];
  threads.forEach(function (th) {
    th.getMessages().forEach(function (m) {
      const from = m.getFrom();
      if (from.indexOf(c.owner) !== -1) return;               // skip the owner's own sent mail
      const match = from.match(/^(.*?)\s*<(.+)>$/);
      rows.push({
        gmail_message_id: m.getId(), gmail_thread_id: th.getId(),
        from_name: match ? match[1].replace(/"/g, '') : from, from_email: match ? match[2] : from,
        subject: m.getSubject(), body_text: m.getPlainBody().slice(0, 8000),
        received_at: m.getDate().toISOString()
      });
    });
  });
  if (rows.length) rpc_('bridge_upsert_inbox', { p_rows: rows });
}

function processWork_() {
  const c = cfg_();
  const work = rpc_('bridge_get_work');
  (work.outbox || []).forEach(function (o) {
    try {
      if (/[\r\n]/.test(o.to_email) || /[\r\n]/.test(o.subject)) throw new Error('bad header');
      if (o.kind === 'reply' && o.gmail_thread_id) {
        GmailApp.getThreadById(o.gmail_thread_id).reply(o.body_text);
      } else {
        GmailApp.sendEmail(o.to_email, o.subject, o.body_text, { name: 'Byte-Sized Buddies' });
      }
      rpc_('bridge_mark_outbox', { p_id: o.id, p_ok: true, p_error: null });
    } catch (e) {
      rpc_('bridge_mark_outbox', { p_id: o.id, p_ok: false, p_error: String(e).slice(0, 300) });
    }
  });
  (work.notify_tickets || []).forEach(function (t) {
    GmailApp.sendEmail(c.owner, 'New question: ' + t.requester_name, t.question.slice(0, 500));
    rpc_('bridge_mark_notified', { p_kind: 'ticket', p_id: t.id });
  });
  (work.notify_contacts || []).forEach(function (r) {
    GmailApp.sendEmail(c.owner, 'New request from ' + r.facility, (r.message || '').slice(0, 500));
    rpc_('bridge_mark_notified', { p_kind: 'contact', p_id: r.id });
  });
}

function dailyPurge() { rpc_('bridge_purge'); }

function install() {          // run once by hand
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('dailyPurge').timeBased().everyDays(1).atHour(3).create();
}
```

`apps-script/README.md` walks the owner through: create the script at script.google.com while signed in to the project's Gmail; paste `Code.gs`; set Script Properties (the bridge secret is generated in the terminal with `openssl rand -hex 32` and stored only in two places: Script Properties and, as a SHA-256 hash, the `bridge_secret` table via the SQL editor); run `install` once; approve the Google permission screens (Google shows an "unverified app" warning for personal scripts: that is expected for the owner's own script); create the Gmail label `BSB` and a filter that applies it to mail from the website; test with a ticket. State the limits plainly: a consumer Gmail account can send roughly 100 emails a day through scripts; the script limits itself to 20 sends per run; replies take up to ~5 minutes. Recommend a **dedicated project Gmail address** instead of a personal one.

Security notes to write in `docs/SECURITY.md`: the bridge secret never leaves Script Properties; it is only ever compared by hash inside the database; the `service_role` key is never used; if the secret leaks, replace the hash in `bridge_secret` and update Script Properties.

---

## 10. Accessibility, performance, and quality bar (non-negotiable)

- Target **WCAG 2.2 AA**; body text 7:1 where the palette allows. Check every color pair; fix any that fail rather than reaching for raw colors.
- Semantic HTML: one `h1` per page, ordered headings, `main`/`nav`/`footer` landmarks, real `button` and `a` elements, labels tied to inputs, `aria-live` for status messages, `aria-describedby` for field errors. Never `div onClick`.
- Fully **keyboard operable**, logical focus order, focus returned after dialogs, visible focus ring everywhere.
- Works at **200% and 400% zoom** without sideways scrolling (except wide tables inside their own scroll box). Responsive from 320px to 1920px.
- Respect `prefers-reduced-motion` and `prefers-color-scheme` is **not** used (single light theme).
- Forms: no timeouts that erase typed text; errors in plain words; large inputs.
- Language: `<html lang="en">`; keep all user-facing strings in `src/content/copy.ts` and content files (not scattered in components) so translations can be added later.
- Performance: no unused JavaScript on public pages (admin code split into admin routes), images sized and `loading="lazy"`, fonts preloaded, Lighthouse accessibility 100 and performance 90 or higher on `/`, `/lessons`, `/for-senior-homes`.
- Print stylesheets for slides and lesson pages.
- Tests: Vitest for the kit validator, slide schema, token generator, and copy checker. Playwright for: submit a ticket and read the answer; submit a contact request; sign in and import a kit; run presenter + remote handshake in two browser contexts. `axe-core` on every public page in CI-style script (`npm run check`).

---

## 11. Security rules (write them into code, then into docs/SECURITY.md)

1. RLS on every table; anonymous users can read only published lessons and public settings; everything else through guarded functions (section 6).
2. Public sign-ups disabled; only the owner's auth user exists and is listed in `owners`.
3. No `service_role` key in the repo, the browser, or Script Properties.
4. Sanitize all markdown with DOMPurify before inserting into the page. Never use `innerHTML` with unsanitized strings. Embed YouTube only with IDs matching `^[A-Za-z0-9_-]{11}$` on `youtube-nocookie.com`.
5. Content Security Policy and other headers in `public/_headers` (Cloudflare): `default-src 'self'`; `connect-src 'self' https://*.supabase.co wss://*.supabase.co`; `frame-src https://www.youtube-nocookie.com`; `img-src 'self' data: https://*.supabase.co`; `style-src 'self' 'unsafe-inline'` only if unavoidable; `script-src 'self'` (use hashes for Astro's inline scripts if needed); `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), geolocation=()`; `frame-ancestors 'none'`. Test that nothing breaks (YouTube, Supabase realtime, recording).
6. Ticket tokens are at least 128 bits of randomness, generated in the browser; answer pages are `noindex`; tokens never appear in analytics (there is none) or in `Referer` headers sent elsewhere.
7. Input validation on the client **and** in the database (`check` constraints and function checks). Honeypot and rate limits on public forms.
8. Never log secrets or personal data. Never collect residents' personal information; the forms say so.
9. Dependencies: pin versions, run `npm audit`, keep the list short.
10. `.gitignore` covers `.env*` (except `.env.example`), `node_modules`, `dist`, `.astro`, and any recordings.

---

## 12. Build phases (stop and wait for the owner after each one)

For every phase: say what you'll build, build it in small committed steps, run `npm run check`, then give a numbered **"How to test this"** list in plain words. Do not move on until the owner says "continue".

**Phase 0: Foundation.** Create the Astro + Preact project in the current folder. Copy `brand/tokens.css` and fonts into the build (so `/fonts/...` works), set up the global stylesheet, base layout, header, footer, skip link, `Button`, `Card`, `Icon`, `Badge`, `FormField`, `Callout` ("Remember" in forest tint, "Try it" in sunshine soft), `Logo`. Add `scripts/check-copy.mjs`, `npm run check`, `.env.example`, `.gitignore`, a first `README.md`. Set up deployment to a free `*.pages.dev`-style address (or GitHub Pages) with a hello-world page. **Test:** the site loads online; tab through the header; fonts and colors match `brand/`.

**Phase 1: Public pages (no database yet).** Landing, For senior homes (form UI with client-side validation; submit button shows a "not connected yet" message), Ask (UI only), About (placeholder), Teach, Privacy, License, 404, `robots.txt`, favicon set, Open Graph image (a branded 1200x630 card made from the logo), `sitemap`. **Test:** every page at 320px, 1280px, and 200% zoom; keyboard only; screen reader landmarks; `axe` clean.

**Phase 2: Database, login, and the two forms.** `supabase/schema.sql` and `seed.sql`; `docs/DEPLOY.md` section for creating the Supabase project, disabling sign-ups, creating the owner user, inserting the owner row, running the SQL, setting the URL and anon key in `.env` and in the host's environment variables. Admin login, shell, dashboard; connect both forms to their functions; the private answer page; admin Tickets and Contact exchange (the senior-home requests half only; inbox comes in Phase 5). **Test:** submit a ticket as a stranger (signed out, in a private window), see it in admin, answer it, open the answer link; RLS checks from `docs/SECURITY.md`.

**Phase 3: Lessons.** Lessons manager (form + kit importer + uploads + publish), public library and lesson page, slide renderer and viewer, print-to-PDF stylesheet, exports, and the sample kit file (`docs/sample-kit/` with a tiny, real, 5-slide `kit.json` and a generated one-page PDF) so the owner can test importing. **Test:** import the sample kit, publish it, view it signed out, print the slides to PDF.

**Phase 4: Presenter mode and phone remote.** As in 7.2 and 7.3. **Test:** laptop + phone on the same Wi-Fi; then phone on cell data; keyboard fallback; blank screen; audience window on a second display or a second browser window.

**Phase 5: Gmail bridge.** `apps-script/` files, the Contact exchange inbox/reply UI, notification and confirmation emails, daily purge. Write the clearest possible `apps-script/README.md` with screenshots described in words. **Test:** label an email `BSB`, see it appear within 5 minutes, reply from the site, receive the reply; submit a ticket with an email and receive the confirmation.

**Phase 6: Video studio.** As in 7.4, plus the playlist player on lesson and answer pages. **Test:** record a 20-second opener, screen part, and closer; download; paste three YouTube links; play the playlist on a lesson page.

**Phase 7: Polish and launch checklist.** Optional TOTP two-factor sign-in; empty states; error states; the `docs/ADMIN-GUIDE.md` (weekly routine in plain steps, with the chat-to-site workflow); `docs/TEACHING-GUIDE.md`; `docs/LIMITS.md` (free-tier numbers and what to do if they're reached); a "backup everything" button; Lighthouse and axe pass on all public pages; a final security review against section 11; final copy pass against the voice rules; a launch checklist (custom domain optional; Privacy page reviewed by a parent or guardian; senior-home contact form tested from a phone; consent forms for photos and video prepared).

---

## 13. Definition of done (for the whole project)

- A stranger can find the site, read the mission, request a visit, ask a question, and download a free lesson, without any account.
- The owner can sign in, see tickets and Gmail messages in one place and reply, import a kit made in chat, publish it, present it from a laptop to a TV with their phone as a remote, and record a short video and put it on the website.
- Everything runs on free tiers. Nothing secret is in the repo. All pages pass the accessibility checks. All copy follows the voice rules.
- Another volunteer anywhere can download a lesson, print the handout, and teach it.

When you are ready: read `brand/README.md` and `brand/teaching-materials.md`, summarize back to the owner in 8 short bullets what you understood and any question you have (one at a time), then begin Phase 0.
