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
