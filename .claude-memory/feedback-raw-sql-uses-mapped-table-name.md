---
name: feedback-raw-sql-uses-mapped-table-name
description: "In prisma/migrate.mjs, every raw SQL string must use the snake_case table name from @@map, never the PascalCase Prisma model name — and TypeScript can't catch the difference."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7c916838-3c14-4c41-b8ec-baf098f6cd3c
---

All raw SQL in `prisma/migrate.mjs` (`db.$executeRawUnsafe`, `db.$queryRawUnsafe`) must reference the actual Postgres table name from the `@@map` directive in `prisma/schema.prisma`, NOT the PascalCase Prisma model name. The names diverge because the schema explicitly maps every model to snake_case: `model EmailTemplate { ... @@map("email_templates") }`.

**Why:** the Prisma ORM (`db.emailTemplate.findUnique`, `db.emailTemplate.create`, etc.) handles the mapping internally — these work regardless of `@@map`. Raw SQL bypasses the ORM and is sent directly to Postgres, which only knows about the actual table name. TypeScript has no view into a SQL string literal, so this error doesn't surface at compile time. It also doesn't surface during `npm run build` locally if `POSTGRES_PRISMA_URL` isn't set (the migrate step prints "skipping migrations" and moves on). It only fails when the migration actually runs against the real database — typically a Vercel production build, which means a broken deploy.

This bit me in session 119: I wrote `UPDATE "EmailTemplate"` in a defensive email-template body update, the build passed locally because no DB was attached, and Vercel deploy failed with `relation "EmailTemplate" does not exist`. Commit `17bb3ee` was the fix; `2c144a8` was the broken build.

**How to apply:**

1. Before adding raw SQL to a `prisma/migrate.mjs` entry, grep `prisma/schema.prisma` for `@@map("...")` on the model you're touching. The string inside the parens is the table name to use in raw SQL.
2. Every `UPDATE "..."`, `INSERT INTO "..."`, `SELECT ... FROM "..."`, `DELETE FROM "..."` should match an existing `@@map` entry — never a model name. The double-quotes around the identifier are correct for Postgres (preserve casing); just make sure what's inside them matches `@@map`.
3. If you're not sure whether a model has `@@map`, default to assuming yes — most models in this project do (`users`, `programs`, `email_templates`, `hub_documents`, `_migration_flags`, etc.). The few exceptions are the NextAuth-managed tables (`Account`, `Session`, `VerificationToken`) which keep their PascalCase model names. If in doubt, grep.
4. After writing raw SQL in a migration, do a quick visual scan: every quoted identifier in the SQL string should look snake_case. If any look PascalCase, that's a smell — double-check against `@@map`.

This is the same class of bug as referencing a Sanity `_type` as singular when it's plural — the ORM and the wire format diverge, and the compiler can't help. Discipline at the call site is the only catch.

Related: see [[feedback-server-compute-caches]] for another case where the stored / computed distinction has to be explicit because TypeScript can't see it.
