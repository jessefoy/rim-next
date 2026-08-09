---
name: feedback-no-hedged-recommendations
description: "Give the design call, not the call wrapped in a self-protective caveat. Jesse pushes back on hedges; state the recommendation and the real risk separately."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b42ffc17-a092-42d6-8a1c-4fa7c8de6a4b
  modified: 2026-08-07T22:47:27.105Z
---

When Jesse asks *"what do you recommend?"*, give the recommendation. Don't append a caveat whose function is to leave me an escape route if he disagrees.

**Triggered by:** Session 169, proposing a replacement for the home page's four category doors. I made the case, then closed with: *"a sparse version of a rich pattern reads as cheap… I think it clears the bar — but that's exactly the failure mode to watch, and it's only judgeable rendered."* Jesse: *"I'm not sure if I agree with this statement. The live site does need to match our programs. It still needs to work."*

He was right, and the caveat was worse than wrong — it was **incurious**. Thirty seconds of checking showed the live doors match the real `ProgramCategory` rows on **one of four**: they advertise "Classes & Courses," which is not a category, and omit "Silent Meditation Drop-Ins," which carries 10 of the week's 17 occurrences. The `.pl-cat` sections also have no `id`, so no category link could work at all. I had hedged about an aesthetic risk while the section was factually broken in two ways I hadn't looked for.

**Why:** a hedge attached to a recommendation reads as analysis but functions as insurance. It shifts the judgment back to Jesse while appearing thorough, and it crowds out the checking that would have produced a *real* caveat. Genuine risks are worth stating — but as their own claim, with evidence, not as a softener glued to the proposal. Compare [[feedback-full-fix-when-verified]]: Jesse takes the ambitious option when the risk is actually verified, so under-scoping out of vague caution costs the better answer.

**How to apply:**

- Make the call in one sentence, then support it.
- Before writing "but this might…", go check whether it's true. If it's checkable and I haven't checked, that's not a caveat, it's homework.
- A real risk gets its own line with the evidence behind it ("the scrim measures 2.77:1, below the 3.0 threshold"). A feeling gets left out.
- Design tombstones ([[design-principles]], `RIM_Public_Pages.md`) are for patterns actually tried and reverted. Don't invoke one as a generic worry — that cheapens the record.
- If genuinely torn between two options, say so plainly and name what would settle it, rather than recommending one and undercutting it.

Related: [[feedback-clear-seeing-is-correctness]], [[feedback-measure-before-agreeing]], [[feedback-restraint-over-new-surfaces]].
