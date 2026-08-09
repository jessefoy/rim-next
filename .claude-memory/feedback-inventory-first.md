---
name: Inventory first when a subsystem drifts
description: Jesse's working standard — when code and design docs disagree across multiple surfaces in one subsystem, stop adding features and do a systematic inventory before reconciling
type: feedback
originSessionId: 6e92db7e-914c-41c8-a560-795cfcd2d595
---
When an area of the codebase shows drift between design docs and actual implementation across multiple surfaces (e.g., editor contexts: design doc registers X, code does Y, three discrepancies in one sweep), stop and propose a systematic inventory pass before continuing piecemeal.

**Why:** In session 89, Jesse named the root concern — "we went about this project wrong. We should have established all our components and elements, including design elements, first. We've gotten to a point where we've lost track of how everything works together and what is needed." The editor subsystem was the presenting symptom; the root pattern is that features grew one at a time, each new surface inheriting from its nearest neighbor rather than from a standard. Design docs came after the fact and the code kept moving. The result is drift nobody notices until a catalog is attempted.

**How to apply:**
- When you find 2+ drift points in the same subsystem (doc says one thing, code does another), do not silently fix them one by one.
- Propose a three-stage plan: (1) systematic inventory of every surface in that subsystem, no code changes; (2) reconciliation of drift once the full picture is known; (3) documentation that describes what *is*, not what *was supposed to be*.
- Break the inventory into small reviewable sweeps (Prisma, Sanity, hub surfaces, admin tools, public content — whatever the natural seams are). Pause between each for Jesse to review.
- When the systemic fix involves making the registry a gate (e.g., a wrapper component that refuses to mount without a registered context), flag it but do not implement until the inventory is complete.
- Do not batch inventory sweeps unless Jesse explicitly asks — the point is reviewability, not speed.
