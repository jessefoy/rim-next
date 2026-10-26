# Build plan: Programs and Registration, "who's helping, who's asking"

Written 2026-10-23 from `CONCEPT.md` and the mockup (`index.html`) beside it; revised the same day after a review of every claim against the code (27 findings, all folded in below). Phases 1 and 2 built 2026-10-23 to 24. Each phase ships on its own, leaves everything that works today working, and can be paused after.

## What we're building, in one paragraph

Two apps over one program record. **Programs** is where a program is set up: what it is, when and where, who's helping, how people join (with each question asked by one helper), what we tell people, dana, and where it appears. **Registration** is the registration team's desk for the people: what needs doing across every program, each program's people, notes and history, messages, and the registration settings that change while sign-ups come in. Each helper (a teacher, the greeters, a team preparing dietary needs) gets one page that is plainly theirs, built from the questions they ask.

## Decisions

Confirmed by Jesse (2026-10-23):
- **The split:** Programs and Registration, with Registration as the dedicated Registration team's app; the registrar role stays.
- **Setup stays together** in the editor, including how people join.
- **Registration settings in both apps:** open or closed, places and the closing date can be changed in both.
- **What needs doing first:** the registrar's program page opens on it.
- **One page in sections** for the editor.
- **"Who's helping, who's asking"** replaces roster sharing and per-question audiences.
- **The registration team reads every answer.**
- **Teachers can reach each person** by email and phone.
- **"Dietary needs",** not "the kitchen".
- **Dana amounts** are seen only by the Registrar, Guiding Teacher and Admin roles; helpers never see dana.
- **No automatic clearing** of answers.

Settled by this plan (from the review):
- **Registration stays role-only:** Registrar, Admin, Guiding Teacher, the same rule as today's roster. Being on the Registration team without the Registrar role doesn't open it. Today a registrar can add anyone to that team, and leaving the role doesn't remove team membership, so a membership rule would let former registrars keep every answer and contact detail. Everyone who can open Registration may see amounts, which is exactly Jesse's list; the amount check still sits in code as its own rule.

To confirm before the phase that needs it:
1. **Who may use Programs (before Phase 2).** Today the Program Manager is limited to the Registrar, Admin and Guiding Teacher roles (2026-10-19), because it held registrants' details and gifts. Once the people move to Registration, the plan opens Programs to active members of the two teams it's installed in, Program Central and the Registration team. Archiving, restoring and deleting programs, the guest-link reset and the old categories page stay limited to the three roles. This reverses the October 19 rule for editing, so it needs your yes.
2. **Teacher-written questions and helper comments on people:** recommended to wait until the first version is in use (`CONCEPT.md`).
3. **Should the teacher see the people waiting** (before Phase 3)? **Decided (Jesse, 2026-10-24): yes, names only,** one line under Everyone coming; no answers or contact details for them until they have a place.
4. **"New to RIM" and the old site (before Phase 3).** Registrations from the old site weren't imported, and people who joined it before the last member import never got accounts here, so a longtime member can look new. The plan marks someone new only when they have no earlier registration here, no old-site activity on their account, and an account created after this site launched. That still mislabels returning old-site members who make a new account. Use the mark with that limit, or wait until RIM has a season of its own records? **Decided (Jesse, 2026-10-24): mark it now, worded as what the site knows: "First registration here"** (no earlier registration on this site), on the teacher's and registrar's pages only.
5. **A button on the greeter's duty line (before Phase 3).** On 2026-10-16 you decided a supporting team's duty line on My Home has no button ("the work happens in the hall"). The greeters' page needs a way in. Add "Today's list" to that line, or reach the page only from the team's space? **Decided (Jesse, 2026-10-24): a "Today's list" button on the greeter's My Home line on their day,** superseding the 2026-10-16 no-button ruling for that line.

## Connections Map: Programs and Registration ("who's helping, who's asking")

Database models touched:
- `Program`: new nullable columns `registrationOpensAt`, `reminderDaysBefore`, `followUpEnabled`, `followUpMessage`; `registrationFields` items gain a stable `id` (the existing `_key` where present) and `askedBy`, inside the existing JSON; the notice reuses `specialAnnouncement` and `announcementUntil`; `flodeskSync` and `flodeskSegmentId` edited from Registration.
- `Registration`: answers written under the question's `id`, old answers still read by their wording; `notes` becomes read-only; new `followUpSentAt`.
- New `RegistrationEvent` (`registration_events`): history per registration and per program, keyed by `programId` (foreign key), `registrationId` and `actorId` set to null if those rows go.
- New `RegistrationNote` (`registration_notes`): notes with author (set null if the account goes), date and "for the teacher too".
- New `ProgramHelper` (`program_helpers`): teams that prepare without being on the schedule, keyed by `programId` (foreign key, removed with the program), with `hubId` and `canReach`.
- New `Attendance` (`registration_attendance`), optional in Phase 3: arrivals at the door, per session.
- Read only, unchanged: `ProgramTeacher`, `Program.hostingHubSlug`, `ProgramCoverageHub`, `HostAssignment`, `User` (legacy fields), `HubAppLink`, `HubMember`.

Routes affected:
- `/tools/registration` (new): the desk.
- `/tools/registration/[slug]` (new): a program's people, needs, settings, Who's helping, History.
- `/tools/programs/[programSlug]` (today the roster): redirects from its own page file to the new address; `vercel.json`'s `/volunteer/programs/:slug` rule repointed to it directly.
- `/tools/programs`, `/new`, `/[programSlug]/edit`: the editor as one page in sections; the list's names link to `/edit`; New starts from a shape or a past program.
- `/tools/helping` (new): "Helping with", a team's page for the programs it prepares for.
- `/account/teaching/[slug]` (new): the teacher's page, linked from My Home.
- `/account/greeting/[slug]` (new): a supporting team's page for a session (decision 5 decides the My Home link).
- `/programs/[slug]` and `/programs/[slug]/register`: "Registration opens on …"; questions grouped by who's asking.
- `/update/[token]`: answers read and saved by id, keeping old answers.

