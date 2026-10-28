# Build plan: setting up a program, step by step

Started 2026-10-28. The design is `CONCEPT.md` and `index.html` in this folder; Jesse approved the mockup and asked to build the whole program editor ("I'd like to update this as soon as possible"). Rulings are recorded in `CONCEPT.md`, "Jesse's rulings". Checks that need Jesse (read-alouds, live trials) are saved to the list at the end and done together once everything is built.

## The decisions under the build

- **Drafts live apart from programs.** A program in progress is a row in a new `program_drafts` table (who started it, the answers as JSON, a shape or the program it copies, when it was last saved). It isn't a program, so nothing that lists, schedules, reminds, emails or opens a Zoom room can see it. **Publish** turns it into a program through the existing `createProgram` in `lib/programSave.ts`, which is when the teams are told, as today. This keeps every existing rule untouched instead of teaching forty readers to skip drafts.
- **The schedule keeps its columns and gains one.** Every week = weekly, every 1; every other week = weekly, every 2; once a month = monthly (the weekday and which one come from the first session, which can only be a real session day); several days in a row = one-time with a later end, as today; the end time stays on `endDatetime`, on the first session's day. New: `recurrenceUntil` (a nullable date) for "ends on a date". Daily and every 3 or more are no longer offered (the Dummy Test Program keeps its Daily until it's deleted).
- **One schedule rule, exact.** `lib/scheduleUtils.ts` counts real sessions: "after N" is the first N sessions from the first session, "on a date" includes that day. Today's count can be wrong for an off-day start, or whenever more than one day is ticked (two days with 4 gives 5; three days with 5 gives 7); no live program has a count with either (read 2026-10-28), so no live dates move.
- **The save refuses what can't be right**, for the walk-through, the guide and any other caller (in `lib/programSave.ts`, never the route): a weekly program with no day, a first session that isn't one of its days, every 3 weeks or more, a new Daily, a series that ends before it starts.
- **The order of programs.** New nullable `listFirst` (a number): set = shown first in its section, in that order; empty = by when it meets (programs that go on by first weekday, Monday first, then time; programs with an end by first session). One function, `lib/programOrder.ts`, for Programs & Events, the Kalyana Mitta groups page and the Programs list. `sortOrder` stops being read (dropped later, two-phase).
- **The questions live in one place.** `lib/programSetup.ts`: each step's id, section, when it applies, what it needs, and how its answer reads as a sentence, as plain functions over the editor's data. The walk-through, the program's page, the review and the RIM Guide all read it, so they can't disagree.
- **"Before you save" is computed by the server.** A dry run of the save (`previewProgramSave` in `lib/programSave.ts`) answers what would happen: sessions that go or arrive, the people taken off them, rotations that end, the people registered who'd want an update, teams told. `clearOffScheduleCoverage` and its kin gain a dry-run mode so the preview and the save use the same code.

## Connections Map: the program editor, rebuilt as a walk-through

```
Database models touched:
- Program — new nullable recurrenceUntil, listFirst (additive, ADD COLUMN IF NOT EXISTS, no backfill); sortOrder no longer read
- ProgramDraft (new table program_drafts) — a program in progress
- HostAssignment, StandingAssignment — only through the existing cleanup, now with a dry run

Routes affected:
- /tools/programs — Drafts shown first; Edit opens the program's page; a new "How each section is ordered" page
- /tools/programs/new — the shapes and copies start a draft and open the walk-through
- /tools/programs/drafts/[id] — the walk-through and its review (new)
- /tools/programs/[slug]/edit — becomes the program's page of sentences with Change; each Change opens that section's steps
- /community-programs, /kalyana-mitta/community-groups-events — the new order
- /api/programs/[slug]/ical and calendar links in emails — one session's length, the true first session, the end

Components involved:
- components/registrar/ProgramEditor.tsx and program-editor/* — replaced by the walk-through, the step components, the review and the program's page (Post a notice, Tell the people registered and the guest-link reset move onto the program's page)
- app/tools/programs/new/page.tsx — starts drafts
- ProgramsTableClient — Drafts, and the order page
- Registration app links into the editor — repointed

CSS prefixes/areas:
- ps- (new) for the walk-through, trail, review and program page, inside the existing tools shell and app readability contract
- pe- rules retired with the old editor (css-prune)

API routes:
- POST/PATCH/DELETE /api/program-drafts (new); POST /api/program-drafts/[id]/publish (new)
- POST /api/programs-pg/[slug]/preview (new, the dry run)
- PUT /api/programs-pg/[slug] — same route, new checks in lib/programSave.ts
- the RIM Guide connector: create_program starts a draft and publishes on a yes; program_settings and edit_content read and write through lib/programSetup.ts

Email templates:
- None new. Publishing sends what creating sends today (new-program-needs-host to the teams), now at Publish; the guide's ask-first prediction moves with it

Other features this connects to:
- the schedule rule (lib/scheduleUtils.ts) feeding This Week, My Home, the Scheduler, rotations, reminders, the note after, the registration window, the Zoom door and seat check, contact windows, the sitemap
- the RIM Guide (volunteer-guide/3-programs-and-registration.md, screens.json, its program tools)
- the "Setting up a program" tutorial (components/tutorials/registrationTutorials.tsx)
- the member harness (scripts/check-member-redesign.cjs): the count tests change on purpose

Design principles that apply:
- Clear seeing is correctness: the real dates and the real list order are shown, not a label or a number
- Make random tapping survivable: a draft until Publish; "before you save" says what a change does
- One dominant action per state: one question, one Continue
- Plain-language state headers: "Draft · saved as you go. No one sees it until you publish."
- Reuse the existing grammar: the tools shell, the app buttons, the filter pills on the Programs list
```

