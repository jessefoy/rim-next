---
name: Server-compute caches; never trust client values for derived fields
description: When a stored field is meant to be a cache of source fields, the server should always recompute on write. Don't try to detect "is this an override" by comparing stored vs. computed — that pattern silently freezes labels at first save.
type: feedback
originSessionId: 1eea4b5f-8fe2-41ae-be72-3d42dc981c5e
---
When a stored field is conceptually a cache of source fields (e.g. `Program.timeText` = derived from `startDatetime` + `endDatetime`; `Program.dateText` = derived from recurrence + start), the server should always recompute it on write. Do not store it as "user-typed value if dirty, else auto-computed value" with a "dirty" flag inferred at load by comparing stored vs. computed.

**Why:** Session 109 fix. The original design was an editor input that was either auto-filled from source fields or manually overridden by the user. To distinguish on next load, the editor compared `stored == computed` — match meant auto-managed (keep refreshing), mismatch meant manual override (leave alone). Bug: the editor wrote the auto-computed value back to the DB on every save. So at save time `stored == computed`, but later (after a `startDatetime` change) `stored != computed` triggered the dirty check and falsely marked the row as a manual override. Labels froze at whatever the source fields were at first save. Real-world symptom: a program's public listing showed 9:30 AM for months after the actual time was changed to 8:15 AM in the editor.

**How to apply:**
- For any field that's a derived cache of others, recompute server-side in the POST/PUT handlers and ignore whatever the client sends for that field. Editor inputs become read-only previews — the input is no longer the source of truth.
- For partial updates (PUT), read the existing row and merge with the body for source fields, then recompute. Don't trust the client to send all source fields just because a derived field needs refreshing.
- If a true "manual override" feature is needed, it requires an explicit boolean flag on the model (e.g. `timeTextOverride: Boolean`). Inferring intent from a stored-vs-computed comparison is a footgun.
- Add a one-shot drift-recovery migration that recomputes for every existing row and writes only when the cached value disagrees. Cheap, idempotent — safe to leave in place as ongoing insurance.

**Code to mirror:** `lib/programUtils.ts` (`computeTimeText`, `computeDateText`), `app/api/programs-pg/route.ts` (POST), `app/api/programs-pg/[slug]/route.ts` (PUT), `prisma/migrate.mjs` (`recache_program_date_time_text` entry).
