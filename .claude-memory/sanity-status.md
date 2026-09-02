---
name: sanity-status
description: "Sanity is retired in CODE (s171) but was still a live dependency in DATA until s176, when 6 program hero images on cdn.sanity.io were re-hosted to Vercel Blob. The project is now safe to delete. Lesson: 'retired in code' is not 'no live dependency' — grep the DATA before deleting an external service."
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

**Session 176 correction — it was still load-bearing, in DATA.** This memory
said "fully retired, verified in code" and listed only dashboard ops as
remaining. That was true of the code and **false of the site.** A measured
audit of the public pages found **6 of 12 `Program.programImage` values still
pointing at `cdn.sanity.io`** — so deleting the project, the one remaining
teardown step, would have broken half the program catalogue's most visible
surface. Nothing in the repo could have revealed this: the URLs are rows in
Postgres, not code. Fixed by migration `rehost_sanity_program_images_v1`
(re-hosted to Vercel Blob under `program-images/<slug>`, rows repointed, ran
clean on deploy, verified 0 `cdn.sanity.io` references on any public page).
**The project is now genuinely safe to delete.**

**The durable lesson, which generalizes past Sanity:** *"retired in code" is
not "no live dependency."* A service can be gone from `package.json`, every
import, and every doc while its URLs still sit in database columns, editor
rich-text, or email templates — placed there by a human through a CMS, so no
grep of the repo will find them. **Before telling Jesse an external service is
safe to cancel or delete, check the data too**: query the columns that hold
URLs (`programImage`, `heroImage`, `heroImageUrl`, `photoUrl`), and where the
prod DB is unreachable ([[project-prod-db-ops]]), crawl the public pages and
grep the rendered HTML for the vendor's host — which is exactly how these six
were found. Applies to Captivate.fm audio, Fillout embeds, Flodesk, and the
Webflow assets as that cutover proceeds.

**How to apply:** never propose Sanity for new work; treat any doc or comment
presenting it as live as staleness to fix (CLAUDE.md and
`RIM_Stack_Reference.md` were both purged session 171). Authority for what the
stack IS: `RIM_Stack_Reference.md`. Relates to [[project-architecture-pivot]]
and [[feedback-verify-state-not-docs]].
