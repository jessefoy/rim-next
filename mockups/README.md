# Mockups — design references, not shipped design

**Nothing in this folder is live.** These are explorations: standalone HTML built to look at ideas before committing to them. The site itself is the Next.js app in `app/` styled by `public/css/custom.css`.

Read that sentence twice before borrowing anything from here. In session 169 a design-system package confidently documented a hero treatment that had already been retired, and following it would have rebuilt the exact thing that was rejected. Old design files age into confident-looking misinformation. **When these files and `public/css/custom.css` disagree, the stylesheet is right.**

## What's here

| Path | What it is |
|---|---|
| `rim-home-concept.html`, `-v2`, `-v3` | Single-file home page concepts (Jul 22 – Aug 5) |
| `home/01-hero.html`, `home/01-hero-leaves.html` | Hero studies in isolation |
| `home/rim-calm/` | A full multi-page concept — home, programs, teachings, community, support, join, member dashboard |
| `RIM WEBSITE Mockups/rim-homepage-v2/` | First full-site pass |
| `… /rim-homepage-v2-refined/` | Refinement of v2 |
| `… /rim-homepage-v2-balanced/` | Balance pass, with responsive screenshots |
| `… /rim-homepage-v2-calibrated/` | Calibration pass, with screenshots and PDFs; carries `CALIBRATION-NOTES.md` |
| `programs-2026-10-14/` | Programs & Events reshaped (2026-10-14, for Jesse's review, not built): a regular-gatherings list (one row per gathering, day and time first) and a Coming up list, instead of category boxes; sections in alternating white and Pampas bands with a hairline between, as on home, and no blue-bar headers. Built on the live page's own header, footer and `custom.css` with the real programs (Dummy Test Program and the past-dated Sacred Clarity left out). `before-desktop-1280.png` is the live page that day. Measured: desktop 6.8 → 4.0 screens, phone 10.2 → 5.8 |
| `programs-2026-10-14b/` | Programs & Events, second study (2026-10-14, evening, for Jesse's review, not built): **keeps the three ways as the page's sections**, said once (the category doors, the "Taking CARE program category" labels, the boxed sections and counts gone), each section a room in alternating white and Pampas bands as on home, one plain row per program (name, one line of day · time · where, its line, "View"), a line of jump links in the hero with "All times are Central." once. Real programs from the live page that evening; Sacred Clarity left out (past-dated), taglines shown in sentence case (the data is Title Case). `before-desktop-1280.png` is the live page. Measured: desktop 5,900 → 4,926px, phone 8,837 → 6,030px |
| `registration-2026-10-23/` | Programs and Registration, thought through fresh (2026-10-23, for Jesse's review, not built). Read `CONCEPT.md` first. **`index.html` is the third version, "who's helping, who's asking":** every program has helpers (teacher, greeters, a kitchen, the registration team), every question on the form is asked by one of them, and each helper gets one page that is plainly theirs; no roster sharing or audience settings. Eight screens on the live `custom.css` with sample people: the Registration desk (one queue across programs), a program's people (new to RIM marked), start a program from a shape or a past one, the editor in sections (Who's helping, How people join with questions grouped by asker, What we tell them as a timeline), the form grouped by who's asking, and the teacher's, greeters' and kitchen's pages. `index-v2.html` is the second version (audiences and share levels), kept for comparison. `reports/` and `research_notes/` hold the market research behind it. Open a file and use the bar at the top |
| `email-2026-10-13/preview.html` | The system-email design (registration confirmation, sign-in code) rendered from the app's own wrapper on 2026-10-13, matched to Jesse's Flodesk template. `lib/email.ts` is the source of truth |
| `… /rim-homepage-v3-calm/` | The quiet direction, most complete — desktop and mobile screenshots for every page, plus `CALM-SYSTEM-REVIEW.md`, `DESIGN-REVIEW.md`, `PROGRAMS-BALANCE-REVIEW.md` |

Several carry their own review notes. Those are worth reading — they record what each pass was trying to solve.

## Why they're in the repo

They were swept in by a mistake during session 169's closing commit, and kept deliberately: they're backed up now, and they are the raw material for the ongoing home-page design work. Jesse's own words at the end of that session — *"I'm not satisfied with what we have, 100%… I still want to refine the design as we're going."*

## How to use them

- **As input to a design conversation**, not as a spec. They show directions considered, including ones set aside.
- **Check the date** against `session-log.md`. A mockup predating a shipped decision may contradict it.
- **Never copy CSS out of here into `custom.css`.** These files carry their own standalone stylesheets with their own tokens. The app's tokens live in `:root` in `custom.css` and are the only ones that count.
- The authority for what the public site actually looks like is **`RIM_Public_Pages.md`**, then the code.
