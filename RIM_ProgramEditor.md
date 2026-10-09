# RIM Program Manager

**Status:** Active per-tool engineering reference. Created session 162 (2026-07-13).

The Program Manager is the operational application for creating and maintaining RIM's live offerings. Read this with `RIM_Offering_Model.md`, `RIM_Registration.md`, `RIM_Zoom.md`, and `RIM_Editor_Types.md`. Program changes are never isolated editor changes: a saved program can affect public promotion, registration, dana, dashboard placement, Zoom meetings, teaching, and volunteer coverage.

---

## Routes and access

- `/tools/programs` — program index
- `/tools/programs/new` — create
- `/tools/programs/[programSlug]` — operational detail
- `/tools/programs/[programSlug]/edit` — edit
- `/tools/programs/categories` — the **old** categories and kinds (legacy: kept until the Category and Format migration is verified; they no longer set a program's public section or its access; hiding a category still hides its programs from the public page)
- `/api/programs-pg/*` and `/api/programs-pg/categories/*` — write/read routes

The tool layout gates with `hasToolAccess(userId, roles, ["REGISTRAR"], "programs")`: REGISTRAR, ADMIN, or an individual `UserToolAccess` grant. Do not replace this with a page-local role check.

## Hub context and shell

`app/tools/programs/layout.tsx` provides `ToolsProvider` and `WorkspaceShell`. A visit launched from the Registration Hub carries `?hub=registrar`; the workspace then uses the shared hub rail and keeps the team context visible. Direct entry uses the compact tool header and a back path to the Registration Hub when the viewer belongs there, otherwise Home.

The hub is team context, not program data authority. Program Manager is not currently filtered by `?hub=`. Do not imply that the visible hub rail means the program query is hub-scoped. If program management later serves multiple owning hubs, add real query/write scoping through the full four-layer hub audit.

## Editor structure

`components/registrar/ProgramEditor.tsx` is a tabbed editor with Content, Schedule, Hosting & Access, Categories, Registration, Dana, and Visibility (the "Home Card" tab was retired 2026-10-09; its two fields moved to Schedule). It uses the shared `pe-` editor grammar. Rich authored fields follow the placements in `RIM_Editor_Types.md`; structured schedule, access, category, dana, and registration values remain form data.

**Category, Format, and Open entry (2026-10-02).** Every program carries a required **Category** (Foundations, Ongoing Learning & Practice, Immersion, Community Group, Special Event; and the internal Service and Private), a **Format** (Drop-in, Class, Course, Workshop, Day of mindfulness, Retreat; required for the three ways, optional otherwise), a **Silent meditation** checkbox (shown only when Format is Drop-in) and a **Hosted by volunteers** checkbox, all on the Categories tab with helper lines. Validation is `cleanOffering` in `lib/programOffering.ts`, shared by the editor and both API routes (`POST /api/programs-pg`, `PUT /api/programs-pg/[slug]`: 422 in the editor's voice; a PUT that omits the offering fields leaves them as stored, or takes them from the old category's meaning on a row never migrated). **Category and Format are labels and grouping only.** Access is the separate **Open entry** setting on the Registration tab, beside Registration enabled and Registration closed (`Program.openEntry`; POST default off; a PUT that omits it leaves it as stored; a non-boolean is 422). Open entry means anyone signed in may join, in person or on Zoom, without registering; it drives the program page's "Simply arrive" line, My Home's Today, Zoom entry, and This Week's Drop-in mark through `hasOpenEntry`. The old category stays visible as a read-only line on the Categories tab; the admin list filters by Category and by Format (its old Format column is now "Delivery"). `.pe-visibility-option` checkboxes are 44px tall.

**The pull quote is optional (2026-10-02; it was required from session 162).** A Program may be saved with no pull quote and no source. A source cannot stand without its quote: ProgramEditor blocks that save, and both API routes (`POST /api/programs-pg`, `PUT /api/programs-pg/[slug]`) return `422`; the PUT resolves each field against the stored value when the request omits it, and stores an empty value as `null`. A quote without a source is allowed (three live programs have exactly that). The public template handles a quote-less program with `pg-hero--no-quote` and `pg-content--no-quote` (see `RIM_Public_Pages.md`); the quote card is rendered only when `Program.pullQuote` is set. Program notes must be included in both create and update payloads.

**Dana texts and the dana templates (2026-10-01).** The Dana tab's `DANA_BUILTIN` list holds only starting templates; each program stores its own `danaMessage` (and a short `danaText` shown on the program page), and a template is copied in, not linked. The registration dana step and the program page now state where program dana goes (shared equally between RIM and the Teaching Fund, with a "How dana works at RIM" link to `/donate#dana-at-rim`), so the templates do not repeat it: **"General support"** is two sentences and **"Reciprocity"** (formerly "Teacher support") speaks only of the practice. Do not put the split, or any claim about which fund a gift goes to, in a template or a saved message. Saved messages that predate this (the older long Good Morning and Good Evening text, now replaced; the "General support" text on archived programs) are Jesse's to edit per record. `ProgramEditor.tsx` carries 7 lint errors that predate this work.

**Dated events retire themselves (session 172).** `Program.hideWhenPast` (default true) means "this one-time program retires itself": once its CT day has fully passed it leaves the public listings at read time (`hasConcludedOneTime` in `lib/programUtils.ts` — shared by `/community-programs` and the KM groups page) and the daily `archive-concluded-programs` cron sets `archivedAt` the next morning. The Visibility-tab checkbox renders **only for one-time programs** (`!recurrenceFreq`) — a recurring schedule never "passes"; the stored value persists invisibly if a program later gains recurrence, and is harmless because the concluded check is false for recurring. The Archived tab in `ProgramsTableClient` sorts by `archivedAt` desc (most recently archived first). Archiving is reversible and never touches registration records, which remain available to registrar operations and reporting. The tab strip carries real `tablist`/`tab`/`aria-selected` semantics (session 172) — keep them when adding tabs.

**"Where this program appears" (2026-09-24).** The Visibility tab opens with a derived, read-only readout (`.pe-readout`) stating whether the program is on the public Programs & Events page and on This Week, and naming the one reason when it isn't: archived, "Hide from public Programs & Events page" checked (which also hides it from This Week), no category, a hidden category (`ProgramCategory.hideFromProgramsPage`, passed to the editor as `Category.hidden`), a passed one-time date, the weekly box checked, or no start date. A third line covers **Member home** (the dashboard's Today list): archived, "Hide from member home" (until its optional auto-show date), no start date, in-person (registrants only), open entry (every member, with Join), or registration-required (registrants, not the waitlist, plus hosts and teachers). It mirrors the queries in `app/community-programs/page.tsx`, `app/this-week/page.tsx` and `app/account/(authenticated)/dashboard/page.tsx`; **change the readout whenever those rules change.** The Registration tab's "How this appears to visitors" uses the same class. The old hardcoded `slug: { not: "dummy-test-program" }` exclusions on the listing and home page were removed so the checkbox is the only control.

