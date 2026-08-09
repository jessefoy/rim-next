---
name: feedback-read-library-source
description: "For a hard third-party-library bug you can't reproduce locally, read the library's source and own the logic rather than shipping incremental guesses"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1303d913-99f8-4c22-b0fb-eb0ef06ff016
---

For a hard bug originating in a third-party library (LiveKit, Tiptap, Stripe, …) that can't be reproduced locally, stop guessing: read the library's actual source/mechanism, take Jesse's real-world diagnostic clues seriously (e.g. "it works after a refresh" is a strong tell), and prefer a fix where RIM **owns the logic** — compute it ourselves, in our control — over patching the library's fragile internals and hoping.

**Why:** The session-151 screen-share crash took seven rounds and TWO wrong fixes shipped-and-deployed before Claude actually read LiveKit's `CarouselLayout` source. Once read, the real fix was obvious — replace their looping/measuring layout with our own synchronous focus computation — and it held. The two earlier "fixes" were guesses against a black box; each failed deploy cost Jesse time and trust on the same unfixed symptom.

**How to apply:**
- When a library bug resists the first fix, go read that library's source before attempting a second — don't deploy another guess.
- Treat "works on refresh / works the second time / only happens when X" as a mechanism clue, not noise.
- Prefer owning the logic (synchronous compute in our own code) over depending on the library's internal timing/measuring behavior.
- Sharper sibling of [[feedback-pivot-when-fragile]] (after 2 failed fixes, change approach) — this one names the move for *library* bugs specifically: read the source, then own the logic. And don't ask Jesse to keep retesting while you guess.
