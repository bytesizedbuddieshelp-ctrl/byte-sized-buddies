# Putting Byte-Sized Buddies online

This guide has two parts. Part 1 (Cloudflare hosting) is already done. Part 2 sets up the database and the owner login.

**Rules for this guide**

- **Never paste a password, key, or token into a chat.** Not into Claude, not into anyone. Type or paste them only into the website or file named in the step.
- Some services want an adult to own the account. **Check each service's age rules**, and ask a parent or guardian to own the account if it says so.
- Everything here is free. If a screen asks for a credit card, stop and ask a parent or guardian.

---

## Part 1: Hosting on Cloudflare (done)

Cloudflare builds and publishes the site every time you push to GitHub (`main` branch). Your project is `byte-sized-buddies` under **Workers & Pages**.

You will come back here in Part 2, step 9, to add three build variables.

---

## Part 2: The database and the owner login (Supabase)

Supabase holds the form answers, tickets, and your login. The free plan is enough: about 500 MB of database, 1 GB of file storage, and 5 GB of traffic each month. A project that nobody visits for about a week is **paused**. You can wake it with one click, and the Gmail bridge (Phase 5) keeps it awake.

### Step 1: Make an account and a project

1. Go to **supabase.com** and click **Start your project**. Sign in with GitHub or an email. Check the age rules, and use a parent or guardian's account if needed.
2. Click **New project**.
3. Fill in:
   - **Name:** `byte-sized-buddies`
   - **Database password:** click **Generate a password**. Save it in a password manager or write it on paper. You will almost never need it. **Do not paste it anywhere else.**
   - **Region:** choose the one nearest to you.
   - **Plan:** Free.
4. Click **Create new project**. Wait a few minutes until the dashboard opens.

### Step 2: Turn off public sign-ups

Anyone on the internet could otherwise create an account. We want exactly one account: yours.

1. In the left menu click **Authentication**.
2. Open **Sign In / Providers** (it may be called **Providers**).
3. Find the setting **Allow new users to sign up** and turn it **off**. (It is under **User Signups** or under **Email**, depending on the dashboard version.)
4. Click **Save**.

### Step 3: Create your owner login

1. In the left menu click **Authentication**, then **Users**.
2. Click **Add user**, then **Create new user**.
3. Type your email and a **long, unique password**. Save the password in a password manager.
4. If you see **Auto Confirm User**, tick it. Click **Create user**.

