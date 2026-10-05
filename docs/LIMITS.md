# Free-plan limits, and what to do if you reach one

Everything on this site runs on free plans. Each free plan has limits. This page lists them, how close a small project like ours usually gets, and what to do if a limit is reached.

Numbers checked in October 2026. Services change their plans, so check the linked pages once a year.

## Supabase (database, login, lesson files) — [supabase.com/pricing](https://supabase.com/pricing)

| Limit | Free plan | What uses it here |
|---|---|---|
| Database size | 500 MB | Lessons (text and slides), tickets, requests, copied emails. A year of normal use is a few MB. |
| File storage | 1 GB | Lesson PDFs and slide pictures. **Admin, Lessons** shows "Storage used: X of about 1 GB". |
| Downloads (egress) | 5 GB a month, plus 5 GB of cached downloads | Every time someone downloads a PDF or sees a slide picture. A 1 MB handout downloaded 1,000 times is 1 GB. |
| Largest file | 50 MB | The site refuses anything over 10 MB anyway. |
| Pausing | Paused after about 1 week with no activity | The Gmail bridge talks to the database every 5 minutes, so it stays awake. |
| Projects | 2 active | We use 1. |

**If you get close:**

- **Storage:** shrink PDFs before importing (in the Mac Preview app: File, Export, Quartz Filter, Reduce File Size). Use PNG or WebP screenshots no wider than 1920px. Delete lessons you no longer need (download them as a kit first).
- **Downloads:** this only happens if a lot of people use the lessons, which is good news. Ask a parent or guardian before changing plans. Do not add a card on your own.
- **Paused project:** open the project in the Supabase dashboard and click **Restore**. Then check the Gmail bridge is running (`apps-script/README.md`, Step 6).

## Cloudflare (hosting the website) — [developers.cloudflare.com/workers/static-assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

| Limit | Free plan | What it means here |
|---|---|---|
| Visits | Free and unlimited for the site's pages and files | No limit to worry about. |
| Largest file | 25 MB per file | Never put videos or large PDFs in `public/`. Lesson files go to Supabase. |
| Number of files | 20,000 | The site has under 100. |

## Gmail and Apps Script (the Gmail bridge) — [developers.google.com/apps-script/guides/services/quotas](https://developers.google.com/apps-script/guides/services/quotas)

| Limit | Regular Gmail account | What it means here |
|---|---|---|
| Emails sent by scripts | About 100 people a day | Confirmations, answers, replies, and alerts to you all count. The bridge keeps 5 spare and stops before the limit. Anything left over goes out the next day. |
| Script running time | 90 minutes a day | Each run takes a few seconds, every 5 minutes. Plenty. |
| Web requests | 20,000 a day | The bridge makes a few each run. Plenty. |

**If emails stay "Queued" into the next day,** you sent close to 100 that day. They go out on their own the next day. The website also limits confirmation emails (30 an hour, 3 a day to one address), so strangers can't use the forms to use up your quota.

## YouTube (videos) — [support.google.com/youtube/answer/71673](https://support.google.com/youtube/answer/71673)

| Limit | Free account | What it means here |
|---|---|---|
| Video length | 15 minutes, until you verify the account | Verify once in the YouTube app (a text message or call) to upload longer videos. Our parts are usually much shorter. |
| Storage and views | No limit | This is why videos live on YouTube instead of on our site. |

## GitHub (the code)

Free for public and private repositories. Never commit recordings, `.env`, or backups. `.gitignore` already leaves them out.

## Things that would cost money (don't add them without a parent or guardian)

- A custom domain, about $10 to $15 a year. Optional. The site works on its free `*.workers.dev` or `*.pages.dev` address.
- Any paid plan, or any service that asks for a credit card. If a screen asks for one, stop.
