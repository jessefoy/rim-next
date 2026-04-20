---

## 2026-04-20 (session 89) — Editor system full reorg: four-type model, canonical reference, audit sweeps, registry rewrite, abandoned-module deletion

### The scope shift

Session opened with Jesse asking for a markdown document listing and categorizing every text-editor form on the platform. Three minutes into the first sweep, I flagged drift between `RIM_Editor_Design.md` and the code: `Hub.welcomeBody` used the wrong engine; `hub-announcement` was registered but unbuilt; `Program.specialNotes` was written by an unregistered `RimProseEditor` instance; three surfaces shared the `program-message` context but rendered in different wrappers. Three drift points in one subsystem.

Jesse named the deeper issue: "We went about this project wrong. We should have established all our components and elements, including design elements, first. We've gotten to a point where we've lost track of how everything works together." The conversation pivoted from "list editor forms" to a structural reorg of how authored content is modeled across the platform.

### The four-type model

The old design doc had tiers (1 Message / 2 Document / 3 Feature). Jesse proposed a cleaner taxonomy: **four editor types chosen by purpose, not by tier number**:

1. **Document** — standalone sophisticated document (headings, tables, images, callouts)
2. **Page Designer** — authored content composed from design blocks inside a page template (e.g., program description, lesson body, eventually glossary)
3. **Message** — general communication (prose + lists, no headings or images) — the most common editor
4. **Form Field** — inline-only rich input (bold/italic/link)

Plus one acknowledged outlier: `MarkdownEditor` for email templates, kept until a BlockNote-to-email-safe renderer is built.

Alongside the types, a core distinction: **template data** (structured fields that drive features — dates, category, capacity) stays as DB fields, while **authored content** (prose, voice, teaching) lives in an editor. The Page Designer's design-element blocks (Pull Quote, Practice Suggestion, Note, and future SpecialNote / Announcement / EarlyArrival / DanaInvitation) absorb several fields that currently exist as top-level hard-coded template slots.

### The persistence architecture

Jesse asked how we keep this from drifting again six months from now. Named three layers of persistence, each with a different job:

- **Project documents** (`RIM_*.md` in the repo) = shared memory. Where design decisions live.
- **Claude memory files** (`~/.claude/.../memory/`) = Claude's working standards for collaboration with Jesse. Not where design decisions go.
- **`CLAUDE.md`** = the gate. Forces Claude to consult the right project document before editor work (via the Design Orientation table) and requires updating the doc when editor code changes (via the Closing Ritual).

The terminal layer, deferred to Stage 2d, is a **code-level gate**: an `<EditorField type=... placement=.../>` wrapper that refuses to mount without a registered placement. Discipline is fragile; a compiler error is durable.

### What was built

**Canonical reference + gates:**
- Created `RIM_Editor_Types.md` (project root) as the new canonical reference. Defines the four types, template-vs-content distinction, output destinations (web template / interactive web / transactional email), block library concept, four-phase block creation procedure, lock-in rules, placement registry.
- Updated `CLAUDE.md` Design Orientation table: editor work now reads `RIM_Editor_Types.md` (replacing the old `RIM_Editor_Design.md` reference).
- Updated `CLAUDE.md` Closing Ritual: any editor / block / placement change requires updating `RIM_Editor_Types.md` before commit.

**Stage 1 — inventory (five sweeps):**
All live in `editor-audit/`:
- `01-prisma-fields.md` — 42 text-bearing Prisma fields classified
- `02-sanity-schemas.md` — remaining Sanity types classified (`teams`, `magazineArticles`, `glossary`, `volunteerPositions`, plus dead queries)
- `03-hub-surfaces.md` — every hub editor placement (conversations, tasks, documents, schedule, admin)
- `04-admin-tools.md` — program/lesson/course/member/support/manual/banner/email-template editors
- `05-public-content.md` — every public and member-facing render site

**Stage 2a — registry rewrite (non-user-visible):**
- `lib/editorRegistry.ts` rewritten around the four-type model. Added `EditorType` union and `PLACEMENT_TYPE` map. Reorganized helper arrays (`DOCUMENT_PLACEMENTS`, `PAGE_DESIGNER_PLACEMENTS`, `MESSAGE_PLACEMENTS`, `FORM_FIELD_PLACEMENTS`).
- Renamed `variant="document"` → `variant="dense"` in `RimProseEditor` (the old name conflicted with the new Document *type*; "dense" describes toolbar density). Three callers updated: `HubAdminForm` (×2), `HubTasksClient`.
- Removed `hub-announcement` from the registry. Feature was retired in session 72 (announcements became pinned conversation threads); the registry entry was stale.
- Populated the Placement Registry section in `RIM_Editor_Types.md` — every current placement listed with its component, schema field, output destination, output wrapper, and route.