Components involved:
- `components/registrar/ProgramEditor.tsx`: one page in sections, each a component (closes backlog `2026-06-25-002`); saves send only what changed.
- `components/registrar/VolunteerTable.tsx`: replaced by the Registration program page, every action kept.
- `components/registrar/ProgramsTableClient.tsx`: the Programs list; the desk in Registration.
- `components/RegistrationForm.tsx`, `components/UpdateForm.tsx`: grouped questions, answers by id; the three `RegistrationField` types made one.
- `components/FilterBar.tsx`, `components/FormDone.tsx`: every filter and every answered save.
- `components/HubWorkspaceSidebar.tsx`, `components/WorkspaceShell.tsx`: the new apps in team rails.

CSS prefixes/areas:
- `pe-`, `vol-`, `hs-`, `rg-`/`pg-form__`: reused.
- New `rgd-` (Registration) and `hlp-` (helpers' pages) inside the authenticated readability contract; no new tokens.

API routes:
- `POST /api/programs-pg` and `PUT /api/programs-pg/[slug]` (modified): assign question ids on the server; the capacity guard; `registrationOpensAt`; save only fields sent, with a check that the program wasn't changed since it was opened (`updatedAt`); unticking a team moves its questions to the registration team; Phase 3 helpers; Phase 4 reminder and follow-up fields.
- `PATCH /api/registration/[slug]/settings` (new): open or closed, opens on, places, closing date, mailing list; same rules, guard and `updatedAt` check.
- `POST /api/registration/[slug]/people` (new): add a person, through the same server path as the public registration POST (shared helper).
- `POST /api/registration/[slug]/message` (new): message people, sent one at a time in `after()`.
- `/api/registrations/[id]/notes` (new): notes, under the existing `[id]` segment.
- `PATCH/DELETE /api/registrations/[id]` (modified): record history; return only the fields the page needs (no `editToken`, `stripeSessionId`; amounts only by rule).
- `GET /api/programs/[slug]/registrations` (modified): explicit fields; the CSV takes columns from the current questions plus any old answers, and notes from the new table; each download recorded.
- `POST /api/programs/[slug]/send-reminder`, `/api/update/[token]` (modified): record history; the update merges by id.
- `POST /api/registrations` (public, modified): answers by id; the shared add-a-person path.
- `POST /api/programs-pg/[slug]/notice` (new): writes `specialAnnouncement` and `announcementUntil`, optionally emails registrants in `after()`.
- `POST /api/programs-pg/[slug]/copy` (new): through the create path.
- `POST /api/registration/[slug]/attendance` (new, optional).
- `GET /api/flodesk/segments`: re-gated to Registration's rule.
- `PUT /api/admin/hubs/[slug]` (hub rename): no change needed, as built: `program_helpers` and `askedBy` name a team by its id, which a rename keeps (2026-10-24).

Email templates (each seeded in `prisma/migrate.mjs` in the same commit, `findUnique → create`, `enabled: true`, sent through `sendTemplatedEmail` with a `notice`):
- `registration-cancelled` (new): to the person, when the registration team cancels them.
- `registration-message` (new): a message from the registration team.
- `program-notice` (new): a posted notice, when "also email" is ticked.
- `program-follow-up` (new): the note after a program ends.
- Unchanged: `registration-confirmation`, `session-reminder` (sent at the new time), `waitlist-approval`, `dana-reminder`, `registration-dana-receipt`, `registration-support-notification` (its button text "View in Program Manager" and link updated), `edit-request`, `responses-updated-internal`, `registration-cancelled-internal`, `registrar-role-assigned` (its links updated).

Other features this connects to:
- **Scheduler:** unchanged. Teams that prepare live in their own table, which the Scheduler, coverage notices, the Zoom door and `supportingTeamRefusal` never read (checked against every reader of `ProgramCoverageHub`).
- **Zoom door:** unchanged. "Not open yet" is never stored as registration-off, so a program's access doesn't change while it waits to open.
- **Course access** (`lib/courseAccess.ts`): reads "opens on" for its currently-registering check.
- **Flodesk** (`lib/flodeskRules.ts`): same rules; the setting moves to Registration; a copied program never inherits last year's segment.
- **My Home:** the teacher's Today row links to the teacher's page; the greeter link waits on decision 5.
- **Notifications** (`lib/notifications.ts`): the `program-` notice kinds added to its Programs type.
- **Member merge** (`lib/memberMerge.ts`): the new author and actor columns added to the list it moves, and merges that cancel a duplicate registration recorded in history.
- **Team Home and Updates** (`lib/hubApps.ts`): Programs' current line ("new registrations in the last seven days") replaced by one without people; Registration and Helping with get their own lines.
- **Team rail and Home:** the three places that hide the Program Manager by role (`app/api/hubs/[slug]/nav/route.ts`, the team layout and team Home) follow the new Programs rule.
- **Member Registry:** its registration links point to the new program page.
- **Stripe, dana step, receipts:** unchanged; history records their events.
- **Course Manager:** untouched.
- **Tutorials:** the Program Manager and registrar tutorials redrawn after Phases 1 and 2.
- **Backlog:** closes `2026-06-04-007` and `2026-06-25-002`; part of `2026-10-14-004`; the program-to-course link still has no screen.

Design principles that apply:
- **Clear seeing:** each person sees the work in front of them, and every page says why they see it.
- **Designing for people under pressure:** one dominant action per state; every action asks first and is answered where the person is looking.
- **Restraint:** helpers' pages replace sharing rather than adding to it.
- **Community not anonymous**, with privacy for dana and answers set by who is asking.
- **One filter grammar** and the shared team-app contract.

## Data changes, and their safe order

All additive (nullable columns, new tables, `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) in `prisma/migrate.mjs` outside any flag block. Code reads the old shapes until data moves (the "additive column, data first" rule). New tables are keyed by `programId`, not the slug, so a slug change or deletion can't orphan them.

1. **Question identity, server-assigned.** Each `registrationFields` item has an `id`: the existing `_key` where it has one (the public form and update page already key fields by `_key`; the editor never set it, so new questions render `reg-custom-undefined` today), otherwise a new one assigned by the save route, never by the browser. `askedBy` defaults to `registration`. A one-time, flag-guarded backfill adds missing ids and nothing else. The three `RegistrationField` types become one.
2. **Answers by id, old answers kept.** `answerFor(registration, field)` reads `customFields[field.id] ?? customFields[field.label]`. New answers are written by id. The update page merges by id and keeps every old key; no old answer is rewritten.
3. **`registration_events`** (id, programId, registrationId set null, actorId set null, kind, detail, createdAt), written through `recordRegistrationEvent` (modelled on `lib/hubEvents.ts`) at every choke point: the public POST, add a person, `PATCH`/`DELETE /api/registrations/[id]`, the Stripe webhook, decline-dana, the cleanup cron, the reminder senders, the update route, `sendRegistrationConfirmation`, exports, merges. History starts when it ships.
4. **`registration_notes`** (id, registrationId, authorId set null, body, forTeacher, createdAt). An old `notes` value shows as "An earlier note". Notes go with a registration only when a cancelled registration is deleted on purpose (today's delete rule).
5. **`program_helpers`** (programId, hubId (the team's id, so a rename keeps it), canReach, createdAt; unique per program and team), checked by `helperTeamRefusal` (the team is active and has Helping with installed).
6. **Program columns** `registrationOpensAt`, `reminderDaysBefore`, `followUpEnabled`, `followUpMessage`; **Registration** `followUpSentAt`.
7. **`registration_attendance`** (optional, Phase 3).

## Phases

### Phase 1: Registration becomes its own app

The people move out of the Program Manager; nothing about programs changes yet.

1. **Rules in one place:** `canUseRegistration(roles)` (Registrar, Admin, Guiding Teacher) and `canSeeDanaAmounts(roles)` (the same three, a separate rule so it can't drift). Every page and API that returns registrations uses them and selects its fields explicitly.
2. **Data:** steps 1 to 4 above.
3. **The desk** (`/tools/registration`): what needs a person across programs (a place opened with someone waiting, dana not finished, a reminder about to go out), each with its action and an inline confirmation; then what's going out soon; then the programs taking registration.
4. **A program's people** (`/tools/registration/[slug]`):
   - the state sentence, and Needs you;
   - Registration settings, folded, with Save and its answer. Places can't drop below the places taken, counted by one shared helper the public POST also uses. Closed says what happens to the people waiting. The mailing list moves here.
   - Add a person (the shared registration path: account, confirmation, Flodesk, course access), Message people, Print or download (recorded);
   - People with FilterBar filters, and a person's answers, authored notes, history and actions;
   - the History tab.
5. **Moves and links:**
   - the old roster address redirects from its page file;
   - the list links to `/edit`;
   - the three email links, the support email's button text, `registrar-role-assigned`'s links, the Notifications label and the Member Registry link are updated;
   - `/api/flodesk/segments` is re-gated;
   - Programs' Home line loses its registration count.
6. **The app contract:** `registration` in `lib/toolRegistry.ts`, primary in the Registration team (Programs becomes its supporting app), with a provider in `lib/hubApps.ts`. The ten answers below are recorded in `RIM_Hub_Engineering.md`.
7. **Emails:** `registration-cancelled`, `registration-message`, each seeded with its code, bulk sends one at a time in `after()`.
8. **New pages follow the date rule:** registrations, events and notes are passed to client components as plain values (dates as text), as the roster page does today.
9. **Docs:** new `RIM_Registration_App.md`; `RIM_Registration.md` and `RIM_ProgramEditor.md` point to it.

Done when: every action today's roster offers works from the new page, the old address redirects, an account without one of the three roles can't open Registration, no response carries an edit token, and the harness passes.

### Phase 2: The program editor as one page

Same data; a new arrangement, and saves that can't overwrite each other.

1. **Sections** in the mockup's order (About; When and where; Who's helping, holding today's hosting team, No host needed, supporting teams and teachers; How people join; What we tell them; Dana; Where it appears), a section list ("Jump to" on phones), Save with its answer, and the unsaved-changes guard.
2. **Saves send only what changed,** with an `updatedAt` check. A save from Programs can't undo a setting just changed in Registration, and the reverse is also true. If the program changed meanwhile, the editor says so and offers to reload.
3. **Ready to be seen** at the top, from the same rules as today's readouts.
4. **Post a notice** in the header: writes `specialAnnouncement` and `announcementUntil`, with "Also email the N registered" (`program-notice`).
5. **Registration as one kind-aware control:**
   - **Off:** registration off, today's meaning, for programs people join without registering.
   - **Opens on [date]:** stored as registration on with a future `registrationOpensAt`. This way waiting to open never changes who can get in, the Zoom door's public join, or the mailing-list default.
   - **Open.**
   - **Closed.**

   "Opens on" is read by the program page, the register page (with the same allowance that lets someone finishing their dana in), the registration POST, `lib/courseAccess.ts`, the program list's attention flags and the desk.
6. **The capacity guard** in `PUT /api/programs-pg/[slug]`, with the same shared count.
7. **Access (decision 1):**
   - In `lib/toolRegistry.ts`, Programs' single home team becomes an allowed list of two: the Registration team and Program Central. Programs isn't scoped to a team's own programs, so it isn't installable in any team.
   - The three role filters in the rail and team Home follow the new rule.
   - Archive, restore, delete, the guest-link reset and categories stay role-only.
   - Programs never shows people or amounts.
8. **Docs:** `RIM_ProgramEditor.md` rewritten for the sections.

Done when: every field in today's seven tabs saves exactly as before (payloads compared field by field), simultaneous saves from both apps keep both changes or warn, and the program page, This Week, My Home and the Zoom door behave the same.

### Phase 3: Who's helping, who's asking

1. **Data:** `askedBy` in the editor; `program_helpers`; attendance (optional). The hub rename route carries both; unticking or archiving a team moves its questions to the registration team.
2. **Who's helping** in the editor:
   - teachers (`ProgramTeacher`), the hosting team, and supporting teams (`ProgramCoverageHub`, unchanged);
   - teams that prepare (`program_helpers`, refused unless `helperTeamRefusal` passes);
   - each with its one line of what it sees, and "can reach people" for teams that prepare.
3. **Questions grouped by who's asking** in the editor, the public form and the update page, each group with its heading and "Read by" line.
4. **Helpers' pages**, each with "Why you see this". Admin alone doesn't open a team's or a helper's page (the existing rule that Admin doesn't pass a team's door); Admin works in Registration.
   - **Teacher** (`/account/teaching/[slug]`): new to RIM, what they told you (written answers and notes for the teacher), choice questions counted with names, everyone coming, and person cards with email and phone; no dana. Open to the program's teachers and the Guiding Teacher.
   - **A supporting team's session page** (`/account/greeting/[slug]?date=`): any supporting team on that session, not greeters by name. Shows the names, that team's answers and arrivals; no contact, no dana. Open to people assigned that session in that team (including standing rows with no date), that team's active coordinators, and the Guiding Teacher. The My Home link depends on decision 5.
   - **Teams that prepare** ("Helping with", `/tools/helping`): how many are coming and that team's answers with names; contact only with "can reach people". Open to active members of the helping team.
5. **New to RIM** (decision 4) on the roster, its filter, the desk and the teacher's page.
6. **The four-layer team audit** for Helping with and both personal pages (who can act, who's told, what's shown, where links lead), recorded in `RIM_Hub_Engineering.md`.

Done when: moving a question to another helper changes the form, that helper's page and the person cards together, and no helper page shows dana or, without permission, contact details.

### Phase 4: What we tell them, and starting a program

1. **Reminders counted from the start** (`reminderDaysBefore`, default 2 for new programs; when both are set it wins over `reminderDate`, which stays for older programs):
   - The send day is counted in Central calendar days, at 9 AM Central. Counting 48 hours back would send a day late for a morning start.
   - The daily run sends to everyone confirmed who hasn't had it, from the reminder day until the program begins, so people who register after it went out still get it. Today the run only looks back 24 hours, so a late registrant gets it only if a registrar sends it by hand.
   - The run skips archived programs.
   - For a program with several sessions it's sent once, before the first; people who join after the first session don't get one automatically (said in the editor).
2. **A note after** (`followUpEnabled`, `followUpMessage`, `program-follow-up`):
   - a daily cron entry in `vercel.json` sends it the day after a one-time program ends;
   - `followUpSentAt` per registration keeps it to once.
3. **"Send an update to the N registered,"** offered when time, place or messages change after people registered.
4. **Start from a shape** (defaults in code, keyed by Format).
5. **Copy a past program,** through the create path:
   - **Kept:** words, questions, helpers, dana and settings.
   - **Never kept:** people, the address, the guest link, the mailing-list segment, archived status, the reminder date, deadlines, opening dates or the notice.
   - New dates are required.

## The team-app gate, answered

| | Registration | Helping with |
|---|---|---|
| 1. Spaces | Primary-space: the Registration team | Multi-space: any team that prepares for a program |
| 2. Primary, icon | Primary in the Registration team; its own icon (person with a check) | May be primary in a team that only prepares; its own icon (hand with heart) |
| 3. Scope | Every program taking registration; role-only | Only programs where this team is a helper; only its own questions |
| 4. Home | One line: "N programs need you", computed as the desk computes it | One line: "Helping with N programs this month" |
| 5. Updates | None at first (history lives on each registration) | None at first |
| 6. Attention | Registrars: a place to offer, dana to follow up | None at first |
| 7. Counts | Owned by the app | Owned by the app |
| 8. Install and remove | Base Home, Conversations, Files and Members unaffected | Same |
| 9. Same Space everywhere | Links carry the team | Links carry the team |
| 10. Four-layer audit | Before release | Before release |

## What must never change

- **Registering and paying:** the public registration flow, the dana step, Stripe, the webhook and receipts behave as today.
- **Entry:** the Zoom door admits exactly whom it admits today; waiting for registration to open never changes access.
- **Scheduling:** the Scheduler, rotations and coverage notices read nothing new.
- **No self-cancel:** no member cancels their own registration (the standing decision).
- **Old answers** are never rewritten or lost.
- **Old notes** are never deleted, except with a cancelled registration deliberately deleted.
- **Addresses:** a program's address never changes once people registered (already enforced).

## How each phase is checked

- `npx tsc --noEmit`, and `node scripts/check-member-redesign.cjs`, extended for:
  - `canUseRegistration` and `canSeeDanaAmounts`;
  - `answerFor`, including old answers stored by wording;
  - the shared seat count;
  - the kind-aware registration control;
  - reminder days across the November time change.
- A reviewer sub-agent on the staged diff before each commit.
- The render harness from `UP_NEXT.md` for pages behind sign-in, measured at 1280 and 390.
- Jesse signed in for the first real save in each phase; nothing written to production by hand.
- Each new template seeded in the same commit and visible at `/admin/emails`.

## To check once everything is built

Jesse, 2026-10-24: everything to look at is saved here for one thorough session after the last phase, rather than checked piece by piece. Add to it as each phase lands; tick nothing off until that session. Production writes for a test go to the Dummy Test Program (hidden, kept for testing) and only with Jesse's yes.

**Read-aloud (all wording provisional until then):**
- *Ruled 2026-10-25 (Jesse):* the seven section names: About, When and where, **Teachers and teams** (was Who's helping), How people join, **Messages to those who register** (was What we tell them), Dana, Where it appears; **Supporting teams** (was Auxiliary role coverage). Below, the old names stand in the items as written.
- *Ruled 2026-10-25 (Jesse):* Teachers and teams' box reads "Three kinds of team." with a line for Teams that prepare ("teams that help ahead of time, such as a kitchen team. They see how many are coming and the answers to their own questions."); the Registration choice and its four lines, and Opens on, read fine.
- *Ruled 2026-10-25 (Jesse, on my holistic recommendation, seen in a preview):* Messages to those who register rebuilt as three emails in order: "Three emails, in the order people get them. To add a link in any of them: …"; "When they register" ("The confirmation, sent as soon as someone registers. Add what to bring, how to prepare, or directions."); "Before it begins" ("The reminder."; Days before, On a set date, No reminder); "After it ends"; "Something changed, like "Cancelled tonight"? Use Post a notice at the top of this page, once the program is saved."
- *Ruled 2026-10-25 (Jesse):* How this appears to visitors: "Registration is closed. Visitors see that it's closed, with no form." / "Registration isn't open yet. Visitors see the date it opens, with no sign-up button until then." / "Registration is open. Visitors see a Register button. Once it's full, new sign-ups join the waiting list." / "Open entry: visitors see how to join. No registration needed." / "Registration is off. Visitors are told it isn't open yet, with no sign-up button. Choose Open below when you're ready to take sign-ups." The open entry lines stand. By the same no-em-dash rule, five more editor help lines (Dana's note, My Home's show-from date, self-led, the schedule and time labels) lost theirs.
- *Ruled 2026-10-25 (Jesse):* Ready to be seen and Post a notice read fine. Who's asking reads fine; the teams renamed in /admin/hubs (a name only: no email, no Drive folder change, addresses unchanged): **Greeter → Greeter Team** (`greeter`), **Audio/Visual → Audio/Visual Team** (`audio-visual`), so the form reads "For the Greeter Team". Capacity's help: "The most who can register. Leave blank for no limit. Once it's full, new sign-ups join the waiting list." 
- *Ruled 2026-10-25 (Jesse):* the start page reads fine as written, shapes, copy list and the questions they fill in; Drop-in keeps "people come as they are" (my suggested "people simply come" not taken).
- *Ruled 2026-10-25 (Jesse):* "Tell the people registered?" reads fine. He noted much of it is filled in from the program; the filled-in parts (what changed, the count, the When and Where lines, the program's own schedule words) are to be looked at in the trial with real values.
- *Ruled 2026-10-25 (Jesse):* the teacher's page, Today's list and Helping with read fine; Teams that prepare's help ends "Dana is never shown." (was "Never dana.").
- *Ruled 2026-10-25 (Jesse):* the Registration desk reads fine; Going out soon now lists the note after too ("The note after, [day], at [time]" / "To everyone who had a place (N now)"), so nothing automatic goes out unseen.
- *Ruled 2026-10-25 (Jesse):* the top of a program's page in Registration reads fine; "…goes out in the next morning run." became "The note after the program goes out the next morning." 
- *Ruled 2026-10-25 (Jesse):* the settings fold reads fine (Registration, Opens, Places, Closes, Mailing list, the segment picker and every note).
- *Ruled 2026-10-25 (Jesse):* the People tab reads fine: filters, Needs you, each card (Contact, Their place, Dana, Their answers, the note box) and every action's question and answer.
- *Ruled 2026-10-25 (Jesse):* Add a person, Message people, the sign-in list and the spreadsheet read fine as written ("Email them their confirmation email" kept; my "Send them their confirmation" not taken).
- *Ruled 2026-10-25 (Jesse):* History's lines read fine, all of them.
- *Ruled 2026-10-25 (Jesse):* the public opening lines read fine; the program page's adds "CT" like every other time there ("Registration opens on Saturday, November 1 at 9:00 AM CT.").
- *Ruled 2026-10-25 (Jesse):* the four new emails (registration-message, registration-cancelled, program-notice, program-follow-up) and the editor's "Someone else changed …" message read fine; the two sign-offs stand (the registration team's for theirs, Rooted In Mindfulness for the program's).
- *Ruled 2026-10-25 (Jesse):* the editor's save messages, the Scheduler's and Rotations' empty lines and the old categories page's note read fine. **The read-aloud is complete.**
- The program editor: the seven section names; "Two kinds of team." and its lines; the save messages that name a section ("Under About: …", "Under How people join: …", "Under When and where: …", the closing-before-opening refusal); Jump to; the Registration menu (Off, Not open yet, Open, Closed) and its four help lines; Opens on; the visitors readout's new lines; What we tell them's notice line; the corrected reminder help ("goes out on this day, in the morning…"; "What the reminder email says.").
- Who's asking (Phase 3 slice 2): "Asked by" and its choices ("The registration team", "The teacher, [name]", "The teachers", "The [team]"); the questions' new help line; on the form and the update page, the group titles ("For the registration team", "From [name], your teacher", "From your teachers", "For the [team]") and "Read by … and the registration team." (Note: until the helpers' pages land in slices 3 to 5, only the registration team can actually read the answers; "Read by your teacher" becomes true with slice 3, a team's with slices 4 and 5.) The team choices use each team's name as set in /admin/hubs, so live they read "The Greeter", "The Audio/Visual", and the form would say "For the Greeter": decide whether to rename the teams ("Greeter Team") or give each team a phrase of its own ("the greeters at the door").
- The teacher's page (Phase 3 slice 3): "Teaching" in the menu; the list ("Choose a program to see who's coming and what they told you.", "Programs you teach", "Programs you oversee", the empty state); the page's state lines, "You see this because…", "First registration here" and its note, "What they told you", "No question on the form is asked by you…", "Notes from the registration team", "Everyone coming", "Open a name for their email, phone and what they told you.", "Waiting for a place: …"; My Home's "Who's coming →".
- Today's list (Phase 3 slice 4): My Home's "Today's list →"; the page's line ("For the [team]"), "You see this because you're [greeting] this session." / "…you lead the [team]." / "…you're the guiding teacher.", "It shows who's registered and lets you mark them arrived. Contact details and dana aren't shown here.", "N people are registered · N here", "Arrived", "Here ✓", "No one is registered for this session.", "People don't register for this program, so there's no list. Welcome everyone who comes."
- Helping with (Phase 3 slice 5): Who's helping's "Teams that prepare", its help line, "No team has Helping with installed yet…", "Can reach people: sees their email and phone"; the app's name, "Open Helping with", Home's "N programs to help with" / "No program to help with right now."; its pages ("The programs the [team] prepares for…", "N coming", "You see this because the [team] prepares for this program…", "What they told the [team]", "No question on the form is asked by this team…", "Everyone coming").
- Reminders (Phase 4 slice 1): "The reminder", "Days before it begins", "On a set date", "No reminder", "days before the first session", "It goes out on [day], in the morning, to everyone registered, and each morning after to anyone who registers later, until it begins.", "A program with several sessions is reminded once, before the first."; Registration's "…and each morning after to anyone who registers later, until it begins" and "anyone who registers now gets it the next morning".
- The note after (Phase 4 slice 2): "After it ends", "Send a note the day after", "It goes out on [day], in the morning, to everyone who had a place. A thank-you, a reading, a word about what comes next.", the repeating program's line ("A note after is for one-time programs: a program that repeats doesn't end."), the save message ("Under What we tell them: write the note sent after the program, or turn it off."); Registration's "The note after the program goes out [time], to everyone who had a place.", "…went out to N people.", "…goes out in the next morning run.", "…didn't go out." and History's "sent the note after the program to N people"; the email `program-follow-up` ("Thank you for [program]", its closing and footer).
- Send an update (Phase 4 slice 3): the save note's "The people registered haven't heard: see below."; "Tell the people registered?", "You changed [the time, the place and the confirmation message]. The N people registered still have it as it was. Here's an update to send them; change it as you like.", the draft ("A change to [program]", "There's a change to [program].", "When: …", "Where: …", "Where: online. You join from the program's page, by the button below.", "If this changes your plans, reply to this email and let us know."), "Send to the N people registered", "Email this to N people now?", "Yes, send to N people", "Not yet", "Send me a test", "Not now", "The update is going to N people now, one at a time. It's kept in Registration's History."; ", starting [day]", ", N sessions"; "That's more than 50 can be emailed from here: send the update through the program's Flodesk segment."; "You saved another change after writing this. Check it still says everything; your words are kept as you wrote them."; "We couldn't confirm it was sent. Check Registration's History before sending again."; and for someone without the registration roles, "You changed …. People have registered, and they won't hear about it unless the registration team sends them an update."
- Start from a shape (Phase 4 slice 4): "What are you offering?", "Choose a shape to start from. Everything it fills in can be changed before you save.", the six names and their lines, "Start →", "Start with a blank program →", the editor's "← What are you offering?", "The teacher, once one is chosen (the registration team until then)"; the five questions and their choices.
- Copy a program (Phase 4 slice 5): "Or copy a program", "A copy keeps the words, questions, teachers, helpers, dana and settings, and asks for the new dates.", "It never copies the people registered.", "Copy →", "Another program", "Choose a program", "Copy", "That program wasn't found to copy. Choose another below."; the editor's "A copy of [program]" and its lines; the save message "Under When and where: set this program's dates. A copy starts without them."
- Ready to be seen: its title, "Before it's ready: …", and each line.
- Post a notice: the button ("Post a notice", "Change the notice"), "Notice up now:", the panel's help, "Also email the N people registered", "Post the notice", "Take the notice down", "Close", and the answers ("Posted. It shows on…", "It's being emailed to N people now.", "The notice is taken down.").
- The public pages: "Registration opens on [day] at [time]." (program page); "Registration opens on …" and "Come back then to sign up. Times are Central." (register page); the sign-up's refusal before the date.
- The Registration app: Not open yet and Opens in settings, the mailing-list notes and segment picker ("Use an existing segment instead", "Choose a different segment", "Make a new segment at the first registration"), the desk's "Opens …", and History's new lines ("chose the Flodesk segment …", "set registration to open on …", "removed the opening date", "posted the notice …", "took the notice down"); and from Phase 1, the desk, Needs you, cards, panels, confirmations and History lines.
- Emails: `program-notice` and `program-follow-up` (new); from Phase 1, `registration-message` and `registration-cancelled`; the editor's "someone else changed …" message.
- Elsewhere: the Scheduler's and Rotations' empty lines ("…under Who's helping → Hosting team"), the old categories page's "under How people join".

**Try for real, signed in (the first real use is the test):**
- *Trial 1, 2026-10-25 (Jesse's yes):* created **Trial Workshop** (`trial-workshop`) from the Workshop shape: Mon Oct 26, 10 to 11 AM CT, in person at RIM, Jesse as teacher, no host needed, no teams, Private, Voluntary dana, reminder 2 days before, the note after on ("Thank you for being part of this trial."). Saved as set; nothing sent. The shape, the teacher's questions following the linked teacher, and Ready to be seen worked.
- *Trial 2, 2026-10-25 (Jesse's yes):* added Jesse to the Trial Workshop with Add a person (No dana, confirmation ticked): "Jesse Foy is registered. Their email is on its way to jesse@…"; his phone came from his account; answers filled on his card ("Their answers are saved."); History "Jesse Foy added them", "Jesse Foy edited the answers"; the settings read "Automatic (off)" for a Private program; Going out soon listed the note after (Tue Oct 27, 10 AM). Still to see: the confirmation email and the Notifications row (Jesse's inbox), and the reminder Mon Oct 26 ~9 AM CT and the note after Tue Oct 27 ~10 AM CT.
- *Trial 3, 2026-10-25 (Jesse's yes):* moved the Trial Workshop to 10:15 to 11:15 AM and saved: "Saved at 10:30 PM. The people registered haven't heard: see below."; "Tell the people registered?" drafted "A change to Trial Workshop" / "There's a change to Trial Workshop. / When: October 26, 2026, 10:15–11:15 AM CT / If this changes your plans, reply to this email and let us know."; a test went to Jesse; on his OK of the draft, "Email this to 1 person now?" then "The update is going to 1 person now, one at a time. It's kept in Registration's History."; History: "Jesse Foy sent a message to 1 person: A change to Trial Workshop".
- *Trial 4, 2026-10-25:* the teacher's page for the Trial Workshop: listed under Programs you teach; "1 person is coming."; "You see this because you teach this program…"; What they told you ("Some: 1 Jesse Foy"; "Jesse Foy: Testing the trial."); Everyone coming. Two small things to decide: the "First registration here" heading still shows when its line is "Everyone coming has registered here before." (hide the heading then?); the page's line gives the day without the time ("October 26, 2026 · In person"). Also: Programs you oversee didn't appear for Jesse (every current program he oversees he also teaches?), and "Taking CARE Foundations" is listed with no day.
- *Trial 5, 2026-10-25 (Jesse's yes):* posted "Meeting in the community room." through Mon Oct 26 with the email: "Posted. It shows on the program's page, Programs & Events, This Week and My Home through Monday, October 26. It's being emailed to 1 person now."; on the program page; History "posted the notice … and emailed 1 person"; then "The notice is taken down." and History "took the notice down". (A first post went without the email because my automation set the box without a click; History shows that post too.) To decide: the answer names Programs & Events and This Week even for a Private program, which is listed on neither; say only where it actually shows? Not seen: the notice on My Home (it shows on the program's day, and it was taken down the night before).
- The editor: a real save after the split; two people saving at once (both apps); removing the image and adding, moving or removing a question each mark the page unsaved; leaving with unsaved changes asks first; the section list and Jump to at 1280, 900 and 390.
- Opens on, on the Dummy Test Program: set a date ahead in the editor, then see the program page, the register page, a sign-up attempt, the Programs list badge, the desk, a linked course; change it in Registration's settings; let it pass and see it open; try a closing date before the opening date in both apps.
- Post a notice, on the Dummy Test Program with one test registrant: post with the email, see the email, the Notifications row, History, the four places it shows; take it down; a Show until day that clears the next morning.
- The mailing list in Registration: choose an existing segment; see the History line.
- Ready to be seen on a new program, an open program, and one missing a Category.
- Answers by question id (Phase 3 slice 1), on the Dummy Test Program: register with an answer; reword the question in the editor and see the answer follow it in Registration and the spreadsheet; change an answer from the emailed link and as the registrar; an older registration (answers stored by wording) still shows its answers in both places.
- Who's asking, on the Dummy Test Program: give one question to the teacher and one to the Greeter Team; see the form and the update page group them, and a program with only registration questions look as before; untick the team and see its question go back under the registration team; rename a team in /admin/hubs and see its question stay with it.
- The teacher's page, on the Dummy Test Program: link yourself as its teacher; see Teaching in the menu (rail and phone); open the page with a test registrant who answered a teacher question, a note "for the teacher too", and someone waiting; check that a registrar without the Guiding Teacher role and not teaching can't open it; My Home's "Who's coming →" on the day.
- Today's list, on the Dummy Test Program: sign up to greet a session; see "Today's list →" on My Home that day; open it with a test registrant who answered a greeter question; mark them arrived and take it back; check a greeter not on that session, and an admin without the guiding teacher role, can't open it; on a phone at the door.
- Helping with: an admin installs Helping with in a team (say a Kitchen Team) in /admin/hubs; on the Dummy Test Program tick it under Teams that prepare and give it a question; see the team's Home line, its list and the program page with a test registrant's answer; tick and untick "Can reach people" and see email and phone appear and go; untick the team and see its question move to the registration team; check a member of another team, and an admin who isn't on the team, can't open it.
- Reminders, on the Dummy Test Program: set 2 days before; see Registration's Going out soon and the program page; after it goes, register a test person and see the reminder arrive the next morning; check a person on the waiting list doesn't get it.
- The note after, on the Dummy Test Program: set it to end today with a note and one test registrant; the next morning see the email, the Notifications row and History's line; check a person on the waiting list and a cancelled person don't get it, and that a program archived before it ends sends nothing.
- Send an update, on the Dummy Test Program with one test registrant: change the time and save; see the offer under Save, its draft, Send me a test, then send it; see History's line and the email; save a second change before sending and see the draft grow; as a Program Central member without a role, see only the line; change only the outside meeting link or a description and see no offer.
- Start from a shape: start each shape and look at what it filled (no save needed); save one, a Retreat, as a test program and see the questions and the meals team (once one exists); as a Program Central member without a role, start a Retreat and save it.
- Copy a program: copy the Dummy Test Program and look at what came across and what didn't (no save needed); copy a past retreat, set new dates and save it as a hidden test program; check its address, that no one is registered, and that its guest link is new; as a Program Central member without a role, copy a program with team questions and save it.
- Still owed from Phase 1: Add a person, the cancellation email, a group message, a settings save in Registration, a Program Central member without a role opening Programs.

**Noticed, to decide then:**
- Every tool page carries a hidden second copy of its content (the streamed `#S:0` segment stays in the page); it shows nothing, but doubles the page's markup and repeats ids. Look at why before launch.
- The editor's option cards (the round choices) show no keyboard focus ring; the pattern predates this work.
- The Programs list now counts a program past its closing date as Closed (it used to say Open), by the one rule.
- Answers by id (Phase 3 slice 1): a registration form left open while its questions were removed or reworded (before they had ids) now drops those answers on submit, since the server keeps only the program's own questions; before, they were stored under the old wording. Likely fine; decide then.
- The teacher's page (slice 3), two decisions: (1) My Home's Today lists only online sessions for a teacher, so a teacher of an in-person program gets no Today row (and no "Who's coming →") on the day; Teaching in the menu reaches it. Add in-person teaching days to Today? (2) A teacher keeps the page, with everyone's email and phone, for an archived or finished program by its address, for as long as the program exists. Close it some time after the program ends? Also: a recurring series that has ended but isn't archived keeps Teaching in the menu.
- Who decides who sees people's answers (slice 5 review): choosing who asks a question and which teams prepare (and whether they can reach people) is now limited to the Registrar, Admin and Guiding Teacher roles, on the server and in the editor (a Program Central member without a role sees them locked). Before, any Programs editor could give a team they belong to everyone's email and phone. Keep it there, or widen it?
- The note after (Phase 4 slice 2): on a program whose day has passed, the editor's help still reads "It goes out on [that past day]"; turning it on then sends nothing (the run only looks three days back). Say "This program has ended" instead? Rare, since finished programs are archived.
- Start from a shape (Phase 4 slice 4), decisions: (1) places: no shape fills a capacity; should a Course, Day or Retreat start with one, and how many? (2) dana: the registration shapes start as Voluntary, Drop-in and Class as None; right, or should a Retreat start as Base + Dana? (3) Drop-in and Class keep the editor's In person; most of RIM's drop-ins are online. Should they start Online? (4) the meals team is found by its name (kitchen or meal); name it directly once the team exists. (5) registration is on from the first save for Course, Workshop, Day and Retreat, before there may be a date (a blank start begins with it off); start them as Not open yet, or Off? (6) the mockup had the shapes tick the greeters and turn on the note after; they don't, since adding the greeters emails the whole team at the first save and the note needs its words. Give the note starting words for a Retreat, and add the greeters when a date is set?
- Copy a program (Phase 4 slice 5), decisions: (1) a copy keeps the teachers (the mockup's "helpers"); right, or should next year's teacher be chosen fresh? (2) it keeps the outside meeting link, right for a group that meets in someone else's room each year, wrong for a one-off event link; reset it? (3) it keeps the Program Notes, pull quote and image as they were.
- Found in the trials (2026-10-25): (1) the reminder's line names a past day when the send day has passed ("It goes out on Saturday, October 24…" for a program on the 26th, which will in fact be reminded the next morning), like the note after's past day; (2) creating a program opens its edit page with no word that it was created (the Save note is empty on arrival). (3) Add a person has no place for the program's questions (filled afterwards on the card with "Change their answers"); add them to the panel? (4) Add a person's dana choice starts on "They'll give online", which emails a payment link; should it start on no choice, so the coordinator picks? (5) *Fixed the same day:* Registration's program page said "The reminder email went out Saturday, Oct 24" for a program created on the 25th, and the desk left that reminder out of Going out soon; both now follow when it next goes (`nextReminderRun`) and count who has had it. New wording to hear: "The reminder email went out to N people; the M people who haven't had it yet get it [day]." / "The reminder email goes out [day], to everyone registered." / "The reminder email goes out the morning after someone registers, until it begins." and Needs you's "N people haven't had the reminder." (was "registered after the reminder went out", untrue when nothing had gone). (6) *Fixed the same day:* History showed "Jesse Foy opened the sign-in list to print" though no one printed: it was kept whenever the sign-in page loaded; now it's kept when the page prints (the Print button or the browser's own Print), once per visit. (7) *Fixed:* "The 1 person registered still have it as it was" now "still has".
- Helping with (slice 5): like the teacher's page, a team that can reach people keeps a finished or archived program's contact list by its address. Close it some time after the program ends?
- Today's list (slice 4): opened by its bare address (no date), it shows today's date and time even when the program doesn't meet today; My Home's link always carries the day. Default to the program's next session instead?
- Today's list (slice 4): someone walking in who isn't registered has no place on the list; the mockup's "Someone not on the list? Add them" (handing a name to the registration team) wasn't built. Wanted?
- Programs with registration on but no reminder message: the reminder still goes out on its date; check what it says without one.

## Not in this plan (waiting, or later)

- Teacher-written questions and helper comments (decision 2).
- Waitlist offers that expire.
- A dana distribution view.
- Several people in one registration.
- Transfers.
- Refunds in the app.
- A support or scholarship request.
- Duplicate merging.
- Approval before a place.
- The program-to-course link screen.
- Redrawing the tutorials (after Phases 1 and 2).
