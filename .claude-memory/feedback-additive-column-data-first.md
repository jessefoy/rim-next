---
name: feedback-additive-column-data-first
description: "Validated pattern for adding program fields: nullable columns, migrate the data first (old code ignores new columns), keep a null-fallback to the old rule in the new code, then merge. Code and data can arrive in either order."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 03b6a02a-2411-46ed-90e9-52a9cc6e7801
  modified: 2026-10-02T21:33:12.770Z
---

For a change that adds columns and changes how code reads them: add the columns nullable (additive `ADD COLUMN IF NOT EXISTS`, outside any earlier flag block), write one-time data with the approved mapping BEFORE merging the code (the old code's Prisma client selects named columns only and ignores the new ones), and make the new code fall back to the old rule wherever the new value is null. Then merge. Nothing changes for anyone at any step, and after the migration the fallback is ready to remove.

**Why:** 2026-10-02, the Category, Format and Open entry migration. It ran with no program's access changing at any moment, proved for all 20 programs before, after, and unmigrated. Jesse approved the mapping row by row and the order held up. A reviewer caught that putting a later column inside an earlier flag block would skip it on any build that had already set the flag; keep each new column's `ADD COLUMN IF NOT EXISTS` outside the flag.

**How to apply:** one-time migration script, dry run by default, drift guard on each row's `updatedAt`, a snapshot of the table, one transaction keyed by slug and `updatedAt` in raw SQL (does not bump `updatedAt`), then a whole-table diff and a fresh read-back against the approved table. The script refuses to apply unless every backfilled value equals today's behavior. Delete the script after it is verified. See [[project-prod-db-ops]].