**Stage 2b — registry additions (declarations of intent):**
Five new placements added to the registry; schema wiring pending Stage 2d:
- `support-note` — internal support note (distinct from outgoing reply so future features can diverge safely)
- `support-template` — reusable reply body
- `sub-claim-message` — claimer's message back to the original host (field exists; UI pending)
- `teacher-bio` — public teacher profile bio (schema promotion from `String?` pending)
- `course-completion-note` — series completion message (schema promotion pending)

**Stage 2c — deletions:**

Abandoned session-reflection module (confirmed pre-launch with no real data to preserve):
- `SessionAttendance`, `SessionReport`, `SessionCoHost`, `SessionCoHostReport` models removed from `prisma/schema.prisma`
- `PostSessionAction` enum removed
- All related User and Program relations removed
- Migration `drop_session_reflection_module` added to `prisma/migrate.mjs` — runs on next Vercel deploy, drops all four tables and the enum via `DROP ... CASCADE`
- `/api/attendance/join/route.ts` route deleted entirely
- Attendance fetch calls removed from `app/session/[slug]/page.tsx` and `components/VideoRoomEmbed.tsx`
- Stale comments cleaned up in `lib/email.ts` and `app/api/admin/members/[id]/route.ts`

Sanity cleanup (`teams` deprecated by Postgres `TeacherProfile`, `magazineArticles` to be designed fresh when needed):
- `app/team/[slug]/page.tsx` deleted
- `app/magazine-articles/[slug]/page.tsx` deleted
- `components/TeacherList.tsx` deleted (only used in style guide; replaceable with Postgres-backed version when needed)
- `app/style-guide/page.tsx` cleaned — TeacherList import + demo sections removed
- `app/volunteer-positions/[slug]/page.tsx` — "Current Volunteers" section removed (linked to deleted `/team/[slug]`). Section will return post-migration in Stage 2d, linking to Postgres `/teachers/[slug]` via User relation.
- `lib/queries.ts` trimmed from 10 Sanity queries to 4 — removed `teams*`, `lesson*`, `course*`, `magazineArticle*`, `programsLinkedToCourseQuery`, `allCoursesWithLinkedProgramsQuery`. Kept `glossary*` and `volunteerPosition*` (both still active; both Stage 2d migration targets).
- Historical one-time migration scripts deleted: `prisma/migrate-programs-from-sanity.ts` and `prisma/migrate-to-blocknote.ts`. Both referenced deleted models; git history preserves logic if needed.

### Live behavior change Jesse should know

The site builds and all editors function identically. One consequential behavior change on deploy: **attendance records stop being saved when members join LiveKit sessions.** The `/api/attendance/join` call was the only writer of `SessionAttendance`, and it's gone. No other feature depended on these records being written. Hosting / sub-request / sub-claim flow unaffected — those are separate schema (`HostAssignment`, `SubRequest`, `SubClaim`).

### What this connects to

- **Editor architecture** — every authored-content surface in RIM now has a canonical classification (four types) and a registered placement. The Page Designer pattern (design-block composition inside a page body) is the design-system backbone going forward.
- **Program + Lesson data models** — several top-level fields on these models are marked for sunset into Page Designer blocks (Stage 2d). When that lands, the schema shrinks and authoring becomes author-driven rather than template-slot-driven.
- **Hub system** — confirmed unchanged. `hub-announcement` was only a ghost entry; the hub's conversations + pinned threads + tasks + documents + schedule are all correctly placed under the four-type model.
- **LiveKit sessions** — video session experience is unchanged, but attendance tracking is removed. When attendance becomes a real feature, it'll be designed and built fresh.
- **Email system** — `EmailTemplate` stays on `MarkdownEditor` as an acknowledged outlier. When BlockNote-to-email-safe rendering becomes a priority, that's when the outlier folds in.
- **Future Glossary / Volunteer Position pages** — both are on the Stage 2d migration list. Glossary becomes the third Page Designer placement; Volunteer Position gets a Message editor.

### What comes next

Stage 2d, in its own focused session. Scope:

1. **Schema promotions** — `TeacherProfile.bio: String? → Json?` + `Course.completionNote: String? → Json?`, with data migration converting existing text to BlockNote paragraph blocks, component rewrites (TeacherSection, CourseEditor, MarkCompleteButton), and CSS wrappers (`rim-content tp-body`, `rim-content crs-completion-note`).
2. **First Page Designer block** — design and build **SpecialNote** through the four-phase procedure. This becomes the template for the rest.
3. **Additional blocks** — Announcement, EarlyArrival, WhatToBring, DanaInvitation (each through the procedure).
4. **Field → block migrations** — Program's specialNotes, specialAnnouncement, earlyArrivalMessage, pullQuote pair, on-page danaMessage. Lesson's headerQuote pair, reflectionPrompt.
5. **SubClaim.message UI** — small wire-up to the existing schema field.
6. **Sanity migrations** — glossary → Postgres (Page Designer), volunteerPositions → Postgres (Message).
7. **Terminal code-level gate** — `<EditorField type=... placement=.../>` wrapper that makes the registry a compile-time gate.