> **About copying SQL:** only paste the SQL itself. If you ever see lines that start with three backticks (` ``` `), leave those lines out, because they only mark the code block in this guide. If the editor says `syntax error at or near "```"`, that is what happened. The SQL in Steps 4 to 6 is also saved as plain files in the `supabase/` folder, which have no such lines.

### Step 4: Build the database

1. In the left menu click **SQL Editor**, then **New query**.
2. Open the file `supabase/schema.sql` from this project on your computer. Select everything (Cmd+A on a Mac, Ctrl+A on Windows), copy it, and paste it into the editor.
3. Click **Run**. You should see **Success. No rows returned.**
   - If you see an error, copy the error text only (no keys) and ask Claude.
4. Click **New query** again. Paste the whole of `supabase/seed.sql`. Click **Run**.

### Step 5: Tell the database that you are the owner

1. Open the file `supabase/step5-make-me-owner.sql` on your computer.
2. Change `YOUR-EMAIL-HERE` to the email from Step 3. Keep the quote marks.
3. Select everything, copy it, and paste it into a new query in the SQL Editor. Click **Run**.
4. At the bottom you should see **one row**. If you see none, the email did not match. Check the spelling.

### Step 6: Save your site address

The emails we send contain a link to your site, so the database needs to know the address.

1. Open the file `supabase/step6-site-address.sql`.
2. Change `https://YOUR-SITE-ADDRESS` to your real address, such as the `workers.dev` address from Cloudflare, with no slash at the end. Keep all the quote marks.
3. Copy everything into a new query and click **Run**. The last line shows your address.

### Step 7: Find your project address and key

You need two things: the **Project URL** and the **Publishable key**.

**The Project URL** looks like `https://abcdxyzqwerty.supabase.co`. Supabase moves it around, so use whichever of these you can find:

- **From the address bar.** While you are inside your project, the web address looks like `supabase.com/dashboard/project/abcdxyzqwerty`. The last part is your **project ID**. Your Project URL is `https://` + the project ID + `.supabase.co`.
- **The Connect button.** On the project's home page, click **Connect** at the top. The window shows the Project URL.
- **Project Settings.** Click the gear icon, then **Data API** (or **API**). The URL is at the top. The project ID is also under **General**.

**The Publishable key** starts with `sb_publishable_`. Find it under **Project Settings**, then **API Keys**. (Older projects show an `anon` key that starts with `eyJ`. That works too.)

These two are **meant to be public**. Anyone can see them in a website's code, and the database rules protect your data.

**Never use the Secret key or the service_role key.** Never copy them anywhere. If you ever do, tell a parent or guardian and reset the key on the same screen.

### Step 8: Put them in a `.env` file on your computer

1. In the project folder, make a copy of `.env.example` named `.env`. In a terminal: `cp .env.example .env`
2. Open `.env` in your editor and fill in:

   ```
   PUBLIC_SUPABASE_URL=https://abcdxyz.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
   PUBLIC_SITE_URL=https://YOUR-SITE-ADDRESS
   ```

   (The variable is called `ANON_KEY` for historical reasons. Put the publishable key there.)
3. Save. The file `.env` is private and git ignores it. **Never commit it.**

### Step 9: Put the same three values in Cloudflare

1. Go to **dash.cloudflare.com**, then **Workers & Pages**, then your `byte-sized-buddies` project, then **Settings**.
2. Find **Variables and secrets** in the **Build** section (not the "Runtime" one).
3. Click **Add** three times:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `PUBLIC_SITE_URL`
4. Click **Deploy** or **Save**. Then go to **Deployments** and retry the latest build so the new values are used.

### Step 10: Tell Supabase your site address (optional but tidy)

1. In Supabase, click **Authentication**, then **URL Configuration**.
2. Set **Site URL** to your site address. Click **Save**.

### Step 11: Test it

1. In the project folder run `npm run check:rls`. Every line should say `PASS`. (If a line says `FAIL`, stop and ask Claude. If the sign-up line failed, delete the extra user it made under **Authentication**, **Users**.)
2. Run `npm run dev` and open <http://localhost:4321/ask>. Send a test question.
3. Open <http://localhost:4321/admin>, sign in, and open **Tickets**. Your test question should be there. Answer it, then open the private link.
4. Open your live site in a **private window** and try the same, to see what a stranger sees.

### Step 12: Turn on the phone remote (Phase 4)

The remote sends messages between your laptop and your phone over a **private** channel. A database rule makes sure only you can use it. Without the rule, the remote refuses to connect, on purpose, so a stranger who guesses the 4-letter code can't read your notes or move your slides.

1. Open the file `supabase/realtime-remote.sql` on your computer.
2. Select everything, copy it, and paste it into a new query in the Supabase SQL Editor. Click **Run**. You should see **Success. No rows returned.** It is safe to run again.
3. If the remote says "isn't allowed yet", the rule is not in place. Run this step again.

**Using it**

1. On your laptop, open **Admin, Present**, choose a lesson, and press **Open audience window**. Drag that window to the TV or projector and press **F** in it.
2. On your phone, sign in at `/admin`, open **Remote**, and type the 4-letter code from the presenter screen.
3. Use the big **Next** and **Back** buttons. Keep the phone page open.
4. If the Wi-Fi is bad, use your phone as a hotspot for the laptop and the phone, or use the keyboard on the laptop: arrow keys or Space, B for blank, F for full screen.
5. Closing the presenter window ends the code. The next time you present, you get a new code.

### If something goes wrong

| What you see | What to try |
|---|---|
| A form says "isn't connected yet" | The three variables are missing. Check Step 8 (computer) or Step 9 (live site). Restart `npm run dev` after editing `.env`. |
| "That email or password didn't work" | Check the user exists under **Authentication**, **Users**. Retype the password. |
| You sign in but see "This account can't use the admin area" | The owners row is missing. Repeat Step 5. |
| The project is paused | Open the project in the Supabase dashboard and click **Restore**. |

### Resetting everything

To start over, run `drop schema public cascade; create schema public;` in the SQL Editor, then repeat Steps 4 to 6. **This deletes all data.** Do not do it on a live site.
