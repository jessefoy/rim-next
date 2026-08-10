---
name: feedback-visual-bugs-verify
description: "For a UI bug on a surface I can't preview, measure the actual element before changing CSS — and I CAN measure signed-in surfaces, by rebuilding the element's ancestor chain in an iframe on the production origin"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d8c3da4f-5226-411f-bcf8-dcacefab4894
  modified: 2026-08-10T18:11:42.306Z
---

When Jesse reports a visual bug on a surface I **can't see** (authenticated/prod pages), find the *actual* problem before touching CSS — never change styles on a hunch.

**Why:** in session 166 I guessed twice on a "formatting is off" report (first the preview iframe, then the conversation width) before Jesse clarified it was the **comment field**, and the real cause was the missing global box-sizing reset ([[project-css-no-global-box-sizing]]). Each guess was a deploy. In session 173 the opposite discipline paid: a postcss sweep of `custom.css` flagged 18 box-model candidates and **15 were false positives** — my own geometric reasoning about which ones overflowed was wrong on nearly all of them, and only measurement separated the 3 real bugs (two of which needed `overflow-wrap`, not `border-box`, so patching the pattern would have shipped a fix that fixed nothing).

**How to apply — I can measure more than I assumed:**

1. **Prefer measurement to reasoning.** `getBoundingClientRect().right > documentElement.clientWidth` over every element is the ground truth for overflow. Reasoning from the CSS ("width:100% + 40px padding must overflow") is a hypothesis, not a finding.
2. **A static sweep produces CANDIDATES, not findings.** Never report pattern matches as defects; measure each one first. Say the false-positive rate out loud when handing over a list.
3. **Signed-in surfaces are measurable without a session.** Load any same-origin page in an iframe at the target width on the *production* origin (the deployed stylesheet is already applied), clear the body, and inject the candidate's **real ancestor chain read from the component source** — parent classes matter, because a flex parent shrinks its child and a grid parent doesn't. Then inject the candidate fix and re-measure to prove it. This is what made the s173 authenticated-area audit possible; it's not a substitute for Jesse's eyes on *behavior*, but it settles geometry.
4. **Await `document.fonts.ready` and use realistic content.** Lorem text and short strings hide real bugs — both s173 email overflows were invisible with a 38-character address and only appeared at 53. A "clean" reading taken mid-font-swap or with placeholder content is a false negative.
5. **Closed UI needs opening.** A page-level sweep can't see a collapsed menu or an unmounted dialog; click the trigger in the harness first (the public mobile-menu bug hid behind this for a whole session).

Extends [[feedback-measure-before-agreeing]] and [[feedback-surface-error-before-guessing]] into the visual domain; pairs with [[feedback-fix-the-documented-class]] (which says the harness is the answer instead of deferring).
