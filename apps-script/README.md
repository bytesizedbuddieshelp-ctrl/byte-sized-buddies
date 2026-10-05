# The Gmail bridge

The Gmail bridge is a small script that lives in your Google account. Every 5 minutes it:

1. Copies emails that have the Gmail label **BSB** to **Admin, Contact exchange**.
2. Sends the emails the website has queued: your replies, "We got your question", "Your answer is ready", and "Thank you for reaching out".
3. Emails you when a new question or senior-home request comes in.
4. Keeps the free Supabase database awake, so it is not paused after a quiet week.

Once a day it also deletes old data (answered tickets after about 90 days, sent emails after 30 days, copied emails after 90 days).

It is free. It needs no server and no Google review, because it is your own script in your own account.

**Rules for this guide**

- **Never paste the bridge secret, a password, or a key into a chat.** Not into Claude, not into anyone. Paste it only where a step says.
- Google accounts have age rules. Check them, and ask a parent or guardian to own the account if needed.
- Everything here is free. If a screen asks for a credit card, stop.

---

## Before you start: use a project Gmail address

We recommend a **separate Gmail address for Byte-Sized Buddies**, for example `bytesizedbuddies.help@gmail.com`, instead of your personal one. Then:

- your personal email never shows on the website,
- you can label every email that arrives there, and
- a parent or guardian can share access if needed.

Sign in to that account in your browser for every step below.

## Step 1: Make the secret

The secret is a long password that lets the script talk to the database. Only a fingerprint of it is stored in the database, so even you can't read the secret back from there.

1. Open the **Terminal** app on your computer (not the Claude chat).
2. Go to the project folder and run:

   ```
   npm run bridge:secret
   ```

3. It prints two things. Keep the window open for Steps 2 and 4.

> Do not run it by typing `!` in Claude Code. That would put the secret into the chat.

## Step 2: Save the fingerprint in Supabase

1. Open your project at **supabase.com**, then **SQL Editor**, then **New query**.
2. Copy the line that starts with `insert into public.bridge_secret` from the Terminal and paste it in.
3. Click **Run**. You should see **Success. No rows returned.**

## Step 3: Create the script

1. Go to **script.google.com**, signed in to the project Gmail.
2. Click **New project**. At the top, click **Untitled project** and rename it **Byte-Sized Buddies bridge**.
3. You see a file called `Code.gs` with a few lines in it. Select all of them and delete them.
4. Open `apps-script/Code.gs` from this folder, copy everything, and paste it in.
5. Click the **Save** icon (a floppy disk) above the code.

## Step 4: Add the settings (Script Properties)

1. In the left sidebar, click the **gear** icon (**Project Settings**).
2. Scroll down to **Script Properties** and click **Add script property**. Add these six, one at a time:

   | Property | Value |
   |---|---|
   | `SUPABASE_URL` | Your project address, like `https://abcd1234.supabase.co` (same as `PUBLIC_SUPABASE_URL` in `.env`) |
   | `SUPABASE_ANON_KEY` | The public key (same as `PUBLIC_SUPABASE_ANON_KEY` in `.env`). **Never the `service_role` or secret key.** |
   | `BRIDGE_SECRET` | The long secret from Step 1 (the first thing printed) |
   | `OWNER_EMAIL` | The Gmail address this script runs in |
   | `SITE_URL` | Your website address, like `https://byte-sized-buddies.pages.dev`, with no `/` at the end |
   | `GMAIL_LABEL` | `BSB` (you can leave this one out; `BSB` is the default) |

3. Click **Save script properties**.
4. Close the Terminal window from Step 1. You don't need the secret anymore.

## Step 5: Check the setup

1. Click the **< >** icon (**Editor**) in the left sidebar.
2. In the bar above the code, find the menu that names a function. Choose **testSetup**. Click **Run**.
3. The first time, Google asks for permission:
   - Click **Review permissions** and choose the project Gmail account.
   - Google says **"Google hasn't verified this app"**. That is expected, because this is your own script and nobody else uses it. Click **Advanced**, then **Go to Byte-Sized Buddies bridge (unsafe)**.
   - It lists what the script may do: read, send, and manage your email; connect to an external service (Supabase); and run on a timer. Click **Allow**.
4. The **Execution log** at the bottom should say:
   - `Script Properties found.`
   - `The database accepted the secret.`
   - how many emails Gmail will still let you send today.

If it shows an error, see **If something goes wrong** below.

## Step 6: Turn it on

