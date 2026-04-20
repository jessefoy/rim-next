# Editor Audit — Sweep 2: Sanity Schemas (Four-Type Framing)

**Status:** Draft. Review with Jesse, then freeze and move to Sweep 3 (Hub surfaces).
**Source:** Active Sanity types referenced by `lib/queries.ts` and the public page routes that consume them. Sanity Studio itself lives externally at `rooted-in-mindfulness.sanity.studio` — its schema files are not in this repo.
**Reference:** `RIM_Editor_Types.md` (canonical).

---

## How Sanity content differs from Postgres content

Sanity content has a **different authoring pipeline entirely**:

- Authored in **Sanity Studio** (external site), not in any RIM-side editor.
- Stored as **Portable Text** (Sanity's JSON block format), not BlockNote JSON.
- Rendered via `<PortableText />` from `@portabletext/react`, not the `renderRichContent` pipeline.

This means Sanity-hosted content **does not pass through the four-type model at all** today. It's a separate content stream with its own editor. The question for each type is: does it stay in Sanity, or does it migrate to Postgres + the four-type system?

**Programs, Lessons, and Courses already migrated** (sessions 72–78). The remaining active Sanity types below are candidates for the same treatment, but each needs an explicit decision.

---

## Currently active Sanity types

### `teams` (team / teacher member profiles)

**What it holds:** Name, title, slug, `bio` (Portable Text), `bioPicture`.
**Route:** `/team/[slug]` (`app/team/[slug]/page.tsx`).
**Rendering:** `<PortableText>` inside `.rich-text-block-19 w-richtext` (legacy Webflow classes).

**Drift flag:** There is a **parallel Postgres system** (`TeacherProfile` with `bio: String?`) rendering at `/teachers/[slug]`. Two live routes, two data sources, two editors. Jesse built the Postgres version in session 79 to support `ProgramTeacher` linking; the Sanity version is legacy.

**Recommendation:** **Sunset Sanity `teams`.** Migrate any Portable Text bios into the Postgres `TeacherProfile.bio` field (which Sweep 1 already marked for promotion to Message type). Delete the `/team/[slug]` route; redirect to `/teachers/[slug]`. Delete the Sanity type.

**Four-type classification (after migration):** `TeacherProfile.bio` → **Message** (from Sweep 1 Section E).

---

### `lessons` *(dead query)*

**What it holds in Sanity:** Lesson content with custom Portable Text blocks (`practiceCallout`, `bodyQuote`, `verseQuote`, `calloutText`), headerQuote, quoteSource, audio/video refs, teachers, resources.
**Status:** Migrated to Postgres `Lesson` (sessions 72–78). Query (`lessonBySlugQuery`) is defined in `lib/queries.ts` but no component imports it.
**Recommendation:** **Delete the dead query** from `lib/queries.ts`. No action in Sanity.

---

### `courses` *(dead query)*

**What it holds in Sanity:** Course name, subheading, accessLevel, `mainContentDescription`, lesson refs.
**Status:** Migrated to Postgres `Course`. Query defined but only `allCoursesWithLinkedProgramsQuery` is used by `app/api/admin/courses/route.ts` — need to verify what that endpoint actually does today.
**Recommendation:** **Audit the admin courses API endpoint.** If it's still referenced, check whether it's dead code or genuinely reading legacy Sanity data. If dead, delete the query and the endpoint. If live, note why Sanity is still being queried for courses.

---

### `glossary` (Handful of Leaves Glossary)

**What it holds:** `name`, `pali`, `sanskrit`, `synonyms`. All short strings — **no rich content today**.
**Route:** `/glossary/[slug]` (`app/glossary/[slug]/page.tsx`).
**Rendering:** Plain `<p>` tags.

**Jesse's intent (session 89):** The glossary will follow the Page Designer pattern — authored entries with rich content, composable blocks, the same template-vs-content distinction as programs and lessons.

**Recommendation:** **Migrate to Postgres.** Build a `GlossaryTerm` model with structured fields (name, pali, sanskrit, synonyms as template data) plus a `body: Json?` field holding Page Designer content. This becomes the third Page Designer placement (after programs and lessons).

**Four-type classification (after migration):**
- Structured fields (name, pali, sanskrit, synonyms) → **Template data**
- `body` (new) → **Page Designer** (`rim-content--glossary gloss-body` wrapper)

**Implementation pattern mirrors Program / Lesson migration:** Prisma model → migration script reading from Sanity → page template with template-data slots + editor-rendered body → Sanity type deprecated once migrated.

---

### `magazineArticles`

**What it holds:** `articleTitleDisplayed`, `articleContent` (Portable Text), `slug`.
**Route:** `/magazine-articles/[slug]`.
**Gating:** Members-only (requires `auth()`).
**Rendering:** `<PortableText>` inside legacy Webflow wrapper.

**Question for Jesse:** Is the magazine an active feature, or dormant "work in progress" content? The URL prefix suggests the latter, but I can't tell without you.

**Two paths:**
1. **Active / being expanded** — migrate to Postgres, make it a **Page Designer** placement. Articles get the same design-block treatment as lessons.
2. **Dormant / archival** — leave in Sanity. Mark in the catalog as "legacy Sanity type, not part of the four-type system." Plan to migrate later if it becomes active again.

**Decision needed.** My lean is (1) if you have any plans for this content; (2) if it's truly archival.

---

### `volunteerPositions`

**What it holds:** `name`, `slug`, `isOpen` boolean, `positionDescription` (Portable Text), `currentVolunteers` refs.
**Route:** `/volunteer-positions/[slug]`.
**Rendering:** `<PortableText>` inside legacy Webflow wrapper.

**Observation:** Position descriptions are typically medium-length prose describing the role, expectations, and commitment. This fits the **Message type** comfortably — prose with lists, not a Page Designer surface that needs design blocks.

**Recommendation:** **Migrate to Postgres.** Build a `VolunteerPosition` model with `name`, `isOpen`, `positionDescription: Json?` (BlockNote JSON, Message type). `currentVolunteers` becomes a relation to `User`.

**Four-type classification (after migration):**
- Structured fields (name, isOpen, currentVolunteers) → **Template data**
- `positionDescription` → **Message** (`rim-content vp-body` wrapper)

---

## Summary

| Sanity type | Status | Recommended action | Four-type classification |
|---|---|---|---|
| `teams` | Legacy, duplicated by Postgres `TeacherProfile` | Sunset Sanity; migrate bios to Postgres | `TeacherProfile.bio` → Message |
| `lessons` | Dead query (migrated) | Delete query | — (already Postgres) |
| `courses` | Mostly dead (audit needed) | Audit admin API; delete if dead | — (already Postgres) |
| `glossary` | Active, simple | Migrate to Postgres with Page Designer `body` | `GlossaryTerm.body` → Page Designer |
| `magazineArticles` | Unclear (active or archival?) | **Decision needed** — either migrate to Page Designer or leave | If migrated: Page Designer |
| `volunteerPositions` | Active | Migrate to Postgres with Message-type description | `VolunteerPosition.positionDescription` → Message |

---

## What this means for the plan

If you approve these recommendations, the Sanity side introduces two new Page Designer placements (glossary, possibly magazine) and two new migrations (glossary, volunteer positions, plus the team-sunset cleanup). These get folded into:

- **Stage 2d** (build new Page Designer blocks and migrate fields) gains: glossary migration, volunteer-position migration, magazine-article migration (if approved), team sunset + bio backfill.
- **Scope expansion:** the Page Designer roster of placements grows from two (program-description, lesson-body) to three or four (+glossary, +magazine).

These migrations don't have to happen in Stage 2d — they can be their own batch (Stage 2e or later). I'd suggest **doing the Postgres migrations after the Page Designer blocks are built** (so the Page Designer editor is ready to host the migrated content).

---

## Open questions for Jesse

1. **`teams` sunset** — agreed to delete `/team/[slug]`, redirect to `/teachers/[slug]`, migrate Portable Text bios into `TeacherProfile.bio`?
2. **`magazineArticles`** — active (migrate to Page Designer) or archival (leave in Sanity)?
3. **`courses` admin API audit** — I'll check `app/api/admin/courses/route.ts` in Stage 2a to see whether the Sanity query is still reachable or dead. No decision needed from you now.
4. **Glossary entry fields** — the current Sanity schema has `pali`, `sanskrit`, `synonyms`. Do you want to keep these exact fields on the Postgres model, or expand (e.g., `etymology`, `relatedTerms`, `firstAppearance`)? This is a design decision for the glossary page template; we can defer to Stage 2.
5. **Volunteer-position migration priority** — active recruiting or dormant? If dormant, defer the migration and mark as legacy Sanity until the volunteer program gets renewed attention.

Next: Sweep 3 — Hub system surfaces (conversations, tasks, documents, announcements, schedule, members). Same four-type framing.