The visitor-facing registration readout is intentionally present in the Registration tab. It translates registration state plus the **Open entry** setting (and the program's delivery) into the public consequence before a coordinator saves, with an "Open entry: on/off" line that must agree with the Visibility tab's Member home line. Preserve this clear-seeing bridge whenever those rules change.

## Full ecosystem trace

Before changing a Program field or save route, check every affected surface:

- public detail and schedule: `/programs/[slug]`, `/this-week`
- registration, dana, Stripe, waitlist, confirmation email
- member dashboard and public `/programs/[slug]`
- teachers and facilitator display
- Zoom provisioning and occurrence meeting teardown/self-heal
- Scheduler, hosting hub, auxiliary coverage hubs, and standing assignments
- recurrence helpers, calendar export, reminder jobs, and cached labels

Program slugs are join keys for host assignments. Treat an established slug as permanent.

## Authenticated design contract

The Program Manager is a compact work interface, not a public editorial page:

- render beneath the shared member header and inside `WorkspaceShell`
- use the `pe-` grammar and the tokens in `custom.css`; do not add a second page shell
- use the compact authenticated type scale; rich preview/content remains editorial
- use white working surfaces on the warm ground, with spacing and ground changes before borders or shadows
- tabs clarify one editor, not seven separate cards; keep the save action and unsaved-change warning dependable
- align controls vertically within rows; “balanced” does not mean center-aligning labels or form content
- preserve 44px touch targets and 16px minimum mobile input text

## Common pitfalls

- Changing only the editor without tracing dashboard/public/registration/Zoom/Scheduler behavior.
- Deriving access from Category, Format, or the old `ProgramCategory.kind`. Access is `Program.openEntry` (null falls back to the old kind rule until the migration verifies); Category and Format are labels.
- Treating `endDatetime` as a recurring-series cutoff rather than the occurrence end time.
- Changing schedule fields without future Zoom meeting teardown and conflict evaluation.
- Replacing `hasToolAccess()` with a narrower role-only gate.
- Spreading Prisma results containing `Date` values into client props; serialize explicitly.
- Adding a new rich field without registering its editor type and output placement.

## Verification

Use `npx tsc --noEmit` before pushing. The full build runs only on Vercel because the local build's migration stage cannot reach production. For a behavior change, verify the editor consequence and at least the affected public/member/operational surfaces—not merely a successful save.

### The two notices, named for their purpose (2026-10-09; renamed the same evening)

Jesse asked what the two fields were for and whether they could be optimized, then showed the old site's member page, where the same kind of line sat under the schedule as one quiet italic sentence ("Held in Noble Silence before and during session."): *"maybe the problem is how it's named and how it's displayed. A little too obviously or boldly and maybe 'update' and 'good to know' are a little funky."* So:

- **Notice** (`specialAnnouncement`) is a change: "Cancelled this week." "Starting at 7:15 tonight." "We are in the community room." It reaches everywhere the program is listed: Programs & Events and This Week (`ProgramCardNotices`), the program's page (`.pg-notice`) and My Home's Today (`.rim-session-notice`). It renders the same way on all four: one line with a 3px blue edge and 600-weight ink, no label and no fill (the catalog's amber "Update" pill and the labelled boxes went). **Show until** (`announcementUntil`, a nullable `DateTime` added by `migrate.mjs` with `ADD COLUMN IF NOT EXISTS`, no backfill) is a CT day; the notice shows through it and clears itself the next morning; empty keeps the old behaviour. The editor sends `"YYYY-MM-DD"` or null; both API routes parse it with `parseAnnouncementUntil` (`lib/scheduleUtils.ts`, stored at noon UTC) and return `422` otherwise. Every renderer goes through `activeAnnouncement(program, now)`; the harness checks both sides of the day.
- **Session note** (`earlyArrivalMessage`) is one quiet line shown with the session on My Home on the day, as the old site did: italic serif in the softer ink under the place (`.rim-session-note`), no disclosure, no label. It does not appear on the public pages; it is for the day someone comes, not a reason to come. (It was briefly a "Good to know" detail row on the program page and a disclosure on My Home, both retired the same evening.)

Both live on the Schedule tab: Session note with the place, Notice and Show until with the dates. The "Home Card" tab is gone, and Program Notes' help no longer invites "what to bring", so each field has one job (Program Notes for context and accessibility; Session note for the line on the day; Confirmation Message for the registrant's email).

### Preparation-note placement (September 2026)

The existing `earlyArrivalMessage` field now renders as Good to know beside the relevant Today offering in the member dashboard. Public catalog and weekly cards omit it. `specialAnnouncement` remains a visible Update both publicly and on the member session. No editor field, registration, Zoom, or scheduler behavior changed.
