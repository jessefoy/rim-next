---
name: project-prod-db-ops
description: "Production Neon is unreachable from this machine; one-time prod DB operations must run on Vercel, not locally"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5ac7e16b-8115-41a5-9e84-86fda14229e3
---

Production Neon (the RIM Postgres) is **unreachable from this machine — even with the Bash sandbox disabled** (confirmed sessions 135 and 145). `node prisma/migrate.mjs` and any direct `PrismaClient` query fail with "Can't reach database server at …:5432". Vercel's build/runtime is the only place that reaches it.

**Why:** It isn't a Claude-sandbox restriction (it fails sandbox-off too) — Neon only accepts connections from Vercel's environment. Consequence: `npm run build` can't run end-to-end locally (the `migrate.mjs` step dies before `next build`); type-check with `npx tsc --noEmit` instead.

**How to apply:** For a **one-time production DB operation** (data migration, bulk import, backfill, cleanup), don't write a local script expecting to run it — it can't connect. Run it where the DB lives:
- a **flag-guarded block in `prisma/migrate.mjs`** (runs once on the next Vercel deploy — the established pattern), or
- a **temporary ADMIN-only browser tool** (an `/admin/*` page + route that executes server-side on Vercel) when the input shouldn't be committed to git — e.g. the session-145 Memberstack import of ~1,500 members' PII used `/admin/import-legacy`, then removed it.

Validate the *logic* offline first: a standalone script's `--dry-run` (parse + classify, no DB) proves the mapping/algorithm against real input with no connection; then port the write path to the on-Vercel vehicle. Related: [[feedback-verify-state-not-docs]] (verify the live value, don't assume).
