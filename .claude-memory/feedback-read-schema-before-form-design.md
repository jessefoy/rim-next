---
name: feedback-read-schema-before-form-design
description: "When adding form inputs for existing schema columns, read the column type before designing the empty-value semantics. UX phrasing alone doesn't tell you nullable-vs-default."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b6098eb6-0e56-4b96-9707-69840765c346
---

When a slice adds form inputs for **existing** schema columns, the first step is `grep -n "fieldName" prisma/schema.prisma` to read the column type. Only then design the form/API empty-value contract.

The two cases require different code:

- **`fieldName String?`** (nullable) — form sends `null` on empty input; API stores `null`; read-time resolution falls through to a default (e.g. `??` in a helper like `getHubCoverageCopy`).
- **`fieldName String @default("X")`** (non-null with default) — form sends empty string OR the user's typed value; API resolves blank to the *literal default* at write time so the column stays populated.

**Why:** UX phrasing like "leave blank to use the default" doesn't tell you which case applies — both produce the same user-facing behavior but the data model is different, and the wrong choice fails typecheck against the Prisma client types. In session 131 (commit `a8fbe60`, hub coverage-copy admin form), I assumed nullable from the UX framing and designed the form to send null + the API to store null. Typecheck failed against the non-nullable `coverageNoun/Verb/Action` columns; redesigning the contract took ~10 minutes of rework. The lesson is small but compounds — the same pattern shows up any time existing schema is touched.

**How to apply:**

- Before drawing the form/API contract for "add input for column X," read `prisma/schema.prisma` for column X's type.
- If `String?`: form sends `null`, API stores `null`, helper resolves at read time.
- If `String @default(...)`: form can send empty, API resolves blank → literal default at write time. Import the default literal from the helper file (e.g. `DEFAULT_COVERAGE_COPY` from `lib/programHub.ts`) rather than re-typing the string.
- This is sibling to [[feedback-server-compute-caches]] (when a stored field is a cache of source fields, server always recomputes on write) and [[feedback-raw-sql-uses-mapped-table-name]] (verify the contract before designing around it).
