---
name: feedback-jesse-co-edits
description: "Jesse edits and commits to the same repo between turns; verify the working tree before committing and don't assume your last-known value is current"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5ca4b53d-026b-4508-ad83-c16623e03018
---

Jesse works hands-on in the same repo and commits directly to `main` between turns — during the session-148 design pass he authored the warm-ground commit (`a1e85b2`) himself, and the working tree was already dirty at session open. The repo state is **shared**, not mine alone, and our commits interleave on `main`.

**Why:** my last-known state can be stale by the time I act. A value I "remember" setting may have been changed by Jesse (I almost wrongly claimed I'd "missed" applying the warm background when he'd done it himself — a re-grep before claiming saved the false statement). And a broad `git add` can sweep his uncommitted edits into my commit, or my push can land between his commits.

**It has already happened once.** Session 169: I ran `git add -A` for a docs-only closing commit and swept in Jesse's untracked `mockups/` directory — 173 files, ~17 MB of in-flight home-page design work he had deliberately left untracked all session — under a commit message reading *"Docs only; no code change."* Pushed before I noticed. Nothing was lost, but the decision to version his work was his to make, and the commit message became false. This memory already contained the rule; I simply didn't apply it.

**How to apply:** before editing a token/value, re-grep its *current* value rather than trusting memory of it. **Never `git add -A` or `git add .` in this repo — stage explicit paths** (`git add app public/css/custom.css`), which also keeps the commit message honest about scope. Before committing, run `git status --short` + a scoped `git diff` to confirm the staged change is only mine and nothing of his rides along. Fast-forward merges stay clean only because our commits don't overlap — keep checking. Reinforces [[feedback-verify-state-not-docs]]; pairs with [[feedback-merge-by-default]].