1. In the function menu, choose **install**. Click **Run**.
2. The log says `Done. The bridge now runs every 5 minutes, and cleans up once a day.`
3. To check, click the **clock** icon (**Triggers**) in the left sidebar. You should see two: `tick` (every 5 minutes) and `dailyPurge` (every day).

Running **install** again is safe. It replaces the old timers.

## Step 7: Make the BSB label and a filter

The bridge copies **only** emails with the label **BSB**. Your other mail stays private.

1. Open **Gmail**. In the left list, scroll down and click **Create new label**. Name it `BSB` (capital letters). Click **Create**.
2. To label new mail automatically, click the **sliders** icon at the right end of the Gmail search box.
   - With a project Gmail, type the project address in **To**. Then every email sent to it gets the label.
   - With a personal Gmail, type `Byte-Sized Buddies` in **Has the words**. Replies to the website's emails carry that name.
3. Click **Create filter**, tick **Apply the label**, choose **BSB**, and click **Create filter**.
4. You can also add the label by hand: open an email, click the **label** icon, and choose **BSB**.

## Step 8: Test it

1. Send an email to the project Gmail from another address, and make sure it has the **BSB** label.
2. Wait up to 5 minutes. To skip the wait, open the script, choose **tick**, and click **Run**.
3. Open **Admin, Contact exchange**. The email shows under **Emails**, marked **Unread**.
4. Open it, write a reply, and press **Send reply**. The reply shows as **Queued**. Within about 5 minutes it changes to **Sent**, and the other address receives it in the same conversation.
5. In a private window, open your site's `/ask` page. Ask a question and give an email address you can check. Within about 5 minutes:
   - that address gets **We got your question**, with the private link, and
   - the project Gmail gets **New question from** with the question.

## Limits (all free)

| Limit | What it means |
|---|---|
| About **100 emails a day** | A regular Gmail account can send email to about 100 people a day from scripts. The bridge keeps 5 of those spare for you and stops for the day before the limit. Emails left over stay **Queued** and go out the next day. |
| **20 emails per run** | At most 20 emails every 5 minutes. |
| Up to **5 minutes** | Replies and confirmations wait for the next run. The page says so. |
| **90 minutes a day** of script time | Each run usually takes a few seconds, so this is plenty. If Google ever emails you that the script used too much time, change `everyMinutes(5)` to `everyMinutes(10)` in `install`, and run **install** again. |
| Last **7 days** every run, **30 days** once a day | An email you label today shows up within 5 minutes if it arrived this week. Older labeled emails (up to 30 days) show up after the nightly run. |
| **8,000 characters** | Long emails are cut. Open Gmail to read the rest. |

## If something goes wrong

To see what happened, click the **list** icon (**Executions**) in the script's left sidebar. Click a row to see its log.

| What you see | What to try |
|---|---|
| `Missing Script Properties: ...` | Add the names listed, in Step 4. Check the spelling: capital letters, underscores. |
| `failed: 400 ... not allowed` or `P0001` | The secret and the fingerprint don't match. Do Steps 1, 2, and 4 again (make a new secret, save the new fingerprint, replace `BRIDGE_SECRET`). |
| `failed: 404` | `SUPABASE_URL` is wrong, or the database was not built yet (`docs/DEPLOY.md`, Step 4). |
| `failed: 401` | `SUPABASE_ANON_KEY` is wrong. Copy it again from Supabase. |
| A reply says **Couldn't send** on the website | Read the reason under it. If the Gmail conversation was deleted, use **Reply from Gmail instead**. Fix the problem, then press **Try again** under "Emails that couldn't be sent". |
| Replies stay **Queued** for more than 15 minutes | The script isn't running. Check **Triggers** (Step 6) and **Executions**. |
| An email doesn't show up | Check it has the **BSB** label and isn't from your own address (the bridge skips your own mail). |
| Google emails you a "Summary of failures" | Open **Executions** to see why. One failure now and then (Google or Supabase was busy) is fine. The next run tries again. |

## If the secret leaks

If the bridge secret ever ends up somewhere it shouldn't (a chat, a screenshot, a commit):

1. Run `npm run bridge:secret` again.
2. Save the new fingerprint in Supabase (Step 2). The old secret stops working right away.
3. Replace `BRIDGE_SECRET` in Script Properties (Step 4).
4. Tell a parent or guardian.

## Turning it off

In the script, click **Triggers** and delete both timers. Your emails stay in Gmail. The website keeps the copies until you delete them. Remember that without the bridge, the free database may pause after a quiet week.
