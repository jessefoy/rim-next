---
name: Pivot When the Pattern Is Fragile
description: When a pattern fails repeatedly across multiple debugging attempts, propose an architectural alternative rather than continuing to debug
type: feedback
originSessionId: 49c19f2b-ec39-424e-a8e3-8bd30a74d07c
---
When a chosen approach requires multiple round-trips of debugging — and especially when those round-trips ask Jesse to do extra work (run console diagnostics, retest after multiple deploys, describe what they're seeing) — that's the signal to step back and propose an alternative architecture, not to keep iterating on the chosen approach.

**Why:** Session 97 spent multiple commits trying to make a sticky toolbar work — CSS sticky → JS sticky → capture-phase JS sticky → discovering the wrapper-mount-timing bug. Each fix unblocked one issue but exposed another. After the third failure, Jesse said: "This is inconvenient. Should we be considering something else?" That was the right prompt. Pivoting to a selection-based bubble menu (Tiptap's `BubbleMenu`, what Medium / Substack / Notion all use) solved the actual UX problem (formatting on long documents) cleanly with less code, no positioning logic, and works on mobile.

**How to apply:**

- After 2 failed fixes for the same symptom, stop and ask: "Is the pattern itself fragile, or is this a fixable bug?" Fragile patterns recur — every layout change re-breaks them. Fixable bugs converge.
- Before continuing to debug, take 5 minutes to consider what other applications solve the same problem. Modern web apps have usually arrived at the same answer for the same UX need (e.g., bubble menus for in-flow formatting, slide-up sheets for mobile pickers, IntersectionObserver for scroll-trigger). If the established pattern is different from what you're building, the established pattern is probably right.
- When you propose the alternative, lead with the user value, not the implementation cost. The pivot to bubble menu wasn't "less code to write" — it was "formatting comes to your cursor, you don't have to scroll to a toolbar."
- Don't ask Jesse to run console diagnostics more than once per debugging session. If the first diagnostic doesn't tell you the answer, the issue probably isn't a small fixable bug.
