# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Editor system reorg — Stage 2d (session 89 closed, 2026-04-20)

Session 89 was a structural reorg of how authored content is modeled across the platform. A new canonical reference (`RIM_Editor_Types.md`) was established, the editor registry was rewritten around four editor types, the abandoned session-reflection module was deleted, and several Sanity surfaces were cleaned up. All foundational / non-user-visible work is done. The high-value work — making the Page Designer pattern real via custom design blocks that replace hard-coded template fields — is Stage 2d and is the next session's focus.

### Required reading for this session (before writing any code)

1. **`RIM_Editor_Types.md`** — the canonical reference. Four editor types, template-vs-content distinction, output destinations, block library concept, four-phase block creation procedure, placement registry. This document supersedes the older `RIM_Editor_Design.md`.
2. **`editor-audit/05-public-content.md`** — final Stage 1 sweep; has the full Stage 2 plan summarized at the bottom.
3. **`editor-audit/01-prisma-fields.md` §F** — the specific fields being sunset into blocks (the exact migration list).
4. **`lib/editorRegistry.ts`** — the four-type model lives here. Note the `EditorType`, `EditorPlacement`, and `PLACEMENT_TYPE` constructs.
5. **`lib/blockNoteCustomBlocks.tsx`** — existing custom blocks (Pull Quote, Verse Quote, Practice Suggestion, Reflection, Callout). New blocks follow this pattern.

### What's already done (shipped in session 89)

- `RIM_Editor_Types.md` created, `CLAUDE.md` Design Orientation + Closing Ritual updated to gate it.
- Five audit sweep docs in `editor-audit/` classifying every authored-content surface.
- `lib/editorRegistry.ts` rewritten to four-type model; `variant="document"` renamed to `variant="dense"` across `RimProseEditor` + three callers; `hub-announcement` removed.
- Five new placements declared (registry-only, awaiting schema/UI wiring): `support-note`, `support-template`, `sub-claim-message`, `teacher-bio`, `course-completion-note`.
- Abandoned session module deleted: `SessionAttendance`, `SessionReport`, `SessionCoHost`, `SessionCoHostReport` models + `PostSessionAction` enum + all User/Program relations + `/api/attendance/join` route + the two fetch callers + stale comments. Migration added to drop tables on deploy.
- Sanity cleanup: `/team/[slug]`, `/magazine-articles/[slug]`, `components/TeacherList.tsx`, dead queries in `lib/queries.ts`, volunteer-positions "Current Volunteers" section all removed.
- Historical one-time migration scripts deleted (`migrate-programs-from-sanity.ts`, `migrate-to-blocknote.ts`).

### Stage 2d — next session scope

Done carefully. This is where the Page Designer pattern goes from promise to reality. Jesse wants to design each new block together through the four-phase procedure (see `RIM_Editor_Types.md` § Block Creation Procedure) rather than batch-building. Expect multiple sessions before the Page Designer is fully populated.

**Suggested order:**

1. **Start with SpecialNote.** This is the most concrete example of the pattern — it replaces the current `Program.specialNotes` rendering slot one-for-one. Designing SpecialNote sets the template for the rest. Do the four phases in conversation:
   - Phase 1 — Proposal: working name, visual identity, placement that needs it (program-description), author fields (probably title optional + body), any overlap with existing Callout block.
   - Phase 2 — Design: how it renders in each scope (`rim-content--program` primarily; possibly `rim-content--lesson` if lessons want it too). Decide `availableIn`.
   - Phase 3 — Implementation: definition in `lib/blockNoteCustomBlocks.tsx`, entry in `lib/editorRegistry.ts` (Dharma or a new group?), CSS in `custom.css`.
   - Phase 4 — Review + lock-in: verify in `/admin/editor-lab`, verify in a real program preview, commit, add to Block Library Roster in `RIM_Editor_Types.md`.

2. **Migrate `Program.specialNotes` into SpecialNote blocks.** Data migration script: read existing `specialNotes` JSON, wrap as a SpecialNote block, prepend or append inside `Program.description`. Remove the separate render slot (`.pg-notes`) from `app/programs/[slug]/page.tsx` and the member program page. Deprecate the field in schema (keep for one release for safety, remove in the next).

