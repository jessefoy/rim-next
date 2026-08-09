---
name: feedback-measure-the-reference
description: "When rebuilding against a live visual reference, measure its rendering (getBoundingClientRect, image luminance). Reading its text or markup reconstructs the wrong composition every time."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b42ffc17-a092-42d6-8a1c-4fa7c8de6a4b
  modified: 2026-08-07T22:47:06.379Z
---

When the task is "make this look like that," open the reference **and measure it**. Reading its copy, or even its HTML/CSS, is not enough to reproduce a composition — it gets the content right and the geometry wrong.

**Triggered by:** Session 169, rebuilding the Webflow pages into RIM Next. I archived the live site, extracted the text from each page, and built the new pages around that copy. Jesse rejected the donate page — *"it doesn't look like the design that I currently have"* — and was right. Only when I loaded the live page and ran `getBoundingClientRect` on its blocks did the real differences appear:

| | live | what I'd built from text |
|---|---|---|
| hero columns | 560 / 560 | 380 / 616 |
| statement card | 585 wide, 54px heading | 820 wide, 38px |
| blue note | 720, centred | ~700, left-aligned |
| timeline card | 530 | 490 |
| section rhythm | 130 / 120 / 140 | 96 / 68 / 68 |

The same error had already been made on the home hero (I built it dark and left-aligned; the live one is light, centred, navy) and on the split order. Three pages, one root cause. Jesse had to catch each separately.

**Why:** text tells you *what* is on the page, never *where* or *how big*. A composition is proportions, and proportions only exist rendered. Worse, a plausible-looking reconstruction hides the error — the page looks fine in isolation and only reads as wrong beside the original, which means the user does the QA I should have done. This also refines [[feedback-audit-webflow-by-html]]: fetching the HTML is the right way to check *what content exists*, and the wrong way to check *what it looks like*.

**How to apply:**

- Load the reference in the browser and measure. `getBoundingClientRect` on the handful of blocks that carry the layout: x, width, font-size, text-align, padding. Then match the numbers and re-measure to confirm.
- For text over imagery, measure the **image**, not a guess. Decode it (sharp is in `node_modules` via Next) and take a high percentile — p99, not the mean — of luminance across the band the copy occupies. A scrim sized by eye failed WCAG AA on two heroes; the bodhi-leaf footage measured p99 0.971, effectively white.
- Distrust "it looks about right." In session 169 the numbers found a 820-vs-585 card and a 38-vs-54px heading that had survived my own visual review.
- When the browser tooling is unavailable, say the composition is unverified rather than implying it matches.

Related: [[feedback-honor-the-reference]] (match the reference's shape, don't blend in content from elsewhere — this memory is the *how*), [[feedback-visual-bugs-verify]] (get the real element before touching CSS), [[feedback-measure-before-agreeing]] (measure before validating a framing).
