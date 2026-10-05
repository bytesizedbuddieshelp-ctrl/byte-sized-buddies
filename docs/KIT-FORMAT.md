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
  "images": ["phone-home.png", "contacts.png"]
}
```

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
- Every picture a slide uses must be in the `images` list.

## Slides

Slides are data. The website draws them in the brand style, so every lesson looks the same, works offline, and prints cleanly.

```json
{ "layout": "title",  "title": "Calling a friend", "subtitle": "Week 1", "notes": "Welcome everyone." }
{ "layout": "idea",   "title": "The green phone", "body": ["It opens your calls."], "image": { "file": "phone-home.png", "alt": "A phone home screen with the green phone circled" } }
{ "layout": "step",   "step": 1, "title": "Tap Contacts", "body": ["Find Contacts at the bottom."], "image": { "file": "contacts.png", "alt": "The Contacts screen" } }
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

> Week 1: Calling a friend. 5 slides, 1 worksheet, 1 handout. No warnings.

Press **Save as draft**. Look at it with **Preview**, then press **Publish**.

If a lesson with the same `slug` already exists, you must confirm **Replace this lesson**. The replaced lesson goes back to a draft.

## Asking Claude to make a kit

Paste this at the start of a chat, with your topic:

> Make a Byte-Sized Buddies lesson kit about [TOPIC] for [iPhone/Android] learners. Follow `docs/KIT-FORMAT.md` exactly. Give me `kit.json`, a one-page large-print worksheet PDF, and a one-page large-print handout PDF. Use the brand voice. Keep each slide under 25 words. Add alt text to every picture. Never ask learners to type a real password.

## Exporting a kit

In **Lessons**, press **Download as a kit (zip)** on any lesson. The zip holds `kit.json` and all the files. Unzip it to share the lesson with another volunteer, or to import it into another copy of the site.
