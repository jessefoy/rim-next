# RIM Registration app — the per-tool reference

**Read this before writing or modifying any code on `/tools/registration` or the registration APIs it calls.**

The Registration app is the registration team's place: who's coming to each program, what needs a person, dana, notes and history. It is being separated from the Program Manager, which sets programs up. The concept, the decisions and the phased plan live in `mockups/registration-2026-10-23/` (`CONCEPT.md`, `BUILD_PLAN.md`, the mockup). Read `RIM_Registration.md` for how registering works (statuses, dana, the confirmation choke point); this doc covers the app.

---

## Where it stands (Phase 1, slice 1, 2026-10-23)

Built and live beside the old roster. The Program Manager's roster (`/tools/programs/[slug]`) still works exactly as before and links to the new page ("Open in Registration"). Nothing is redirected yet; the app is registered but not installed in any Space (installing it in the Registration team's Space is an admin action in `/admin/hubs`).

Still to come in Phase 1: add a person, message people, a printed sign-in list, question ids, history from the public paths (Stripe webhook, cron, decline), the redirect and link updates, the cancellation email to the person, the Programs Home line. See `BUILD_PLAN.md`.

## Routes

| Path | What it does |
|---|---|
| `app/tools/registration/layout.tsx` | Gate (`canUseRegistration`), ToolsProvider, WorkspaceShell. |
| `app/tools/registration/page.tsx` | The desk: Needs you across programs, Programs taking registration, then a fold of other programs with registrations. Keeps `?hub=`. |
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
| `POST /api/programs/[slug]/send-reminder` | `canUseRegistration` | The reminder to registered people who haven't had it. Records one history line. |
| `GET /api/programs/[slug]/registrations` | `canUseRegistration` | The spreadsheet (`?format=csv`). Explicit select. A download is recorded in history. |

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
