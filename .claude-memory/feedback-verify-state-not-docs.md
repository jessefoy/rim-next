---
name: feedback-verify-state-not-docs
description: "Don't assert a user's role/account/system state from documentation prose — verify the live value (DB/UI), or say you haven't"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 94483463-f568-4d79-9898-4d482e6367a8
---

When a claim depends on **current state** — a user's roles, a feature flag, a membership, an env var, who holds what — verify the actual value before stating it as fact. Documentation describes *intent*, not *current truth*, and the two drift.

**Why:** In session 135 I twice told Jesse he "was" a GUIDING_TEACHER because `RIM_Role_Design.md` said the role was "currently held only by Jesse." That was prose, not data — and it turned out to be the crux of his confusion: he couldn't access the Course Hub precisely because the role likely wasn't on his record, AND the role wasn't even assignable through the member UI (DB-console-only). Asserting state from a doc sentence sent the whole thread down a wrong assumption. The fix was to (a) stop claiming it, (b) surface the role where it's actually managed, and (c) let the real DB value become visible.

**How to apply:**
- A claim about state → check the live source (Prisma/DB, the admin UI, the actual env). The `Role` enum + `User.roles` column is the truth for roles; `RIM_Role_Design.md` is not.
- If you *can't* verify (e.g., the DB is unreachable from the sandbox — Neon was, twice this session), say so plainly and frame the claim as an assumption, never as fact.
- High-privilege or load-bearing state should be **visible where it's managed**, not hidden in a DB console — invisible state is unverifiable and unauditable. Surfacing it is part of the fix, not a nicety.

Related: [[feedback-measure-before-agreeing]] (measure before validating a framing), [[feedback-inventory-first]] (systematic check before acting).
