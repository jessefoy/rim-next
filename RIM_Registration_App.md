# RIM Registration app — the per-tool reference

**Read this before writing or modifying any code on `/tools/registration` or the registration APIs it calls.**

The Registration app is the registration team's place: who's coming to each program, what needs a person, dana, notes and history. It is being separated from the Program Manager, which sets programs up. The concept, the decisions and the phased plan live in `mockups/registration-2026-10-23/` (`CONCEPT.md`, `BUILD_PLAN.md`, the mockup). Read `RIM_Registration.md` for how registering works (statuses, dana, the confirmation choke point); this doc covers the app.

---

## Where it stands (Phase 1, slice 1, 2026-10-23)

Built and live. The old roster address (`/tools/programs/[slug]`) redirects here from its page file, keeping `?hub=`; `VolunteerTable` is gone. The Programs list's name opens the editor, and a People action opens the program here. The app is registered but not installed in any Space: installing it in the Registration team's Space (primary, with Programs supporting) is an admin action in `/admin/hubs`.

Slice 2 (same day): **Add a person** and **Message people**. Slice 3: the printed sign-in list, the cancellation email to the person, the move from the old roster, Programs' Home line without people.

Slice 4: **question ids**. `lib/registrationFields.ts` `withQuestionIds` gives every question in `Program.registrationFields` a stable `_key` on save (`POST /api/programs-pg`, `PUT /api/programs-pg/[slug]`): its own, else the stored question with the same wording, else a new `q_…`. Programs get ids as they are next saved; no stored data was rewritten. The public form and the update page fall back to the question's position for older questions (they all rendered `reg-custom-undefined`). Removing every question now clears them (the save used to keep them). **Answers are still stored by wording**: moving them to ids (`answerFor`) waits for Phase 3, where questions gain who's asking, so the public form, the update page, the spreadsheet and this app change once, together.

Slice 5: **history from the public paths.** Giving dana online (the Stripe webhook, inside its once-per-payment guard), declining it, the cleanup cron marking no dana after a day, the scheduled reminder (with the people it reached, so it shows on each card), and someone changing their answers from the emailed link. What a person did themselves reads under their own name (`SELF_EVENT_KINDS`); what the system did reads "RIM …".

Phase 1 is complete with this slice. Left for Jesse: installing Registration in the Registration team's Space (`/admin/hubs`), and his read-aloud of the two new emails. Left for later: pruning the roster's leftover `vol-` CSS (`scripts/css-prune.mjs`), and answers keyed by question id (Phase 3). See `BUILD_PLAN.md`.

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
| `POST /api/programs/[slug]/message` | `canUseRegistration` | Message people: registered, waiting, or both; `test: true` to the sender only. Sent one at a time in `after()` (`sendEachPaced`), capped at 50 people, well inside `maxDuration = 300`; one email per address; a bigger group belongs to the program's Flodesk segment. One history line with the subject, message and the people it reached (shown on each person's card too). |
| `POST /api/programs/[slug]/send-reminder` | `canUseRegistration` | The reminder to registered people who haven't had it. Records one history line. |
| `GET /api/programs/[slug]/registrations` | `canUseRegistration` | The spreadsheet (`?format=csv`). Explicit select. A download is recorded in history. |

## Emails

- `registration-message` (`sendRegistrationMessageEmail`, group 02-registrations): the team's subject and message, shown exactly as typed (`memberText`), Reply-To the registrar's inbox, a notice in the person's Notifications (kind `registration-message`, Programs). The test copy says "[Test]" and records no notice. Wording provisional until Jesse's read-aloud.
- `registration-cancelled` (`sendRegistrationCancelledEmail`, group 02-registrations): to the person when the team cancels them and leaves "Email them" ticked on the confirmation (the default). `notifyPerson: true` on the PATCH. The registrar's own notice (`registration-cancelled-internal`) is unchanged. Wording provisional.
- Links: the support@ notice's button ("View in Registration"), `registration-cancelled-internal` and `responses-updated-internal` (`{{volunteerUrl}}`) and the registrar-role notice now open Registration; their template bodies are unchanged.
- Add a person sends the existing confirmation or waiting-list email through the choke point (which also notifies support@).

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
