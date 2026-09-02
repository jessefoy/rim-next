---
name: feedback-visual-bugs-verify
description: "Measure the rendered element before AND after changing CSS — including on pages I can preview. tsc and next build prove a page compiles, not that it composes: s176 shipped 3 visual regressions that passed both. I can measure signed-in surfaces via an iframe on the production origin."
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

**Session 176 broadened this: the discipline is not only for surfaces I can't
see.** I shipped **three** visual regressions to *public* pages I could preview
freely, and every one passed `npx tsc --noEmit` **and** `npx next build`:

- A target-size `min-height` grew the whole nav bar to 60px
  ([[project-css-no-global-box-sizing]]).
- An appended `display: inline-flex` **overrode a media query's
  `display: none`**, un-hiding the desktop DONATE button on phones and pushing
  the hamburger 9px off-screen sitewide. `custom.css` is append-only, so a rule
  added at the end beats an equal-specificity rule declared earlier — including
  one inside `@media`.
- A new `.pp-page--spine` rule covered only 2 of the 7 block types that centre
  themselves, so the page it was written to fix still had a 180px jog, and one
  page had three left edges.

**The rules that follow:**

6. **A green build is not verification.** `tsc` and `next build` prove the page
   *compiles*; they say nothing about whether it *composes*. For any visual
   change, measure the rendered result — `getBoundingClientRect` after
   `await document.fonts.ready`, at 375 **and** 1280 — before calling it done.
7. **Measure the deploy, not the diff.** Appended CSS interacts with ~28,000
   earlier lines in ways reading the diff cannot show. RIM's loop is
   push-to-see, so the honest sequence is: push, wait for the deploy, re-measure
   the live page, fix what it shows. Shipping straight to `main` raises the bar
   on self-verification rather than lowering it.
8. **When a rule enumerates cases, enumerate ALL of them.** The half-applied
   spine reproduced the exact defect it existed to remove. If a fix is a list of
   selectors, grep for every member of the class first and say what the list is.
9. **A reviewer sub-agent on the staged diff catches what measurement won't.**
   It found the half-applied spine, the nav growth, and a dropped
   membership CTA before Jesse saw any of them ([[feedback-reviewer-subagent]]).

Extends [[feedback-measure-before-agreeing]] and [[feedback-surface-error-before-guessing]] into the visual domain; pairs with [[feedback-fix-the-documented-class]] (which says the harness is the answer instead of deferring).
