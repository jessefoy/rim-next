---
name: feedback-merge-by-default
description: "After implementation work on a claude/* worktree branch passes type-check and is pushed, merge to main and push by default — don't leave the branch hanging for Jesse to discover."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 88d253ec-6b89-461b-9f79-216d987cee96
---

After Jesse has approved a plan and the resulting implementation has been committed and pushed to a `claude/*` worktree branch, **merge to `main` and push** as the closing step of the work — do not stop at "branch is on origin, want me to merge?"

**Why:** Jesse has been bitten by this multiple times — he goes looking for the changes on production (or on `main` on GitHub) and finds the repo unchanged because the work is still on a feature branch. The plan-mode approval already authorized the work; adding a second confirmation gate between work-done and work-shipped creates friction and exactly this kind of confusion. The pattern is: plan → approval → implement → push → merge → tell Jesse what's live, not plan → approval → implement → push → ask if it's okay to merge.

**How to apply:**

- **Default after a successful push:** `git push origin <branch>:main` (fast-forward) → `git push origin --delete <branch>` → state what's now live in production.
- **Exceptions where you should pause before merging:**
  - The preview build is genuinely failing for reasons that aren't a trivial follow-on fix.
  - The work is uncertain, half-done, or you flagged open questions in the plan.
  - The change is risky (production-data migration, irreversible, etc.) and the plan acknowledged that.
- **If main is somehow ahead of the branch** (you pulled mid-session, conflicts exist), don't force — surface and pause.
- **Worktree mechanics:** from a worktree on `claude/*`, `git push origin <branch>:main` works without needing to check out main locally. Pair with `git push origin --delete <branch>` for cleanup (matches the session 116 "merged and deleted on origin" pattern).

This is feedback received during session 117 after the LiveKit session-room fix pass — Jesse asked "can we prevent this from happening?" after going looking for the changes and finding `main` unchanged.
