---
name: project-prod-db-ops
description: "Production Neon was unreachable locally in sessions 135/145, but REACHABLE on 2026-10-01 via .env.production.local; probe with SELECT 1 before assuming either way; never run npm run build locally; read prod only on request, write only with explicit approval"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5ac7e16b-8115-41a5-9e84-86fda14229e3
---

**Update 2026-10-01: reachability changed, and `CLAUDE.md` was corrected to say so.** A `SELECT 1` probe and then a read-only `SELECT` on `programs` succeeded from this machine using the `DATABASE_URL` in `.env.production.local` (a Vercel env pull in the project folder). Jesse then approved three `Program.danaMessage` writes (awakening-the-heart, good-morning-silent-meditation, good-evening-silent-meditation), done in one transaction after a snapshot and a drift check, with a whole-table diff afterward.

*Earlier finding (sessions 135 and 145):* Production Neon (the RIM Postgres) was **unreachable from this machine, even with the Bash sandbox disabled**: `node prisma/migrate.mjs` and any direct `PrismaClient` query failed with "Can't reach database server at …:5432". That was a fact about those sessions, not a property of Neon: the production URL connects from here now.

**Why `npm run build` still fails fast here:** `.env` holds a placeholder `POSTGRES_PRISMA_URL` (empty host), while the real production URL sits only in `.env.production.local`, which `next build` loads and `migrate.mjs` does not. So `npm run build` is dangerous only if the production URL reaches `migrate.mjs`, and it would then migrate production.

**How to apply (matches `CLAUDE.md` → Workflow):**
- Never run `npm run build` locally. Type-check with `npx tsc --noEmit`; `npx next build` also works (no migration step) but loads `.env.production.local`, so pages that read the DB at build time read production.
- Read production data only when Jesse asks; probe with `SELECT 1` and an 8-second timeout first, and run only what he asked for.
- Write to production only with his explicit approval of the specific records, never as a side effect. Snapshot the rows first, check for drift, write in one transaction by unique key, and show old and new text before and after, then diff the whole table against the snapshot.
- A one-time write beyond a few records still belongs in a flag-guarded block in `prisma/migrate.mjs` (runs once on the next Vercel deploy), or a temporary ADMIN-only browser tool (an `/admin/*` page and route executing server-side on Vercel) when the input should not be committed, as the session-145 Memberstack import (~1,500 members' PII, `/admin/import-legacy`, removed afterward) did.
- Validate the logic offline first: a standalone script's `--dry-run` proves the mapping against real input with no connection.

Related: [[feedback-verify-state-not-docs]] (verify the live value, don't assume).