### What was built and changed

Four distinct threads this session, each of which ended up depending on the one before it.

**1. Neon compute crisis and permanent cron removal.** Site came up fully offline at the start of the session. Every Prisma-backed page returned 500 — `/community-programs`, `/this-week`, `/teachers`, `/courses`, `/manual`, `/programs/[slug]`, `/api/auth/session`. Vercel logs all pointed at one Prisma error: `Can't reach database server at ep-super-pine-ai6ujd7t-pooler.c-4.us-east-1.aws.neon.tech:5432`. Neon console showed the project had blown past the Free-tier 100 CU-hours/month cap (110.19/100 on 2026-04-19, 12 days before the monthly reset), and the endpoint had been disabled as a quota enforcement.

Root cause was the `/api/cron/support-sync` cron firing every 5 minutes, 24/7, through `vercel.json` — 288 DB hits per day that kept the compute continuously active so scale-to-zero never engaged. Math lined up: compute running 24/7 at `.25 CU` = 6 CU-hrs/day, observed rate was 5.8 CU-hrs/day.

Fix was in two parts:
- Upgraded Neon to Launch via the Vercel Marketplace (pay-as-you-go, no flat fee, metered at $0.106/CU-hr). Site came back within a minute of plan upgrade.
- Removed the 5-min cron entry from `vercel.json` entirely. The Support Inbox already has a manual "↻ Sync Gmail" button at `components/SupportInboxClient.tsx:858` (calling `POST /api/support/sync` with a 30-second per-user rate limit). That's sufficient for the current stage of the feature — the inbox is not yet staffed by volunteers, so real-time polling provided no user-visible benefit and only compute cost. The `/api/cron/support-sync` route file stays in the tree so a schedule can be restored with one `vercel.json` entry when the feature actually launches.

**2. Host Schedule tool redesign (`/tools/schedule`).** The previous layout fired a saturated red Claim button on every unclaimed row — on a busy month that reads as "crisis everywhere," which is the opposite of what a volunteer arriving on the page needs. A month-grid mini-calendar showed 7-pixel dots with a separate legend strip to decode them, and clicking a day smooth-scrolled the list rather than filtering it, so calendar and list were doing duplicate work rather than one serving the other.

Rebuilt as one coherent view:
- **Interactive status sentence** replaces the three-way filter pill row. "3 sessions this month need a host. You're hosting 5." Both counts are clickable filter pills; a "Show all N" clears.
- **Event-pill calendar** (`hub-cal2`) with cells ~96px tall showing up to three abbreviated program name pills per day, color-coded by status. Three pills + "+N more" if a day has more. At mobile (<768px) pills collapse to thicker colored bars (14px × 4px) so the grid stays legible at phone widths.
- **Day click filters the list**. Click April 19 → "Showing 3 sessions on Saturday, April 19 · Show whole month →" banner appears, list below filters to that day. Click the day again or the banner link to clear.
- **Today** is marked with a filled blue circle around the day number (Google Calendar pattern). The earlier 4%-opacity blue tint was invisible; the circle is unmistakable.
- **Intuitive color semantics.** After a back-and-forth iteration, landed on: orange (`#d9840f`) for no host yet, red (`#c44a20`) for sub needed (urgent, teammate stepping back), green (`#5a9960`) for covered, blue (`var(--rim-blue)`) for yours, and red-bg-with-blue-border for "yours + sub requested" (mine-sub). Applied across calendar pills, mobile bars, list card left-borders, status sentence pills, legend swatches, action buttons, and the detail panel primary button.
- **Card-border unification.** Previously a 3px colored stripe on neutral-gray borders read as a sticker applied to the card. Now the whole card outline picks up a washed tint of the state color — e.g., needs-host cards have `#ecd9a6` on three sides + `#d9840f` stripe on the left, hover deepens the whole border toward the accent.
- **Card typography conforms to Messages Hub pattern.** Was using `var(--text-small)` 15px for titles; Messages Hub rule (`.hub-conv-row__title`) is `var(--text-h4)` 20px serif at 400 weight, 1.3 line-height. Schedule cards now match. Program names carry real visual weight as the primary content of each row.
- **Legend** reappeared as a five-entry color key: No host yet / Needs a sub / You're hosting / You asked for a sub / Covered.
- **Distinct mine-sub state.** Previously when you requested a sub on your own session, nothing visually changed — same blue card, same "You're hosting" label. Now the card gets a cream background, a "Sub requested" amber chip next to the program name, and the host line reads "Asking the team to cover." Calendar pill becomes red-bg + blue-border (same two-signal pattern).
- **Plain-language copy throughout.** "Claim This Session" → "I'll host this session." "Cover This Session" → "I can cover this session." "Request Sub" → "Ask someone to cover for me." "Remove Myself" → "Remove myself." "Needs Coverage" → "No host yet." Host label sentences instead of bureaucratic vocabulary.

