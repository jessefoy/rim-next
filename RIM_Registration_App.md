# RIM Registration app — the per-tool reference

**Read this before writing or modifying any code on `/tools/registration` or the registration APIs it calls.**

The Registration app is the registration team's place: who's coming to each program, what needs a person, dana, notes and history. It is being separated from the Program Manager, which sets programs up. The concept, the decisions and the phased plan live in `mockups/registration-2026-10-23/` (`CONCEPT.md`, `BUILD_PLAN.md`, the mockup). Read `RIM_Registration.md` for how registering works (statuses, dana, the confirmation choke point); this doc covers the app.

---

## Where it stands (Phase 1, slice 1, 2026-10-23)

Built and live. The old roster address (`/tools/programs/[slug]`) redirects here from its page file, keeping `?hub=`; `VolunteerTable` is gone. The Programs list's name opens the editor, and a People action opens the program here. The app is registered but not installed in any Space: installing it in the Registration team's Space (primary, with Programs supporting) is an admin action in `/admin/hubs`.

Slice 2 (same day): **Add a person** and **Message people**. Slice 3: the printed sign-in list, the cancellation email to the person, the move from the old roster, Programs' Home line without people.

Slice 4: **question ids**. `lib/registrationFields.ts` `withQuestionIds` gives every question in `Program.registrationFields` a stable `_key` on save (`POST /api/programs-pg`, `PUT /api/programs-pg/[slug]`): its own, else the stored question with the same wording, else a new `q_…`. Programs get ids as they are next saved; no stored data was rewritten. The public form and the update page fall back to the question's position for older questions (they all rendered `reg-custom-undefined`). Removing every question now clears them (the save used to keep them). **Answers are stored by the question's id** since Phase 3 slice 1 (2026-10-24, `lib/registrationAnswers.ts`): the public form and POST (only the program's own questions; an older form's answers by wording are accepted), the update page and route and the registrar's edit (merged over what's stored, never replaced), this app's cards and the spreadsheet (a column per current question, then one per old answer no question has). A question saved before ids keeps its wording as its key until the program is next saved. Old answers stored by wording are never rewritten: `answerFor` reads the id, then the wording. Each answer stored by id keeps its question's wording in the reserved `_labels` entry, so an answer to a removed question shows under its words, never a raw id. Saving writes only answers whose value changed (an unchanged save leaves the stored JSON exactly as it was, and records no history). After a save the editor takes back the ids the server gave new questions, so rewording one before reloading keeps its answers. A form loaded before its questions were removed or reworded (without ids) loses those answers on submit: the server keeps only the program's own questions. The harness checks it.

Slice 5: **history from the public paths.** Giving dana online (the Stripe webhook, inside its once-per-payment guard), declining it, the cleanup cron marking no dana after a day, the scheduled reminder (with the people it reached, so it shows on each card), and someone changing their answers from the emailed link. What a person did themselves reads under their own name (`SELF_EVENT_KINDS`); what the system did reads "RIM …".

