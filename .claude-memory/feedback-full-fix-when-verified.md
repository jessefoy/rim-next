---
name: feedback-full-fix-when-verified
description: "Offered a safe-slice vs a full clean fix, Jesse picks the full fix when the risk is verified first; prefers the correct end-state over a minimal patch"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1303d913-99f8-4c22-b0fb-eb0ef06ff016
---

When a change can be a minimal safe-slice or a fuller "correct end-state" fix, Jesse leans to the **full clean fix** — *provided the risk is actually verified first* (read the gates/callsites, don't assume). He'd rather take on the bigger-but-right change than ship a patch that leaves the underlying thing half-built.

**Why:** Session 153 — offered (a) ship the Teams panel with host-team locked behind the HOST role (minimal, safe) vs (b) fully retire the plain HOST role so host-team is membership-driven (the real fix). He chose (b). It was the right call *because* the host-capability gates were verified to already run off membership before the role was retired — the ambition was earned by the verification, not reckless. Same instinct on monthly recurrence: build the general capability, not a per-program patch.

**How to apply:**
- When presenting options, don't default to the smallest slice out of caution. If you can verify the core is safe (read the actual gates/callsites — [[feedback-verify-state-not-docs]]), offer the full clean fix and recommend it.
- Pair the ambition with the proof: "here's the complete fix, and here's why it's safe." Caution that isn't backed by a real, named risk reads as under-delivering.
- Conversely, if you can't verify safety, say so and offer the slice — the rule is "full fix *when verified*," not "always full fix."
- Relates to [[feedback-measure-before-agreeing]] (measure before deciding) and [[feedback-pivot-when-fragile]].