## Phases

**Phase 1, the rules underneath** (no new screens; ships alone)
1. `recurrenceUntil`, `listFirst` columns and the `program_drafts` table in `prisma/migrate.mjs`.
2. The exact schedule rule, `recurrenceUntil` included, with a cache so the day-walks stay cheap; `lastOccurrenceDate` from the same walk. Harness updated and extended (off-day starts, two days with even counts, until, every other week, monthly by first session).
3. The save's refusals in `lib/programSave.ts`, in the editor's voice, naming the section.
4. Calendar files: each session's own end time, the first real session, COUNT or UNTIL as set.
5. `lib/programOrder.ts`, read by Programs & Events, the groups page and the Programs list.
6. Verify: tsc, the harness, a read-only comparison of every live program's dates before and after (expected: none move), the live order before and after (expected: one swap).

**Phase 2, drafts and the walk-through for new programs**
1. `lib/programSetup.ts`: the steps from the mockup, every editor field placed (`CONCEPT.md`, "Where every field went").
2. Draft routes; the walk-through page: one question, the trail, Back, Skip for optional steps, saved as you go.
3. The review: sentences, Change per section, what publishing does, Publish off while something's missing.
4. Publish through `createProgram`; Programs list shows Drafts.
5. Verify signed in on rim-next.vercel.app (the browser pane): every shape, a copy, changing your mind, phone and computer.

**Phase 3, the program's page and changing a published program**
1. The page of sentences with Change; Post a notice, Tell the people registered and the guest link on it.
2. `previewProgramSave` (dry run) and "Before you save" for every section, starting with When and where.
3. "How each section is ordered" in the Programs list; Show it first, Move up and down.
4. Retire the old editor and its CSS; repoint the Registration app's links.

**Phase 4, the words around it**
1. The Scheduler's words from the review (team, plain words for "sub-cover" and "self-assigned", no em-dashes, errors that sound like a person).
2. "Reset this team": Jesse ruled leads, the guiding teacher and admins (2026-10-28).
3. The "Setting up a program" tutorial; the guide's topic, screens.json and tools; RIM_ProgramEditor.md, RIM_Scheduler.md, FEATURES.md and the rest at the closing.

## Where it stands (2026-10-28)

Phases 1 to 4 are built and on `main`. Phase 4 as built: the Scheduler's words; the "Setting up a program" tutorial redrawn (14 steps) and the guide's copy of it; the guide's other topics and `INSTRUCTIONS.md` (Jesse pastes it into the RIM Guide project); the guide's `create_program` says a program it makes is live at once and points to + Add Program for the step-by-step way, and drops the sort number. **Not done, by choice:** routing the guide's `create_program` through drafts (the conversation is its review; offered to Jesse as a follow-up). Found and fixed on the way: the walk-through's styles shared the `ps-` prefix with the Scheduler's staffing page and reshaped it from Phase 2 until `607a6f0` (now `psu-`).

## To check once everything is built (with Jesse)

- Read-aloud of every question, help line, sentence and note in the walk-through, the review and the program's page.
- Mindful Photography's End fixed in the editor (Jesse), and Private Teacher Meetings archived (Jesse).
- A live trial: set up a private test program from each shape, change its schedule after publishing, and watch what the Scheduler, My Home and the emails do.
- ~~"Reset this team": admins only, or as it is.~~ Ruled 2026-10-28: leads, the guiding teacher and admins; the guiding teacher now holds every lead power on the Scheduler.
- **The Publish trial ran 2026-10-28 and passed:** a private, in-person test program ("Publish Trial Test") from the Workshop shape, published, its time changed (Before you save said only "Every session's time changes, from 7–8 PM CT to 6–7 PM CT."), archived. No emails, notifications or team events; every team's sessions and rotations unchanged. Found on the way:
  - ~~The public page of a series with an end reads only "Thursdays": no first or last date.~~ Fixed 2026-10-28: a repeating program's date words are built fresh (`programDateWords`, lib/dateLabel.ts): "Thursdays, Dec 3 to 17", or "Thursdays, from Dec 3" before an ongoing series begins, on its page, the cards, the confirmation and reminder emails, Registration and the guide.
  - Archive is only on the Programs list, not on a program's page (the mockup had both).
  - "On This Week" comes ticked for a Private program, which This Week never shows.
  - For the read-aloud: "Next, you'll say when it ends." still shows on the step that asks it; "Teachers can take host controls in Zoom" shows for an in-person program.
