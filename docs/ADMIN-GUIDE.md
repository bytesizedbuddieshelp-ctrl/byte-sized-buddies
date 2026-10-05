# Admin guide: your weekly routine

This is the week of a Byte-Sized Buddies lesson, step by step. Everything happens in the admin area: sign in at `/admin` on your site.

## Once a week, a few days before the visit

### 1. Make the lesson kit in a Claude chat

1. Open a new Claude chat. Paste the prompt from `docs/KIT-FORMAT.md` ("Asking Claude to make a kit"), and add your topic, for example "Week 4: Taking a photo and sending it".
2. Read what Claude makes. Change anything that doesn't sound like you, or that your learners won't need.
3. Download `kit.json`, the worksheet PDF, the handout PDF, and any screenshots, into one folder.
4. Take the screenshots yourself on a **practice account**, with no real names, messages, or passwords on screen.

Optional: if this group often finishes early, ask Claude for one or two **extra worksheets** too (the prompt is in `docs/KIT-FORMAT.md`, "Extra worksheets").

### 2. Import it

1. **Admin, Lessons, Import a kit.** Select `kit.json` and every file it names, all at once.
2. Read the summary. Fix any **problems** (red) and look at any **things to look at** (for example a slide with more than 25 words).
3. Press **Save as draft**. Only you can see a draft.

### 3. Check it, then publish

1. Press **Preview**. Click through every slide. Read the teacher guide.
2. Press **Present** and step through it once, out loud, with the clock running.
3. When it's right, press **Publish**. It now shows on the public lesson library, and on your dashboard under **This week**.

### 4. Print

From the lesson page, open the **handout** and the **worksheet** and print one of each per learner, plus two spares. If the lesson has **Extra practice** sheets, print one or two of each per table. If the printer is slow, print the slides as a backup too (**Download slides as PDF**).

## The day of the visit

Pack: laptop and charger, phone, an HDMI cable (and a USB-C adapter if your laptop needs one), the printed handouts and worksheets, and a practice phone or tablet if you have one.

At the senior home:

1. Connect the laptop to the TV or projector.
2. On the laptop: **Admin, Dashboard, This week, Present**. Press **Open audience window**, drag it to the TV, and press **F** in it for full screen.
3. On your phone: sign in, open **Remote**, and type the 4-letter code from the laptop.
4. Press **Start the clock** when you begin. It warns you, in words, at 5 minutes left.
5. If the Wi-Fi is bad, turn on your phone's hotspot and connect both the laptop and the phone to it. If the remote still won't connect, use the laptop keyboard: arrow keys or Space, **B** for a blank screen.

The full 45-minute plan is in `docs/TEACHING-GUIDE.md`.

## Every few days

### Questions (Admin, Tickets)

1. Open **New** tickets. Read the question.
2. Write the answer in short steps. Add a YouTube video if it helps (see "Videos" below).
3. Press **Send answer**. If the person gave an email, they get the private link within about 5 minutes. If not, there's no way to reach them except the link they saved.
4. Mark tickets **Closed** when you're done. Answered tickets are deleted after about 90 days.

### Senior homes and emails (Admin, Contact exchange)

1. **Senior-home requests:** reply from the site (or Gmail), then mark them **Replied**, **Scheduled**, or **Closed**.
2. **Emails:** anything in Gmail with the **BSB** label shows here. Reply from the site, then press **Mark handled**.
3. If you see **Emails that couldn't be sent**, read the reason and press **Try again**.

## When you make a video

1. **Admin, Studio** in Chrome or Edge on your laptop. Choose the lesson.
2. Record the opener, the main part (your screen), and the closer. Download the takes you keep.
3. Upload them to YouTube as **Unlisted**, and choose "No, it's not made for kids".
4. Paste the links in **Publish**, choose the lesson or the question, and press **Save video**.
5. The first time, tick **Make this my standard opener** (and closer), so you can reuse them.

## Once a month

1. **Dashboard, Back up everything.** Keep the file somewhere private (it has people's names and emails). Not in the project folder, not on GitHub.
2. **Admin, Lessons:** check **Storage used**. See `docs/LIMITS.md` if it's over 70%.
3. Open the Gmail bridge script, click **Executions**, and check for red rows.
4. In the project folder, run `npm audit`. If it lists a problem, ask Claude Code to help fix it.

## If something looks wrong

| What you see | What to do |
|---|---|
| "Please sign in again" | Your session ended. Sign in again. Nothing you saved is lost. |
| The site says the database isn't connected | The Supabase project may be paused. Open it at supabase.com and click **Restore**. |
| No new emails for a long time | Check the Gmail bridge: `apps-script/README.md`, "If something goes wrong". |
| The remote won't connect | Check both devices are online. Press **Reconnect**. Use the keyboard as a backup. |
| A page looks broken after a change | Run `npm run check` on your computer. It tests the words, the code, the security rules, and accessibility. |