**3. Sub-request submit bug (critical).** The `submitSubRequest` function called `message.trim()` on the RimProseEditor value. That value is BlockNote JSON (an array of blocks), not a string — `.trim()` threw a TypeError, the Promise rejected, the SessionDetail submit `onClick` handler had no try/finally, and `setSubmitting(false)` never ran. Button stuck on "Sending…" forever. And the POST never reached the server, so no team notification went out. Jesse hit this on his first real sub-request test.

Fix: `submitSubRequest` now accepts message as `any`, returns `Promise<boolean>`, uses `extractBlockNoteText()` to detect empty content and send `null` to the API, wraps the fetch in try/catch, and the submit button's onClick uses try/finally to always reset submitting state. Also captures the returned `subRequestId` from the POST response so the "I can cover" button appears correctly for other users without a page reload.

**4. Sitewide mobile viewport fix and Host Schedule mobile pass.** Jesse sent a screenshot showing the entire hub layout rendering in desktop width on his iPhone — sidebar still occupying its 260px, hub mobile bar not appearing, content squeezed. Root cause was dead-simple and embarrassing: `app/layout.tsx` had no viewport meta tag. Mobile browsers were rendering every route at ~980px desktop width and pinch-zoom-scaling to fit. Every `@media (max-width: 768px)` rule in `custom.css` had silently been ignored on mobile — not just in this session, but since the app was built.

Added `export const viewport: Viewport = { width: "device-width", initialScale: 1 }` to the root layout (Next.js 15+ Metadata API form). Also switched `.hub-ws-layout` from `display: flex` to `display: block` at <=900px as defensive belt-and-suspenders, so there's no flex context in which the position-fixed sidebar could possibly push the main column.

With viewport working, finished the mobile-friendliness pass: 44px min-height touch targets on every card/detail/nav button, iOS auto-zoom fix (`.fi`, `.ft`, `.fs` form inputs bump to 16px at <768px), chrome compression on mobile (toolhead 22→18, status margin 20→14), thicker calendar bars, stack detail-panel actions vertically so each button is full-width, full-width card button on stacked layout.

**5. Two-tap confirmation pattern for claims.** Once mobile was working, Jesse's next concern was accidental taps while scrolling past cards — a finger brushing "I'll host" could commit before he knew what happened. Plus the detail panel showed a duplicate "I'll host this session" button, producing two primary actions on screen at once. Built a two-tap confirm:
- First tap on "I'll host" or "I can cover" → button darkens to its committed color, label becomes "Tap to confirm," a 5px countdown bar animates across the top over 4 seconds, and a gentle brightness pulse (1.2s) runs on the whole button. A Cancel link appears beneath.
- Second tap within 4s → commits.
- Inactivity or Cancel → reverts to idle.

Same pattern applied to both the card-level and the detail-level primary buttons. Only one is ever on screen — when the detail expands, the card-level button hides. Cancel link on mobile is a 44px-tall tappable area (was a 20px text link). The bar starts at the top of the button rather than the bottom so the user's eye already lands on it while reading the label.

**6. Horizontal scroll lockdown.** Jesse reported slight horizontal play at the right edge on his phone. Added `overflow-x: hidden` on `html` (universal browser support fallback) and `overflow-x: clip; max-width: 100%` on `body` (newer Safari/Chrome, preserves `position: sticky` on descendants). Card titles get `overflow-wrap: anywhere; min-width: 0` so long program names break gracefully inside the card rather than pushing the row wide.

### Design decisions

