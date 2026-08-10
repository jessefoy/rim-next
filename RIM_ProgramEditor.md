# RIM Program Manager

**Status:** Active per-tool engineering reference. Created session 162 (2026-07-13).

The Program Manager is the operational application for creating and maintaining RIM's live offerings. Read this with `RIM_Offering_Model.md`, `RIM_Registration.md`, `RIM_Zoom.md`, and `RIM_Editor_Types.md`. Program changes are never isolated editor changes: a saved program can affect public promotion, registration, dana, dashboard placement, Zoom meetings, teaching, and volunteer coverage.

---

## Routes and access

- `/tools/programs` — program index
- `/tools/programs/new` — create
- `/tools/programs/[programSlug]` — operational detail
- `/tools/programs/[programSlug]/edit` — edit
- `/tools/programs/categories` — category and kind management
- `/api/programs-pg/*` and `/api/programs-pg/categories/*` — write/read routes

The tool layout gates with `hasToolAccess(userId, roles, ["REGISTRAR"], "programs")`: REGISTRAR, ADMIN, or an individual `UserToolAccess` grant. Do not replace this with a page-local role check.

## Hub context and shell

`app/tools/programs/layout.tsx` provides `ToolsProvider` and `WorkspaceShell`. A visit launched from the Registration Hub carries `?hub=registrar`; the workspace then uses the shared hub rail and keeps the team context visible. Direct entry uses the compact tool header and a back path to the Registration Hub when the viewer belongs there, otherwise Home.

The hub is team context, not program data authority. Program Manager is not currently filtered by `?hub=`. Do not imply that the visible hub rail means the program query is hub-scoped. If program management later serves multiple owning hubs, add real query/write scoping through the full four-layer hub audit.

## Editor structure

`components/registrar/ProgramEditor.tsx` is a tabbed editor with Content, Schedule, Hosting & Access, Categories, Registration, Dana, and Visibility. It uses the shared `pe-` editor grammar. Rich authored fields follow the placements in `RIM_Editor_Types.md`; structured schedule, access, category, dana, and registration values remain form data.

Every Program requires a trimmed pull quote. ProgramEditor blocks an empty save, and both create/update API routes enforce the same rule with `422`; do not rely on the HTML `required` attribute alone. The source is encouraged and trimmed but remains optional. Program notes must be included in both create and update payloads.

**Dated events retire themselves (session 172).** `Program.hideWhenPast` (default true) means "this one-time program retires itself": once its CT day has fully passed it leaves the public listings at read time (`hasConcludedOneTime` in `lib/programUtils.ts` — shared by `/community-programs` and the KM groups page) and the daily `archive-concluded-programs` cron sets `archivedAt` the next morning. The Visibility-tab checkbox renders **only for one-time programs** (`!recurrenceFreq`) — a recurring schedule never "passes"; the stored value persists invisibly if a program later gains recurrence, and is harmless because the concluded check is false for recurring. The Archived tab in `ProgramsTableClient` sorts by `archivedAt` desc (most recently archived first). Archiving is reversible (Restore) and never touches registrations; a registrant's `/account/programs/[slug]` history page survives it. The tab strip carries real `tablist`/`tab`/`aria-selected` semantics (session 172) — keep them when adding tabs.

The visitor-facing registration readout is intentionally present in the Registration tab. It translates category kind + registration state + format into the public consequence before a coordinator saves. Preserve this clear-seeing bridge whenever those rules change.

## Full ecosystem trace

Before changing a Program field or save route, check every affected surface:

- public detail and schedule: `/programs/[slug]`, `/this-week`
- registration, dana, Stripe, waitlist, confirmation email
- member dashboard and `/account/programs/[slug]`
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
- Inferring offering behavior from a category label instead of `ProgramCategory.kind`.
- Treating `endDatetime` as a recurring-series cutoff rather than the occurrence end time.
- Changing schedule fields without future Zoom meeting teardown and conflict evaluation.
- Replacing `hasToolAccess()` with a narrower role-only gate.
- Spreading Prisma results containing `Date` values into client props; serialize explicitly.
- Adding a new rich field without registering its editor type and output placement.

## Verification

Use `npx tsc --noEmit` before pushing. The full build runs only on Vercel because the local build's migration stage cannot reach production. For a behavior change, verify the editor consequence and at least the affected public/member/operational surfaces—not merely a successful save.
