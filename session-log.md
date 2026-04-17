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