- **Red isn't always bad.** The first redesign pass avoided red entirely because the original layout had 25+ red Claim buttons that read as "crisis everywhere." Jesse pushed back: red *should* mean urgent when sub-needed *is* urgent (a teammate stepping back from a commitment, team needs to act), and orange *should* mean attention when unclaimed is a standing need. The intuitive-color pass (orange/red/green/blue) is more honest than the muted teal/amber/grey it replaced. Color semantics should match emotional semantics.
- **One dominant action per state.** The card-level and detail-level primary buttons both claimed the session. With both visible when a card expanded, the user saw two identical "I'll host" buttons — confusing, and violating the "one dominant action per state" rule. The card button now hides when the card expands, so only one primary is ever on screen at a time.
- **Two-tap over modal confirmation.** For safeguarding an action that's easy to mis-trigger but cheap to undo, a two-tap arm-then-commit pattern is calmer than a modal confirmation. It's the same pattern iOS Mail uses for swipe-to-delete + undo. Doesn't interrupt flow; doesn't add a layer of UI. Pulse + countdown + cancel link together make the armed state obvious on any screen size.
- **Calendar cells show event names, not dots.** Dots required a separate legend strip to decode and gave no hint of *what* was scheduled that day. Colored pills with abbreviated program names carry both meanings at once (what + status). Truncation is a real cost — long program names lose their tails — but the tradeoff is worth it. If truncation becomes a pattern problem, add a `shortName` field to `Program` rather than go back to dots.
- **Typography conformance matters.** Mixing public-site editorial body (`var(--text-body)` 18px, 1.7 line-height) into admin/tool surfaces makes tool pages feel like they're shouting. Adding `font-size: 16px; line-height: 1.55` to `.hub-ws-main` aligns the tool shell with `.admin-ui` / `.ac-layout` per the RIM spec. Card titles at `var(--text-h4)` 20px serif match `hub-conv-row__title` across the Messages Hub, so the whole hub area reads as one design system.
- **Manual sync beats cron for unstaffed features.** A 5-minute cron is premature optimization for a feature without live users. When the Support Inbox launches to volunteers, the cron schedule can be restored with one `vercel.json` entry — right now the manual sync button is the sufficient path.

### What this connects to

- **All pages on the site** — the viewport meta fix changed mobile rendering for every route under `app/layout.tsx`. Public pages (homepage, `/community-programs`, `/this-week`, lessons) were also rendering at 980px desktop width on phones. They'll now use their existing mobile styles for real. Worth a visual pass to confirm none of them broke.
- **All hub tools** — `.hub-ws-*` chrome (sidebar, mobilebar, workspace shell) is shared across `/tools/schedule`, `/tools/inbox`, `/tools/programs`, `/tools/learning`. The mobile breakpoint overhaul, the `display: block` at <=900px, and the admin typography conformance on `.hub-ws-main` all apply to every tool.
- **Support Inbox feature** — the cron removal changes its operating model. The inbox now only syncs on explicit user action via the `↻` button. When it eventually launches to volunteers, the feature owner needs to decide whether to restore the cron (at what cadence — 15 or 30 minutes is a good balance) or keep the manual pattern. Noted in backlog.
- **Neon + Vercel billing** — the project is now on the Launch plan via Vercel Marketplace. Metered, no flat fee. Next month's bill should drop substantially with the cron gone; at current pace (no other 24/7 processes) compute usage should be in the 10–30 CU-hr range, roughly $1–4/month.
- **Host Team volunteers** — the schedule redesign changes workflow. Volunteers will see a new color language (orange for open slots, red for sub requests), a new confirmation pattern on Claim buttons, and new plain-language labels. The Host Team Hub coordinator should notify volunteers that the tool looks different.
- **`HostAssignment` / `Program` / `SubRequest` data layer** — unchanged. The redesign is cosmetic over existing behavior. Claim, unclaim, sub-request, cover-a-sub all use the same API routes with the same semantics.

### What comes next

- **Other hub tool pages** (`/tools/inbox`, `/tools/programs`, `/tools/learning`) and internal hub pages (Conversations, Tasks, Documents, Members) haven't been mobile-audited. With the viewport meta now in place, they'll at least render at phone width — but each needs its own visual pass for touch target sizing, card layout at narrow widths, and text-input 16px.
- **Public pages mobile verification** — homepage, `/community-programs`, `/this-week`, `/teachers`, `/courses`, `/programs/[slug]`, `/lessons/[slug]` should all be re-tested on mobile now that the viewport meta fires their media queries.
- **Optional `shortName` field on `Program`** — calendar pills at 12px truncate 18+ character names. A `shortName` on the Program model would let admins set "Private Teacher" or "Silent Meditation" as the pill-display name. Low priority; added to backlog.
- **Support Inbox launch** — when the Support Hub is actually staffed, restore the cron in `vercel.json` with a sane interval (15 or 30 min) and re-verify Neon compute stays under the monthly threshold.

---

## 2026-04-17 (session 87) — Editor architecture: FormatPill, Element Registry, scope system, five distinct editorial elements

### What was built

A multi-stage rebuild of the rich-text editor system. The goal was to make the editor feel like one tool across every surface while letting each surface render its own design language — document pages stay utilitarian, lesson pages bloom into full editorial treatment, program descriptions sit in between.

1. **FormatPill + Element Registry foundation** — a single floating toolbar replacing per-surface chrome. One pill everywhere; one registry (`lib/editorRegistry.ts`) that the pill's "+" menu, the slash menu, and the block-handle "Turn into" all read from. Adding a new element is one registry entry listing every context it belongs to.

