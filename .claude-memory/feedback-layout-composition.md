---
name: feedback-layout-composition
description: "A layout pass checks composition, what each element belongs to and whether heading tiers step down clearly, not only grid edges and line lengths"
metadata:
  node_type: memory
  type: feedback
  originSessionId: fed1b4b7-de3b-49ae-bc87-82dafebcff76
  modified: 2026-10-22T20:45:35.595Z
---

On any layout or grid review, after measuring edges and characters per line, ask of every element: what does it belong to, and is it nearer its own group than its neighbours? And does each heading tier read clearly smaller than the one above it? A page can pass every edge and measure and still feel "thrown together".

**Why:** 2026-10-22, Home's Practice for real life passed my grid review (edges on the grid, measures in range) and Jesse still found it *"very thrown together and disconnected with the elements"*. The three circle names sat at 32px under a 38px heading, about 60px above their own panels but 24px from each other, so they read as a run-on row of headings; the button floated alone at the far right. He added: *"not sure why we are having a hard time being mindful of these layout elements… here it's been the hardest part to align with you."* Earlier the same day the harness had also called New to RIM's off-grid copy column "consistent within the page" while its own cards sat on the grid.

**How to apply:** For each section, run the squint test (primary, secondary, groups in order); measure label-to-own-group against label-to-neighbour gaps; compare heading sizes tier by tier (a step under about 1.25x reads as the same tier); check that an action sits with the words it serves; check that text columns share lines with the cards on the same page. Preview a fix by injecting CSS into the live page and look at it before building. Pairs with [[feedback-visual-bugs-verify]] and [[feedback-measure-the-reference]].
