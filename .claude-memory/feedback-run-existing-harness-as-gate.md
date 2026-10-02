---
name: feedback-run-existing-harness-as-gate
description: Run scripts/check-member-redesign.cjs (the isolated dashboard test) as a pre-push gate; it fails whenever a page gains an import and had been silently broken for a commit.
metadata:
  node_type: memory
  type: feedback
  originSessionId: 03b6a02a-2411-46ed-90e9-52a9cc6e7801
  modified: 2026-10-02T21:33:08.272Z
---

Run `node scripts/check-member-redesign.cjs` before pushing any change that touches the dashboard, Zoom entry, programs, or the files they import. It is the only isolated test of the real dashboard page and of the access rule on it. It transpiles pages and throws "Unexpected dependency in test" for any import it has no stub for.

**Why:** 2026-10-02. It had been failing since the integration follow-up commit (the dashboard gained `HandfulHomeCard`, which had no stub), and nobody noticed because `tsc` and `next build` do not run it. A reviewer found it. Fixed, extended with Open entry cases, and it now passes 74 checks.

**How to apply:** `npx tsc --noEmit` and `next build` are not enough as gates. When a page I change gains an import, add its stub to the harness in the same commit, and add a case for any rule I change. Treat a red harness as a finding, not noise. Related: [[feedback-reviewer-subagent]].
