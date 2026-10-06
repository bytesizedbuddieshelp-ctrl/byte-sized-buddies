# The lesson kit format

A **kit** is one `kit.json` file plus the PDFs and pictures it names. Make kits in a Claude chat, download the files, and import them in **Admin, Lessons, Import a kit**. The importer checks everything and tells you what to fix in plain words. Nothing goes public until you press **Publish**.

You can try it right now with `docs/sample-kit/`.

## What goes in a kit

| File | What it is |
|---|---|
| `kit.json` | The lesson details, the slides, and the teacher guide text. |
| `week-01-worksheet.pdf` | A one-page worksheet (large print). |
| `week-01-handout.pdf` | A one-page handout (large print). |
| `week-01-answer-key.pdf` | Optional. For the teacher only. |
| `week-01-extra-1.pdf`, ... | Optional. Up to 10 extra worksheets, for when there's time left over. |
| Pictures (`.png`, `.jpg`, `.webp`, `.svg`) | Screenshots used on the slides. |

Select **kit.json and every file it names, all at once**, when you import.

## kit.json

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
  "slides": { "version": 1, "slides": [ ] },
  "teacher_guide_md": "# Teacher guide ...",
  "video_script_md": "## Opener ...",
  "files": {
    "worksheet": "week-01-worksheet.pdf",
    "handout": "week-01-handout.pdf",
    "answer_key": null,
    "teacher_guide_pdf": null
  },
  "images": ["phone-home.png", "contacts.png"],
  "extras": [
    { "file": "week-01-extra-1.pdf", "title": "Extra practice: Call a second person" },
    { "file": "week-01-extra-2.pdf", "title": "Puzzle: Match the phone buttons" }
  ]
}
```

`extras` is optional. Leave it out if the lesson has no extra worksheets.

### The lesson details

| Field | Rule |
|---|---|
| `slug` | The lesson's web address. Lowercase letters, numbers, and single dashes. Unique. |
| `week_number` | A whole number from 1 to 200. |
| `title` | 1 to 120 characters. Sentence case. |
| `summary` | One line, up to 400 characters. |
| `topic` | A short phrase. |
| `devices` | Any of `iphone`, `android`, `any`. |
| `level` | `beginner` or `intermediate`. |
| `duration_minutes` | 5 to 240. Normally 45. |
| `objectives` | Up to ten short lines. |
| `license` | Normally `CC BY-SA 4.0`. |

### Files and images

- Every file named in `files` and `images` **must be selected** with `kit.json`.
- PDFs must be real PDFs. Pictures must be real pictures. A renamed file is refused.
- File names use letters, numbers, dots, and dashes. **No spaces.**
- Each file is under 10 MB. A PDF over 5 MB gets a warning.
- SVG pictures must be plain drawings. Ones with code or links to other websites are refused.
- Every picture a slide uses must be selected with `kit.json`. Names are matched loosely: `Contacts.JPG` counts for `contacts.png`, and `contacts_screen.png` for `contacts-screen.png`. The importer says which picture it used for which name. If two pictures could match, it doesn't guess.
- Names with spaces or odd characters (like Mac screenshots) are cleaned automatically: spaces become dashes.
- Each extra worksheet in `extras` needs a `file` (a PDF that is selected with `kit.json`) and a `title` of 80 characters or fewer. Each one needs its own file. Up to 10.

## Slides

Slides are data. The website draws them in the brand style, so every lesson looks the same, works offline, and prints cleanly.

```json
{ "layout": "title",  "title": "Calling a friend", "subtitle": "Week 1", "notes": "Welcome everyone." }
{ "layout": "idea",   "title": "The green phone", "body": ["It opens your calls."], "image": { "file": "phone-home.png", "alt": "A phone home screen with the green phone circled" } }
{ "layout": "step",   "step": 1, "title": "Tap Contacts", "body": ["Find Contacts at the bottom."], "image": { "file": "contacts.png", "alt": "The Contacts screen" } }
{ "layout": "step",   "step": 2, "title": "Compare the screens", "body": ["Find the plus button."], "images": [{ "file": "iphone-contacts.png", "alt": "Contacts on an iPhone" }, { "file": "android-contacts.png", "alt": "Contacts on an Android phone" }] }
{ "layout": "tryit",  "title": "Try it now", "body": ["Find a name. Tap it."], "timer_minutes": 5 }
{ "layout": "recap",  "title": "Today you learned", "bullets": ["Open Contacts.", "Tap a name.", "Tap the green phone."] }
{ "layout": "keepit", "title": "Keep it", "body": ["Take your handout home."] }
```

| Layout | What it looks like | Needs |
|---|---|---|
| `title` | Dark green slide with the logo and a yellow bar. | `title`. Optional `subtitle`. |
| `idea` | One idea. A picture on the right, if there is one. | `title`, `body`. |
| `step` | A big yellow number, the step, and a picture that fills about half the slide. | `step` (a number), `title`. |
| `tryit` | A yellow "Try it" panel, and an optional countdown. | `title`, `body`. Optional `timer_minutes` (1 to 60). |
| `recap` | Up to four checked lines. | `title`, `bullets` (one to four). |
| `keepit` | A soft green panel for the take-home. | `title`, `body`. |

**Photos:** `idea` and `step` slides have a photo spot. Use `"image"` for one photo, or `"images"` for up to **four** (a list of `{"file", "alt"}`). One photo fills the spot, two sit side by side, and three or four make a grid. Every photo needs `alt` text and must be in the kit's `images` list. You can also add and order photos in the lesson editor (**Photos on this slide**, under the slide preview).

Every slide may have `notes`: your speaker notes. The audience never sees them.

**Rules of thumb**

- One idea per slide. Keep `body` under **25 words**, or the importer warns you.
- Give every picture `alt` text: a few words saying what is in it.
- Slide text is shown at 44 pixels or bigger on a 1920 by 1080 screen. Short lines work best.
- Use the voice from the brand book: short sentences, everyday words, no "easy" or "just".

## What the importer says

**Errors** stop the import. Examples: a file named in the kit was not selected; a slide has no title (it names the slide number); a PDF is not a real PDF.

**Warnings** do not stop the import. They are: a slide body over 25 words, a picture with no alt text, a PDF over 5 MB, a missing handout, a missing worksheet, a picture that no slide uses.

When the kit is good you will see a summary like:

> Week 1: Calling a friend. 5 slides, 1 worksheet, 1 handout, 2 extra worksheets. No warnings.

Press **Save as draft**. Look at it with **Preview**, then press **Publish**.

If a lesson with the same `slug` already exists, you must confirm **Replace this lesson**. The replaced lesson goes back to a draft.

## Asking Claude to make a kit

Paste this at the start of a chat, with your topic:

> Make a Byte-Sized Buddies lesson kit about [TOPIC] for [iPhone/Android] learners. Follow `docs/KIT-FORMAT.md` exactly. Give me `kit.json`, a one-page large-print worksheet PDF, and a one-page large-print handout PDF. Use the brand voice. Keep each slide under 25 words. Add alt text to every picture. Never ask learners to type a real password.

## Extra worksheets (for when there's time left over)

Some groups finish early. Some learners want more. Extra worksheets give everyone something useful to do without starting a new topic. They show on the lesson page under **Extra practice**, after the main downloads.

**What an extra worksheet contains**

- **The same skill as the lesson, a little further.** No new topic. For "Calling a friend", that might be calling a second person, or calling back a missed call.
- **One page, large print, the worksheet template** (`brand/teaching-materials.md`): title in forest green, 18-point text or bigger, 0.75-inch margins, and the footer "Byte-Sized Buddies · Free to print and share".
- **3 to 5 tasks**, each with a checkbox for "I did it" and room to write.
- **One of these kinds**, written at the top so you can choose quickly:
  - **More practice:** the same steps again, with a small change.
  - **Go further:** one step past the lesson (for example, adding a contact to Favorites).
  - **Puzzle:** match, circle, or fill in. Good for groups, and no device needed.
  - **Teach-back:** "Show a neighbor how to..." with a short checklist.
- **The safety rules:** no real passwords, practice accounts only, and the scam reminder if the topic touches money, messages, or calls.
- **A "Need help?" line** at the bottom: ask a family member, staff, or us at the next visit.

**Asking Claude for extra worksheets**

Paste this into the same chat where you made the kit (so Claude knows the lesson), or into a new chat with your `kit.json`:

> Make [2] extra worksheets for the Byte-Sized Buddies lesson "[LESSON TITLE]" (week [N]), for groups who finish early. Each one is a one-page, large-print PDF using the worksheet template in `brand/teaching-materials.md`: 18-point text or bigger, 0.75-inch margins, title in forest green (#2F5D50), and the footer "Byte-Sized Buddies · Free to print and share". Make one "More practice" sheet and one "Go further" sheet [or: Puzzle / Teach-back]. Each has 3 to 5 tasks with a checkbox and room to write. Stay on the same skill as the lesson; don't start a new topic. Use the brand voice: short sentences, everyday words, never "easy", "just", or "simply". Never ask learners to type a real password. Name the files `week-[NN]-extra-1.pdf` and `week-[NN]-extra-2.pdf`. Then give me the updated `kit.json` with an `"extras"` list, following `docs/KIT-FORMAT.md`.

Then import the kit again (choose **Replace this lesson**), or add the PDFs one at a time in **Admin, Lessons, Edit, Extra worksheets**.

**Using them in class:** print one or two copies of each per table. Hand them out during **Try it** to anyone who finishes early, or use them in place of the worksheet if the group is quick.

## Exporting a kit

In **Lessons**, press **Download as a kit (zip)** on any lesson. The zip holds `kit.json` and all the files. Unzip it to share the lesson with another volunteer, or to import it into another copy of the site.
