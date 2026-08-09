---
name: Sanity is on its way out (don't propose it)
description: Sanity CMS is no longer the source of truth for any active feature; remaining code references are residue, not load-bearing — do not propose Sanity for any new work
type: project
originSessionId: c5ca4e7f-fe43-42bf-b0ff-ec66825a0001
---
**Sanity is effectively retired.** It is not the source of truth for any feature Jesse actively uses, and no new work should depend on it. Don't propose Sanity Studio links in nav/sidebar UI, don't suggest moving content to Sanity, don't add new GROQ queries.

**Why:** The April 2026 Webflow + RIM Next hybrid was reversed in May 2026 (per the SUPERSEDED header on `RIM_Architecture_Directive.md`). Programs, courses, and lessons were migrated to Postgres back in earlier sessions. The remaining public-facing content types that historically came from Sanity (glossary, volunteer-positions, teams, magazine articles) are no longer being maintained there. `CLEANUP.md` item #56 lists the Sanity schemas as "future-removable" once dataset documents are confirmed unused.

**Code-level residue that still references Sanity (do NOT treat these as authoritative — they're slated for removal):**
- `lib/sanity.ts` — the Sanity client singleton
- `lib/queries.ts` — GROQ queries
- `app/glossary/[slug]/page.tsx` — public glossary page, still calls Sanity
- `app/volunteer-positions/[slug]/page.tsx` — public volunteer-positions page, still calls Sanity
- `app/api/admin/courses/route.ts` — has a stale "Phase 2" comment about fetching program names from Sanity (programs are in Postgres now)
- `@sanity/client`, `@portabletext/react`, `@portabletext/to-html` in `package.json`
- `lib/email.ts` + `lib/dateLabel.ts` comments referencing Sanity fields (the code itself reads Postgres `Program.*` fields; only the comments are stale)
- `lib/portableTextEmail.ts` — Portable Text → markdown converter still imported by `lib/email.ts` for `reminderMessage`
- `components/MemberGate.tsx` — uses `PortableText`
- `EmailTemplate.sanityNote` field + `EmailTemplateEditor` UI panel that surfaces it

**How to apply:**
- When asked to add a link, page, or content source, never reach for Sanity — pick Postgres or an existing RIM Next surface.
- When you encounter Sanity code while doing other work, flag it (don't silently leave it) but don't expand scope to remove it unless Jesse asks for a Sanity-cleanup session.
- If Jesse asks "why is X still wired to Sanity?", the honest answer is the migration is incomplete — not that Sanity is still in use.
- For comments in `lib/email.ts` / `lib/dateLabel.ts` that say "from Sanity": the code reads Postgres now; only the comments are stale.

**Adjacent fact:** Sanity Studio at `rooted-in-mindfulness.sanity.studio` still loads, but Jesse doesn't use it. Don't surface a link to it in any nav or admin UI.