2. **Scope plumbing at every render callsite** — every rendered-output wrapper now carries a third class alongside `.rim-content` and its context class: `.rim-content--document`, `.rim-content--lesson`, or `.rim-content--program`. Surfaces updated: `app/lessons/[slug]/page.tsx`, `app/programs/[slug]/page.tsx` (description + special notes), `app/course/[slug]/page.tsx`, `app/account/hub/[slug]/documents/[id]/page.tsx`, `app/admin/manual/[slug]/page.tsx`, `app/admin/editor-lab/page.tsx`, `app/account/programs/[slug]/page.tsx`, `app/admin/manual/editor/page.tsx`. This lets a single element's CSS produce three visual treatments from three scope modifiers without duplicating the class trees.

3. **Callouts reduced to Note + Decision** — the old six-variant Callout (note / info / warning / decision / practice / reflection) was replaced in the picker with just Note and Decision, each a distinct editorial choice. Legacy variants still deserialize from the DB so archived content renders; only the picker exposes the two kept roles.

4. **Five distinct editorial elements** — rebuilt the dharma group as five elements with their own visual identity rather than variants of one Callout:
   - **Pull Quote** — inline single-quote block (content + attribution prop)
   - **Verse Quote** — inline single-quote block with serif italic (content + attribution prop)
   - **Practice Suggestion** — container block with "PRACTICE" eyebrow, title prop, and block-level body via children
   - **Reflection** — container block with italic question lead-in prop and block-level body
   - **Note** (Callout) — container block with Note/Decision variants and title prop

5. **Container-body defensive seeding** — on load, any `callout` / `practiceSuggestion` / `reflection` block missing children gets a default `{ type: "paragraph" }` child injected. Stray `content: []` fields on `"none"`-content blocks are stripped. This fixes the "green box with no editable body" state and ensures the Prosemirror schema always has a valid body slot.

### Design decisions

- **Element Registry is the single source of truth.** The pill, slash, and Turn-Into menu all read it. There is no per-tier or per-context pill logic left. Element availability is declared by listing `availableIn: [...]` per entry.
- **Scope modifiers over context duplication.** Rather than writing five copies of practice-suggestion CSS keyed off `.lp-body`, `.prog-description`, `.hdoc-body`, etc., one base rule plus scope overrides (`.rim-content--lesson .rim-el-practice { … }`) handles all three tiers. This ties the tier system (Message / Document / Feature) to concrete CSS hooks that any renderer can opt into.
- **Distinct elements over callout variants.** The six-variant Callout pattern collapsed too many editorial roles into one blue-box treatment. Splitting Pull Quote / Verse Quote / Practice / Reflection / Note gives each its own visual vocabulary, which matters for dharma content where a "reflection" and a "verse" are fundamentally different reading experiences.
- **`content: "none"` + children for containers.** BlockNote's built-in schema allows inline `content` *or* block `children` but the container-body convention uses `children` for block-level nesting. Container blocks with inline `content: []` can fail Prosemirror's `createChecked`. The defensive-seeding migration guarantees shape at load time.
- **BlockNote `blockToNode` only emits `blockGroup` when `children.length > 0`.** Without a default child, the editor has no `.bn-block-group` sibling to click into — hence "uneditable box". This was the root of the bug Jesse hit testing Practice.

### What this connects to

- `RimBlockEditor` (primary editor component) — now reads the registry for its pill/slash/turn-into and migrates legacy container content on load
- `components/editor/FormatPill.tsx` — selection + empty-line pill; insert seeding uses `CONTAINER_BLOCK_TYPES` to auto-add a paragraph child when inserting container elements
- `lib/blockNoteCustomBlocks.tsx` — factories for `pullQuote`, `verseQuote`, `practiceSuggestion`, `reflection`, `callout`
- `lib/editorRegistry.ts` — context allowlists for all five dharma elements extended to `[...LESSON_ONLY, "program-description"]`
- `lib/renderRichContent.ts` — HTML output for each element, with `CONTAINER_TYPES` set so nested list children group into `<ul>`/`<ol>` correctly
- `public/css/custom.css` — ~400 new lines covering editor view (`bn-*`) and rendered output (`rim-el-*`) for each element, plus scope-aware overrides for `.rim-content--document/--lesson/--program`
- Every lesson/program/manual/hub-document display page picks up the new rendering automatically through its scope wrapper

### Known open issue (not a bug in the code)

Jesse's production browser showed the Practice Suggestion as plain text with no box. Element inspection confirmed the HTML (`div.rim-el-practice` with `__header` / `__body` children, inside `.lp-body.rim-content.rim-content--lesson`) but the Styles panel showed no `.rim-el-practice` rule matching — only `.lp-body` and `.rim-content`. Box Model showed zero margin. This is a stale-CSS / cache problem — the CSS at `public/css/custom.css:21055` is committed and served, but the browser has an older sheet. Hard reload / empty cache will resolve. Not a code fix.

