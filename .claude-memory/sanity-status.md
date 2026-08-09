---
name: sanity-status
description: "Sanity is FULLY retired (verified session 171, 2026-08-09): no @sanity deps, no lib/sanity.ts / lib/queries.ts, no code reads it. Don't propose it; all content lives in Postgres. Remaining: dashboard teardown ops (backlog 2026-08-09-001) + the vestigial sanityNote column rename (2026-08-08-001)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4191d0e2-2a15-4ac6-b38f-562c72d6ecc2
  modified: 2026-08-09T15:42:48.003Z
---

**Sanity is fully retired — verified in code, session 171 (2026-08-09).**
`package.json` has no `@sanity/*` or `next-sanity` dependencies; `lib/sanity.ts`
and `lib/queries.ts` do not exist; repo-wide grep finds no live reads. (An
earlier version of this memory claimed residue in those files and two public
routes — that was true once, but the removal outpaced the note.) All content —
programs, courses, lessons, teams, glossary — lives in Postgres.

What remains, tracked in the repo:
- **Dashboard ops** (backlog `2026-08-09-001`): remove `SANITY_*` Vercel env
  vars; export + delete project `xxgvfpjf` and the Studio — Jesse's call, his
  dashboards.
- **The `EmailTemplate.sanityNote` column** is vestigial-named (the callout it
  holds now points at the Program Manager — session 171 migration); rename is
  backlog `2026-08-08-001`.

**How to apply:** never propose Sanity for new work; treat any doc or comment
presenting it as live as staleness to fix (CLAUDE.md and
`RIM_Stack_Reference.md` were both purged session 171). Authority for what the
stack IS: `RIM_Stack_Reference.md`. Relates to [[project-architecture-pivot]].