Slice 6: **registration settings** on the program page (`components/registration/RegistrationSettings.tsx`, folded under Needs you): open or closed, places, the closing date (Central), the mailing list (automatic, on, off) and, since 2026-10-24, its Flodesk segment. `PATCH /api/programs/[slug]/registration-settings` writes only those fields (none of the editor's save side effects run), refuses places below the places taken (registered plus held), and saves only if the program's `updatedAt` still matches the page's (`updateMany` on id and updatedAt), else asks for a reload. A History line names what changed. Turning registration on or off stays in the editor. **The mailing list lives only here** (2026-10-24, Phase 2): "Use an existing segment instead" (or "Choose a different segment") loads `GET /api/flodesk/segments` (now `canUseRegistration`) and offers Flodesk's segments; "Make a new segment at the first registration" only while none is linked (Flodesk can't rename or delete one). The segment is sent only when chosen here, its name is read from Flodesk, never the request, and History says "chose the Flodesk segment …". The notes line names the segment, or the name a new one will take (`programSegmentName`). Since Phase 2's safe saves (2026-10-24) the editor sends only what it changed and is refused a field changed here meanwhile, so neither can undo the other.

Phase 1's pieces are built. "Going out soon" (2026-10-24) lists on the desk each automatic reminder due in the next two weeks, with its real sending time (the daily send runs at 14:00 UTC: 8 AM Central in winter, 9 AM in summer; `reminderSendsAt`, `fmtSendTime`), and the program page says the same. 2026-10-24: "Send the reminder now to N people" on the program page while the automatic reminder is still to come (asks first, naming them; they don't get it again), and one count of places for every place that counts them (`lib/registrationPlaces.ts` `countPlacesTaken`: the public form and pages, Add a person, the settings, the editor). Installed 2026-10-23 in the Registration team's Space (`/admin/hubs/registrar/edit`): Registration primary, the Program Manager supporting. Its Home button reads "Open Registration" (`openLabel` in the registry). Left for Jesse: his read-aloud of the two new emails. Left for later: pruning the roster's leftover `vol-` CSS (`scripts/css-prune.mjs`), and answers keyed by question id (Phase 3). See `BUILD_PLAN.md`.

## Routes

| Path | What it does |
|---|---|
| `app/tools/registration/layout.tsx` | Gate (`canUseRegistration`), ToolsProvider, WorkspaceShell. |
| `app/tools/registration/page.tsx` | The desk: Needs you across programs, Programs taking registration, then a fold of other programs with registrations. Keeps `?hub=`. |
| `app/tools/registration/[programSlug]/sign-in/page.tsx` | The printed sign-in list: registered names by last name and a box to tick. No contact details, answers or dana. Opening it is a History line. Print CSS hides the site and team chrome (`body:has(.reg-print)`). |
| `app/tools/programs/[programSlug]/page.tsx` | Redirects to this app's program page. |
| `app/tools/registration/[programSlug]/page.tsx` | One program: state line, Needs you, People and History. Explicit select: never `editToken` or `stripeSessionId`; `donationAmount` only when `canSeeDanaAmounts`. `?show=waiting|dana` opens that filter. |
| `components/registration/RegistrationPeople.tsx` | The client: filters (FilterBar), each person's card, notes, history. Every change calls the APIs below, then `router.refresh()`; nothing is held in client state as truth. |
| `lib/registrationDesk.ts` | One reading of a program for both pages: `registrationState`, `placesLine`, `programNeeds`, `programWhen`. |
| `lib/registrationEvents.ts` | `recordRegistrationEvent` (best-effort, never fails the change) and `describeRegistrationEvent` (the history sentence). |

## APIs

| Route | Gate | Notes |
|---|---|---|
| `PATCH /api/registrations/[id]` | `canUseRegistration` | Status, dana status, answers, the old notes field, and the email actions. Records history. Returns only `{ id, status, donationStatus, waitlistPosition }`. |
| `DELETE /api/registrations/[id]` | `canUseRegistration` | Cancelled only. Deletes its notes; its history stays with a "deleted" line. |
| `POST /api/registrations/[id]/notes` | `canUseRegistration` | Adds a note (up to 4000 characters). |
| `POST /api/programs/[slug]/people` | `canUseRegistration` | Add a person. Follows the public POST where it matters: the program's record decides place and dana; an existing account (or former address) is linked and keeps its names; a new person becomes a member (`agreedToTerms: false`, they agree at first sign-in); a place gives course access; the confirmation goes through `sendRegistrationConfirmation` (or, unticked, only the Flodesk add). May add after registration closes; refuses an archived program or one with registration off. Already here by account or address (registered, waiting, cancelled, or a place held while paying online) is a 409 that says where they are. Full: they join the waiting list; if the page's place-or-waiting no longer holds, a 409 asks for a reload. Dana: cash or check is received; no dana; or "they'll give online", which emails the dana link (`dana-reminder`) and leaves the confirmation to the dana choice (webhook, decline, or the 24-hour cron), the system's rule that a registered person with dana not finished hasn't been confirmed yet. Sending the confirmation at once as well sent it twice (review, 2026-10-23). A price still to be paid gets course access on payment, as on the public form. Nobody is charged. |
| `POST /api/programs/[slug]/message` | `canUseRegistration` | Message people (also the program editor's Send an update, 2026-10-24, which sends to the registered): registered, waiting, or both; `test: true` to the sender only. Sent one at a time in `after()` (`sendEachPaced`), capped at 50 people, well inside `maxDuration = 300`; one email per address; a bigger group belongs to the program's Flodesk segment. One history line with the subject, message and the people it reached (shown on each person's card too). |
| `POST /api/programs/[slug]/send-reminder` | `canUseRegistration` | The reminder to registered people who haven't had it. Records one history line. |
| `GET /api/programs/[slug]/registrations` | `canUseRegistration` | The spreadsheet (`?format=csv`). Explicit select. A download is recorded in history. |

## Emails

- `registration-message` (`sendRegistrationMessageEmail`, group 02-registrations): the team's subject and message, shown exactly as typed (`memberText`), Reply-To the registrar's inbox, a notice in the person's Notifications (kind `registration-message`, Programs). The test copy says "[Test]" and records no notice. Wording provisional until Jesse's read-aloud.
- `registration-cancelled` (`sendRegistrationCancelledEmail`, group 02-registrations): to the person when the team cancels them and leaves "Email them" ticked on the confirmation (the default). `notifyPerson: true` on the PATCH. The registrar's own notice (`registration-cancelled-internal`) is unchanged. Wording provisional.
- Links: the support@ notice's button ("View in Registration"), `registration-cancelled-internal` and `responses-updated-internal` (`{{volunteerUrl}}`) and the registrar-role notice now open Registration, inside the Registration team's Space (`hubScopedUrl(…, "registrar")`, the hub audit's layer 4); their template bodies are unchanged.
- Add a person sends the existing confirmation or waiting-list email through the choke point (which also notifies support@).
- `program-notice` (`sendProgramNoticeEmail`, group 02-registrations, 2026-10-24): sent from the program editor's Post a notice when "Also email the people registered" is ticked (Registrar, Admin, Guiding Teacher only); to everyone with a place; its History line shows here. Wording provisional.
- `program-follow-up` (`sendFollowUpEmail`, group 02-registrations, 2026-10-24): the note after a one-time program ends, set in the editor's What we tell them; sent by the daily `send-follow-ups` cron to everyone with a place, once each (`followUpSentAt`). Its History line shows here, and the program page names when it goes. Wording provisional.
- **Not open yet** (2026-10-24): the settings' Registration menu is Open · Not open yet · Closed; Not open yet shows an Opens date and time (Central) and saves `registrationOpensAt` (History: "set registration to open on …"). The desk reads "Opens Nov 1, 2026, 9:00 AM". Whether a program takes sign-ups is one rule, `lib/registrationWindow.ts` (`RIM_ProgramEditor.md`).

## Home lines

Registration: new registrations in the last seven days. Programs (2026-10-23): programs taking registration (on, not closed, before the deadline, not over), no people.

## Access

- `canUseRegistration` (`lib/toolAuth.ts`): Registrar, Admin, Guiding Teacher, **by role only**. Today the same people as `canUseProgramManager`, but its own rule, so opening Programs to setup teams (Phase 2) never opens people's details. Team membership never opens it.
- `canSeeDanaAmounts`: Registrar, Guiding Teacher, Admin (Jesse, 2026-10-23). The server leaves `donationAmount` out for anyone else.
- `canSeeInstalledApp`: the Space rail and Home hide Programs and Registration from members without the role (the three filters in `hub/[slug]/layout.tsx`, `hub/[slug]/page.tsx`, `api/hubs/[slug]/nav`).

## Data

- `registration_events` (`RegistrationEvent`): no relations, like `hub_events`. Kinds in `REGISTRATION_EVENT_KINDS`. Signing up is not an event; the page reads each registration's `createdAt` into the history.
- `registration_notes` (`RegistrationNote`): written once, author and date. `forTeacher` exists for Phase 3 (the teacher's page) and is not offered yet. The older `Registration.notes` field shows read-only as "An earlier note"; the old roster still edits it.
- Both in `memberMerge.ts` POINTERS (`actorId`, `authorId`).

## Counting rules

A held place (`PENDING_PAYMENT`) is never a registration. `APPROVED` counts as registered. "Dana not finished" is `PENDING` on a registered person (not waiting, not cancelled). "Registered after the reminder" needs a reminder date that has passed and a program that isn't over.

## Hub App Integration Gate

Registered in `lib/toolRegistry.ts` as `registration`: `primary-space` for `registrar`, may be primary, icon `registration` (`UserRoundCheck`), Home `summary` (new registrations in the last seven days), no Updates, no attention. Provider in `lib/hubApps.ts`. No hub-slug branches.
