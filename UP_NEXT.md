# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Editor system reorg — Stage 2d, Aside block shipped (session 90 closed, 2026-04-20)

Stage 2d's first concrete block landed: **Aside**, a pure-structural shaded container. The journey through it triggered a deeper consolidation — the editor's pill menu and slash menu were rewired to share a single source of truth (`lib/editorRegistry.ts`), typography was aligned between editor and rendered output, and a smart trailing-empty-line collapse was added to keep design blocks looking clean at the bottom of a document. Every remaining Stage 2d block should follow the Aside's pattern: pure structure, no chrome, visuals scoped by context.

### What session 90 shipped

- **Aside block** — callout variant `aside` as a pure-structural wrapper. No controls in its render function, no per-instance props. Children are the content; CSS `:has()` applies the shading; color is determined by render context (document / lesson / program). Added to the Block Library Roster in `RIM_Editor_Types.md`.
- **Menu unification** — both pill ⋯ menu and slash `/` menu now read from `insertElementsForContext(registryContext)`. Shared `insertElementAtCursor` helper drives all inserts (smart empty-line replacement + container seeding). Custom `RimSlashMenu` component via BlockNote's `SuggestionMenuController` using `filterSuggestionItems` from `@blocknote/core/extensions`.
- **Typography alignment** — `--font-doc` redefined as Open Sans (was Inter), editor heading sizes aligned to token scale (h1=38/h2=28/h3=24/h4=20), editor body size aligned to `var(--text-body)` = 18px, first-heading margin zeroed, aside child font explicitly `var(--text-body)`.
- **Uppercase eyebrow section labels** with thin dividers — identical styling across slash and pill menus.
- **Smart trailing-line collapse** — CSS `:has()` rule hides the trailing empty paragraph when it follows a container block (aside/callout/image/table/etc). Editor gained 32px padding-bottom for click zone. Rendered output was already clean (renderer filters empty paragraphs).

### What comes next

Stage 2d continues with the next blocks, each designed through the four-phase procedure (see `RIM_Editor_Types.md` § Block Creation Procedure). The Aside is now the model: keep `render()` empty when possible, let BlockNote handle containers natively, CSS by context.

1. **SpecialNote** — replaces `Program.specialNotes`. Four-phase conversation, then implement, then migrate existing data.
2. **Migrate `Program.specialNotes`** to SpecialNote blocks once the block exists. Data migration in `prisma/migrate.mjs`: read existing JSON, wrap as a SpecialNote block, prepend/append into `Program.description`. Remove the `.pg-notes` render slot from `app/programs/[slug]/page.tsx` and the member program page. Deprecate the field in schema (keep one release, remove next).
3. **Schema promotions** — `TeacherProfile.bio: String? → Json?` and `Course.completionNote: String? → Json?`.
4. **Additional Page Designer blocks** — Announcement (replaces `Program.specialAnnouncement`), EarlyArrival / PracticalInfo (replaces `Program.earlyArrivalMessage`), DanaInvitation (replaces on-page `Program.danaMessage`; email version stays a Message). Verify existing `pullQuote` covers `Program.pullQuote` + `Program.pullQuoteSource`; verify existing Pull/Verse/Reflection absorb the lesson-side hard-coded slots.
5. **SubClaim.message UI** — small feature, existing schema field.
6. **Sanity migrations** — glossary → `GlossaryTerm`, volunteerPositions → `VolunteerPosition`.
7. **Terminal code-level gate** — `<EditorField type="..." placement="..." />` wrapper that refuses to mount without a registered placement.

### Session 90's design principles to carry forward

- **Don't add render chrome to container blocks.** BlockNote handles `content: "none"` with children natively. Every time we added a title input, color picker, or heading selector to a block's render, we created a surface for ProseMirror to fight with. Keep custom props to the absolute minimum needed; prefer child blocks for structure the author controls.
- **Color is determined by context, not by instance.** Design-element styling belongs in scope class CSS (`rim-content--lesson`, `rim-content--program`). Authors don't choose colors; designers do, once per context.
- **`editorRegistry.ts` is the single source of truth.** Any new insertion surface (menus, keyboard shortcuts, drag handles) reads from it. Any new block gets one registry entry with `availableIn`.
- **Accept standard rich-text conventions.** Backspace unwraps containers at position 0. That's universal. Don't fight it; document it.
- **Editor UI can look different from rendered output.** Affordances (trailing empty lines, placeholders, hover cues) belong to the editor surface and don't need to match the public render. What ships is what matters; `renderBlockNoteHtml` handles the cleanup.

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