3. **Schema promotions** — `TeacherProfile.bio: String? → Json?` and `Course.completionNote: String? → Json?`. Each requires:
   - Schema change in `prisma/schema.prisma`
   - Migration in `prisma/migrate.mjs` that converts existing string values to BlockNote paragraph blocks: `[{ type: "paragraph", content: [{ type: "text", text: oldValue, styles: {} }] }]`
   - Component swap: `components/member-sections/TeacherSection.tsx` and `components/CourseEditor.tsx` — textarea → `RimProseEditor` variant="compact"
   - Render update on public pages: `app/teachers/[slug]/page.tsx`, `app/teachers/page.tsx` (bio excerpt becomes `extractBlockNoteText(profile.bio).slice(0, 160)`), `components/MarkCompleteButton.tsx`
   - CSS wrappers: `rim-content tp-body` and `rim-content crs-completion-note`

4. **Additional Page Designer blocks** — through the same four-phase procedure:
   - **Announcement** (replaces `Program.specialAnnouncement` — currently plain textarea)
   - **EarlyArrival** or generic **PracticalInfo** (replaces `Program.earlyArrivalMessage`)
   - **DanaInvitation** (replaces on-page `Program.danaMessage`; email version stays a Message field)
   - **ProgramPullQuote**: confirm the existing `pullQuote` custom block covers `Program.pullQuote` + `Program.pullQuoteSource`; migrate if so.
   - Lesson-side: the existing Pull Quote / Verse Quote blocks should absorb `Lesson.headerQuote` + `Lesson.quoteSource`; Reflection block absorbs `Lesson.reflectionPrompt`. Verify fit; add a prompt-only Reflection variant if needed.

5. **SubClaim.message UI** — small feature. Add an optional message field to the claim confirmation dialog (`components/HubScheduleClient.tsx` — the "I can cover this session" two-tap confirm), POST through the existing claim API route. The `SubClaim.message` schema field already exists; just needs the form wire-up.

6. **Sanity migrations** — the two remaining Sanity types move to Postgres:
   - **`glossary` → `GlossaryTerm`** — template data: `name`, `slug`, `pali`, `sanskrit`, `synonyms`. Add `body: Json?` as Page Designer. New route `/glossary/[slug]` reads from Postgres. Migration script pulls from Sanity, converts Portable Text to BlockNote JSON (reuse logic pattern from `migrate-programs-from-sanity.ts` in git history). Output wrapper: `rim-content rim-content--glossary gloss-body`. Delete `glossary*` queries from `lib/queries.ts` post-migration.
   - **`volunteerPositions` → `VolunteerPosition`** — template data: `name`, `slug`, `isOpen`, `currentVolunteers` (FK to User). Add `positionDescription: Json?` as Message. Restore the "Current Volunteers" section on the page, linking to `/teachers/[slug]` for users with TeacherProfile. Output wrapper: `rim-content vp-body`. Delete `volunteerPosition*` queries from `lib/queries.ts` post-migration.

7. **Terminal code-level gate** (do last, once placements are stable) — build `<EditorField type="..." placement="..." />` wrapper component that wraps `RimBlockEditor` or `RimProseEditor` internally, picking the right engine/variant based on type. The wrapper refuses to mount (compile error + runtime error) if the placement isn't in `PLACEMENT_TYPE`. Migrate all current usages to the wrapper. This is what makes the registry a genuine compile-time gate, not a polite request.

### Things the opening ritual should know

- **Nothing is broken.** Build passes, typecheck passes, all editors function identically to session 88. Foundational work only.
- **Nothing is ambiguous.** Every sunset field, every promotion, every migration is documented in `editor-audit/01-prisma-fields.md` § F and § E.
- **Every new block requires the four-phase procedure.** Do not skip straight to implementation. The block brief conversation is the valuable part — it's how Jesse and Claude co-design rather than drift.
- **Every new block goes into the Block Library Roster** in `RIM_Editor_Types.md`. That roster is the visual commitment record.
- **If code and `RIM_Editor_Types.md` disagree, the code is wrong.** Fix the code to match the doc, not the other way around.

### Files to keep in mind

- `RIM_Editor_Types.md` — canonical reference, read first
- `CLAUDE.md` — gates the canonical doc; closing ritual requires updating `RIM_Editor_Types.md` when editor code changes
- `lib/editorRegistry.ts` — four-type model, placement registry
- `lib/blockNoteCustomBlocks.tsx` — where new blocks get defined
- `public/css/custom.css` — where new output wrappers and block styles go
- `prisma/schema.prisma` — schema promotions land here; migrations in `prisma/migrate.mjs`
- `app/admin/editor-lab/page.tsx` — verification surface for new blocks
- `editor-audit/` — the five inventory sweeps (01–05)

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