### What comes next

- Verify scope styling on program-description (program detail page) and document tier (hub document / manual) once Jesse hard-reloads and the Practice box renders
- Consider migrating the Program `specialNotes` field into an inline Note block inside the description body (Jesse's observation — the separate "Special notes" section is redundant once Notes are first-class within the description)
- Potentially expose Pull Quote / Verse Quote to `program-description` only if it reads well there — currently limited to `[LESSON_ONLY, "program-description"]` in the registry

---

## 2026-04-15 (session 86) — LiveKit video session comprehensive overhaul

### What was built

Complete rewrite of the virtual session room UI and functionality:

1. **Custom conference layout (RIMConference)** — replaced LiveKit's `<VideoConference>` with a custom layout: `LayoutContextProvider` + `GridLayout`/`FocusLayout` switching, toolbar, chat sidebar, raised-hand banner, participants panel, settings panel.

2. **Chat** — `<Chat />` sidebar (300px, dark) with our own header and working ✕ close button. LiveKit's built-in close dispatched to internal state we don't use, so we hide their header and render our own.

3. **Focus/pin layout** — hover any tile to reveal a pin button (top-right). Click to switch from grid view to focus/speaker view (pinned participant large, others in carousel). Click again to unpin.

4. **Nonverbal signals** — ✋❤️🙏✓✗ buttons in toolbar. Badges render top-left of the participant tile at 44px with dark pill background. Reactive via `useParticipantInfo({ participant })` subscribing to `participantInfoObserver`.

5. **Raised-hand banner** — yellow strip below toolbar showing who has their hand up. Visible without opening the participants panel. Host gets "View" button to open the panel.

6. **Presence photo / avatar** — upload from Settings panel, saved to DB via PATCH /api/account/avatar, broadcast via participant metadata. Server-side: avatar baked into JWT token metadata so it's present on connect (no client-side race condition). Renders as centered rounded square (50% tile height, 16px radius). Grey silhouette hidden when avatar is present.

7. **Dark header** — `vs-header` changed from white (#fff) to dark (#1a1a1a) so it matches the video area. All buttons updated for dark theme.

8. **Audio playback prompt** — Safari blocks audio until user interaction. Replaced LiveKit's cryptic "Start Audio" pill with a full-screen overlay: "🔊 Tap to enable audio" with explanation text.

9. **Echo cancellation** — hosts get `echoCancellation: true` while keeping noiseSuppression off for music quality.

10. **Mute All + per-participant mute** — server-side via RoomServiceClient. Mute All in header, individual mute in participants panel.

11. **Participant name** — forced visible with `!important` overrides, 16px/500 weight, darker background pill. LiveKit tile forced to fill wrapper (width/height 100%).

### What was removed

- Background blur (WASM unreliable in Vercel/Safari)
- Brightness/contrast processor (canvas approach broken, CSS filter was poor quality)
- `BrightnessProcessor.ts` is now dead code (could be deleted)

### Design decisions

- **trackRef.participant, not useMaybeParticipantContext()** — GridLayout only provides TrackRefContext, NOT ParticipantContext. This was the root cause of avatars and signals never rendering. Fixed by getting participant directly from the track reference.
- **Avatar in JWT metadata** — client-side `setMetadata()` had a race condition on connect. Baking it into the token eliminates the timing issue entirely.
- **Own chat header** — LiveKit's Chat component has an internal close button that dispatches to `layoutContext.widget.state.showChat`, but we manage chat visibility with our own `chatOpen` state. Hiding their header and adding our own was the clean fix.
- **CSS !important on placeholder hide** — LiveKit's CSS specificity chain for `.lk-participant-placeholder` was too strong for normal selectors. `!important` was necessary.

### What this connects to

- `/session/[slug]` page — the main session page that renders VideoRoom → RIMConference
- `/api/livekit/token` — now seeds avatarUrl into JWT metadata
- `/api/livekit/mute-all`, `/api/livekit/mute-participant` — server-side mute APIs
- `/api/account/avatar` — PATCH endpoint for saving avatar URL
- `lib/livekit.ts` — `createRoomToken()` now accepts optional metadata parameter
- `prisma/schema.prisma` — User.avatarUrl field
- Dashboard "Join" button → `/session/[slug]` flow
- Host assignment system (determines who gets roomAdmin in token)
- ProgramTeacher system (also grants roomAdmin)

### What comes next

- Test with multiple participants (most testing was solo)
- Verify pin/focus layout works with 2+ people
- Verify raised-hand banner shows for remote participants
- Add a manual section for "Virtual Sessions" in the Volunteer Manual (DB-driven, needs manual section creation)
- `BrightnessProcessor.ts` can be deleted (dead code)
- Consider: auto-pin the speaking participant (active speaker detection)

---

## 2026-04-15 (session 84–85) — Community Programs redesign + This Week page

### What was built

**1. Community Programs page redesign (`/community-programs`)**
- Full redesign with `pl-` CSS prefix
- Teal hero (`rim-section--teal`) with bodhi-leaves background image (`Bodhi-Leaves.jpg`) and semi-transparent overlay — matches original Webflow template
- White pill CTA button in hero
- Programs grouped by category (`pl-cat` / `pl-cat__heading` / `pl-list`) using database `sortOrder`
- Schedule subtitle built as: `dateText` (preferred) or `buildDateLabel()` (fallback) + `formatTimeRange()` + `programFormat` label — full "Mondays · 9:30–10:30 AM CT | Zoom Only" format
- 52px Quincy CF hero title (explicit override of `--text-h1`)
- Category headings at `--text-h2` (28px), aligned with card left edge

**2. ListRow component redesign (`components/ListRow.tsx`)**
- All Webflow class names replaced with `lr-` prefix
- `lr-row` (card), `lr-info` (text block), `lr-name` (title), `lr-schedule` (subtitle), `lr-btn` (teal pill CTA)
- Specificity fix: `.lr-row .lr-name` and `.lr-row .lr-schedule` to beat `.rim-section--grey p { margin: 0 0 18px }` global rule

**3. `lib/scheduleUtils.ts` (new shared utility)**
- Extracted schedule helpers from `app/tools/schedule/page.tsx` to shared lib
- Exports: `isOccurrenceOnDate()`, `ctDateStr()`, `shiftToDate()`, `weekStart()`, `ScheduleProgram` type
- Used by both `/tools/schedule` and the new `/this-week` page
- `app/tools/schedule/page.tsx` updated to import from shared lib

**4. "This Week at RIM" page (`/this-week`)**
- Dynamic server component, `force-dynamic`
- Queries all active (non-archived, non-hidden) programs
- Groups programs Mon–Sun by running each through `isOccurrenceOnDate()` for the week's 7 date strings
- Sorts within each day by `startDatetime`
- `?week=next` query param shifts to next week
- Schedule line uses `timeText` (manual override) → `formatTimeRange()` (computed from datetimes) — no day name, already grouped by day
- "This Week / Next Week" toggle pill nav in hero
- "Schedule is subject to change." footer note
- Reuses `pl-cat`, `pl-list`, `lr-row`, `lr-btn` classes from programs list — visually identical
- `tw-` prefix for hero-only elements (hero, title, subtitle, range, nav buttons)

**5. Nav Programs dropdown (`components/Nav.tsx`)**
- Added Programs dropdown in both public desktop and member desktop nav (same `nav__dropdown` pattern)
- Links: "All Programs" → `/community-programs`, "This Week's Schedule" → `/this-week`
- Added to mobile nav in both public and member sections

### Design decisions

- **`dateText` preferred over `buildDateLabel()`** — `buildDateLabel()` generates specific dates ("Tuesday, April 14") for recurring programs that lack recurrence DB fields. `dateText` stores the human label ("Mondays"). Always prefer `dateText` first, fall back only if null.
- **This Week page reuses programs list styles completely** — no separate card CSS. `pl-cat`, `pl-list`, `lr-row`, `lr-btn` are shared. Only the hero needs `tw-` overrides.
- **52px hero titles** — both programs list and this-week pages use an explicit `font-size: 52px` override (not a token). This was a deliberate design choice matching the Webflow original; tokens cap at `--text-h1: 38px`.
- **CSS specificity rule codified** — `.rim-section--grey p { margin: 0 0 18px }` is a global trap. All component paragraph styles inside grey sections must use doubled-class selectors. Added to permanent memory.

### What this work connects to
- **`/tools/schedule`** — shares `lib/scheduleUtils.ts`. Any changes to `isOccurrenceOnDate()` affect both the host calendar tool and the public this-week page.
- **Programs database** — `dateText`, `timeText`, `startDatetime`, `endDatetime`, `programFormat`, `recurrenceFreq/Interval/Days/Count` all drive the schedule display. Missing `dateText`/`timeText` values cause degraded display (specific dates instead of recurring labels).
- **Nav component** — Programs dropdown added to all four nav contexts (public desktop, public mobile, member desktop, member mobile).
- **Community programs page** — same `lr-row`/`lr-btn` cards as the this-week page. Any change to ListRow CSS affects both.
- **Backlog** — "Program dateText/timeText Data Cleanup" added as medium priority (data must be filled via Program Editor for full schedule display quality).

### What comes next
- Fill `dateText` / `timeText` for all live programs via Program Editor (backlog item `2026-04-15-001`)
- Redesign remaining legacy pages (Donate, Volunteer, Community Membership, Login) — backlog item `2026-04-15-002`
- Homepage visual review (all 10 sections)
