---
name: feedback-visual-bugs-verify
description: "For a UI bug on a surface I can't preview (authenticated/prod), get the actual element — a screenshot or the root cause in code — before changing CSS; don't guess-and-ship"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d8c3da4f-5226-411f-bcf8-dcacefab4894
---

When Jesse reports a visual bug on a surface I **can't see** (authenticated/prod pages; the preview-login gap means I can't drive the real app), find the *actual* problem before touching CSS — ask for a screenshot of the exact spot, or trace the root cause in the code — rather than changing styles on a hunch.

**Why:** in session 166 I guessed twice on a "formatting is off" report (first the preview iframe, then the conversation width) before Jesse clarified it was the **comment field** specifically, and the real cause turned out to be a missing global box-sizing reset ([[project-css-no-global-box-sizing]]). Each guess was a deploy. Reading the CSS load order pinned it in one shot; guessing didn't.

**How to apply:** treat a described visual symptom like any bug — reproduce or locate it precisely first. If I can't preview, a one-line "can you screenshot the exact element?" or a quick grep of the relevant CSS/layout is faster and more honest than shipping a speculative tweak. Extends [[feedback-measure-before-agreeing]] and [[feedback-surface-error-before-guessing]] into the visual domain.
