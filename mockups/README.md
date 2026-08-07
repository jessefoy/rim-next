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
| `… /rim-homepage-v3-calm/` | The quiet direction, most complete — desktop and mobile screenshots for every page, plus `CALM-SYSTEM-REVIEW.md`, `DESIGN-REVIEW.md`, `PROGRAMS-BALANCE-REVIEW.md` |

Several carry their own review notes. Those are worth reading — they record what each pass was trying to solve.

## Why they're in the repo

They were swept in by a mistake during session 169's closing commit, and kept deliberately: they're backed up now, and they are the raw material for the ongoing home-page design work. Jesse's own words at the end of that session — *"I'm not satisfied with what we have, 100%… I still want to refine the design as we're going."*

## How to use them

- **As input to a design conversation**, not as a spec. They show directions considered, including ones set aside.
- **Check the date** against `session-log.md`. A mockup predating a shipped decision may contradict it.
- **Never copy CSS out of here into `custom.css`.** These files carry their own standalone stylesheets with their own tokens. The app's tokens live in `:root` in `custom.css` and are the only ones that count.
- The authority for what the public site actually looks like is **`RIM_Public_Pages.md`**, then the code.
