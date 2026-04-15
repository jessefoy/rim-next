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
