# Launch checklist

Work down the list. Tick each box (change `[ ]` to `[x]`) as you go. Nothing here costs money, except the optional custom domain.

## 1. Words

- [ ] Run `npm run check:launch`. It lists every placeholder still on the site. Fill each one in:
  - [ ] `src/content/about.md`: replace `[YOUR STORY]` with your own story. The writing prompts are in the comment at the top.
  - [ ] `src/content/copy.ts` and `src/content/license.md`: replace `[YOUR WEBSITE]` with your site's address.
  - [ ] `src/content/privacy.md`: have a **parent or guardian read the Privacy page**. Change anything that's not true. Then delete the `[REVIEW BEFORE LAUNCH]` comment.
- [ ] Read every public page out loud once. Does it sound like a patient neighbor? Short sentences, everyday words, no exclamation-mark piles.
- [ ] `npm run check:launch` says "No placeholders left."

## 2. Settings

- [ ] `PUBLIC_SITE_URL` in `.env` and in Cloudflare (build variables) is your real address (`docs/DEPLOY.md`, Steps 8 and 9).
- [ ] The `site_url` setting in Supabase is the same address (`docs/DEPLOY.md`, Step 6). The links in emails use it.
- [ ] `SITE_URL` in the Gmail bridge's Script Properties is the same address.
- [ ] Delete **Sample lesson (delete me)** in **Admin, Lessons**.
- [ ] At least one real lesson is **published**, so the home page shows a lesson instead of "Our first lessons are on the way".

## 3. Safety and security

- [ ] Public sign-ups are off in Supabase (`docs/DEPLOY.md`, Step 2).
- [ ] `npm run check:rls` passes (it tests the database locks as a stranger).
- [ ] `npm run check` passes (words, tests, build, security policy, accessibility).
- [ ] `npm audit` shows no high or critical problems.
- [ ] The `service_role` key is nowhere in the project, in Cloudflare, or in the Gmail bridge. Only the public key is used.
- [ ] `.env` is not on GitHub (it's in `.gitignore`; check the repository on github.com to be sure).
- [ ] You have a **written consent form** for photos and video, from each facility you visit (ask the facility for theirs first). No photos of learners until you have it.

## 4. Test it like a stranger, on a phone

Use a phone that is **not** signed in to the admin area (or a private window).

- [ ] Open the site. Read the home page. Tap **Menu**, then every link.
- [ ] Send a **Request a visit** form, with an email you can check. You get the "Thank you" email within about 5 minutes, and your Gmail gets "New request from...".
- [ ] Ask a question with an email. You get "We got your question" with a private link. Answer it from **Admin, Tickets**. The answer email arrives, and the link shows the answer.
- [ ] Open a lesson. Download the handout. Print the slides as a PDF. Play the video.
- [ ] Make the text bigger (zoom to 200%). Nothing should go off the side of the screen.

## 5. Speed and accessibility (Lighthouse, built into Chrome)

On your laptop, in Chrome, for each of `/`, `/lessons`, and `/for-senior-homes` on the **live** site:

1. Right-click the page, choose **Inspect**, then the **Lighthouse** tab (it may be under `>>`).
2. Choose **Mobile**, tick **Performance** and **Accessibility**, and click **Analyze page load**.
3. Goal: **Accessibility 100**, **Performance 90 or more**.

- [ ] `/` passes
- [ ] `/lessons` passes
- [ ] `/for-senior-homes` passes

If a score is lower, copy what Lighthouse lists into Claude Code and ask for help.

## 6. Teaching

- [ ] Do one full practice run of a lesson at home: Present, the audience window on a TV or second screen, and the phone remote.
- [ ] Try the backup plans: the keyboard instead of the remote, and the printed slides PDF.
- [ ] Read `docs/TEACHING-GUIDE.md` and `docs/ADMIN-GUIDE.md` once.

## 7. Backups

- [ ] **Dashboard, Back up everything.** Save the file somewhere private.
- [ ] Download each lesson as a kit (**Admin, Lessons**) and keep the zips with the backup.

## 8. Optional: a custom domain (about $10 to $15 a year)

Only with a parent or guardian, who should own the account and pay for it.

- [ ] Buy the domain. Many registrars require the account holder to be 18 or older.
- [ ] In Cloudflare, add it to the project (**Workers & Pages**, your project, **Settings**, **Domains & Routes**).
- [ ] Update the address everywhere in section 2, and in `[YOUR WEBSITE]` from section 1.
- [ ] In Supabase (**Authentication**, **URL Configuration**), set the Site URL to the new address.

## Launch

- [ ] Tell your first senior home the site is ready, and send them the **For senior homes** page.
