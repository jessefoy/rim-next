---
name: Visual Design Standards
description: Critical feedback on CSS/visual work — always compare against reference, use tokens, check with browser before declaring done
type: feedback
originSessionId: 254a9c01-1bef-449c-89b9-55d3af0521ea
---
When doing any visual/CSS/page design work, ALWAYS:

1. **Open the browser and compare side-by-side** with the reference (Webflow original, design image, or existing page). Never push CSS without visually verifying.
2. **Read the token list before writing any CSS** — not from memory, actually read `:root` in custom.css or CLAUDE.md's CSS Rules. Every font-size, color, font-family, and spacing value must come from a token. When a new page should match an existing page (e.g. This Week matching Programs List), read the existing page's CSS first and reuse the same tokens. Jesse should never have to correct a token mismatch.
3. **Check specificity conflicts** — global rules like `.rim-section--grey p { margin: 0 0 18px }` can silently override component styles. Use doubled-class selectors (`.lr-row .lr-name`) when components live inside rim-section wrappers.
4. **Verify container alignment** — all content should flow through `rim-container` (max-width: 1260px, padding: 0 40px). Hero sections, listing sections, and card content should share the same container boundary. Jesse strongly dislikes elements at misaligned left edges.
5. **Check every element** — font size, weight, color, spacing, border-radius, button shape, background images. Don't guess from memory; look at the actual reference.

**Why:** Session 84 — Jesse had to correct visual mismatches 5+ times (centered vs left-aligned hero, outlined vs filled buttons, square vs rounded cards, missing background image, text not centered in cards, misaligned headings). Each round cost time and money from a nonprofit. The pattern of "push and hope" without visual verification erodes trust.

**How to apply:** Before any CSS commit, take a screenshot of the deployed result and compare it against the reference. If you can't name what's different, don't declare it done.
