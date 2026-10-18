# RIM Scheduler — the per-tool reference

**Read this before writing or modifying any code on `/tools/schedule` or its supporting routes.**

This is the per-tool reference for the Scheduler. It catalogs what the tool does, what code implements it, what hub semantics apply, and the patterns to follow when extending it.

For broader hub rules see `RIM_Hub_Engineering.md`. For email rules see `RIM_Email_Engineering.md`. This doc is the operational ground truth for *this specific tool*.

---

## What it is

The Scheduler is the team tool for managing live session coverage. Every hub that hosts programs has its own scoped view of the Scheduler — host-team sees host-team programs, peer-led-silent-meditation sees peer-led-silent-meditation programs.

Two top-level tabs:
- **Schedule** — month-by-month view of upcoming sessions, claim/release affordances, and sub-request UI. The dated session cards are the member's authoritative view of what they are covering; standing-rotation rules are not repeated above the schedule.
- **Rotations** — coordinator-only editor for standing host assignments. Hub-scoped per record as of session 129; any hub's coordinator can manage rotations in their own hub.

The tool was originally named "Host Schedule" when host-team was the only hub. Renamed to "Scheduler" in Slice 2 to read correctly across multiple hubs.

**Two hub modes** (session 129; open sign-up is set per team in `/admin/hubs` since 2026-10-15):
- **Single-slot** (host-team, peer-led, audio-visual). One claimant per session per hub. Rows render the historical "Host: Maria" + claim/sub-request affordances.
- **Multi-claim** (greeter). `Hub.allowsMultipleAssignments = true`. Open sign-up — many people on one session, no sub-request flow, "I'll be there" / "Cancel my signup" actions. Rows render as a community of people with plain-language state header, stacked names, and self-recognition marks. See *Multi-claim rendering* below.

**Formats** (session 129; set per team in `/admin/hubs` since 2026-10-15). `Hub.appliesToFormats` drives which `programFormat` values surface:
- Host-team / peer-led: `["virtual","hybrid"]`
- Audio-visual / greeter: `["in-person","hybrid"]`

---

## Routes

| Path | What it does |
|---|---|
| `app/tools/schedule/layout.tsx` | Tool chrome (ToolsNav, hub-context provider). Reads `?hub=<slug>` and exposes it to the page. |
| `app/tools/schedule/page.tsx` | The Schedule tab. Server component: access gate, then `buildHubMonthSessions` for the month. |
| `app/tools/schedule/program/[slug]/page.tsx` | One program's staffing across every team that may staff it now (`teamCannotStaff`), live rotations only. |
| `lib/scheduleSessions.ts` | `buildHubMonthSessions`: the one builder of Scheduler rows, and the row types the clients use. |
| `lib/programHub.ts` | The shared rules: `resolveHostingHubSlug`, `teamCannotStaff`, `hostingTeamRefusal`, `clearCoverageNoLongerStaffed`, coverage copy and config. |
| `components/HubScheduleClient.tsx` | Client component for the Schedule tab (calendar nav, claim, cover requests, member picker). |
| `components/RotationsClient.tsx` | Client component for the Rotations tab; its preview follows the engine's dates. |
| `app/api/host/assignments/route.ts` | GET one team's month (`?month=YYYY-MM&hub=`, required) + POST (self-claim or coordinator assign). |
| `app/api/host/assignments/[id]/route.ts` | PATCH (claim, release) and DELETE. |
| `app/api/host/assignments/reassign/route.ts` | POST: a coordinator takes over an existing assignment, in one transaction. |
| `app/api/host/sub-requests/route.ts` | POST (ask the team to cover). The old team-blind GET listing was removed (2026-10-15). |
| `app/api/host/sub-requests/[id]/claim/route.ts` | POST (cover an open request). |
| `app/api/host/standing-assignments/*` | Rotation save, preview, apply, end, release. Every route gates on `canManageHubCoverage` with the rotation's own team. |
| `app/api/host/programs/[slug]/clear-rotations/route.ts` | Reset one program's rotations on one team. |
| `app/api/host/assignments/clear/route.ts` | "Reset this team": `future` deletes upcoming assignments; `all + endRotations` wipes the team's schedule. Other teams untouched. |
| `app/api/admin/hubs/[slug]/route.ts` | Team settings, including the Scheduler's open sign-up and formats, and a slug rename that carries the schedule with it. |

---|---|
| `app/tools/schedule/layout.tsx` | Tool chrome (ToolsNav, hub-context provider). Reads `?hub=<slug>` and exposes it to the page. |
| `app/tools/schedule/page.tsx` | The Schedule tab. Server component. Filters programs and rotations by `?hub=`. |
| `components/host/HubScheduleClient.tsx` | Client component for the Schedule tab interactivity (calendar nav, claim, sub-request, member picker). |
| `components/host/RotationsClient.tsx` | Client component for the Rotations tab. |
| `app/api/host/assignments/route.ts` | GET (list for month) + POST (create/self-claim). |
| `app/api/host/assignments/[id]/route.ts` | PATCH (claim, release). |
| `app/api/host/assignments/reassign/route.ts` | PATCH (coordinator override — reassign a session to a different host). |
| `app/api/host/sub-requests/route.ts` | GET + POST (create a sub request). |
| `app/api/host/sub-requests/[id]/claim/route.ts` | POST (claim an open sub request). |
| `app/api/host/standing-assignments/*` | Standing-rotation CRUD. Currently host-team-only at the gate level. |
| `app/api/host/programs/[slug]/clear-rotations/route.ts` | Coordinator: clear all rotations on a program. Hub-scoped (session 129 audit) — accepts `hubSlug` body field, gates by `isHubCoordinator + ADMIN`, scopes deletes per hub so an AV coordinator clearing AV rotations doesn't touch host-team data on the same program. |
| `app/api/host/assignments/clear/route.ts` | "Reset this team" — hub-scoped nuclear reset (session 129 audit). Requires `hubSlug` body field. Gate: hub coordinator OR ADMIN. Scope `future` deletes upcoming HostAssignments; `all + endRotations` wipes everything in this hub. Other hubs untouched. |
| `app/api/host/schedule/pdf/route.ts` | PDF export of "my schedule" — uses `@react-pdf/renderer`. |

---

## Integrity audit, 2026-10-15 (Jesse: "we just duplicated and applied it to the other hubs")

A five-part read-only audit (route gates and scoping; hard-coded team assumptions; duplicated logic; emails, My Home and team Home; production data). **Production data was clean** (70 upcoming assignments, 19 rotations: every row on a team that covers the program, in a format it serves, every person a member, no doubles). The defects were in code, mostly one class: a rule computed in two places, or checked only where the schedule is shown and not where it is changed.

**Fixed the same day (`071afba`):** only a program's hosting team (`Program.hostingHubSlug ?? "host-team"`) hosts. Greeter and AV sign-ups never make someone the session's host, never open the room early on My Home, never get "Enter room" in the Scheduler, and aren't Zoom staff at the door (Jesse: AV uses the hall's own logged-in computer; greeters serve in person). "No host needed" clears only the hosting team's coverage.

**Jesse's rulings (2026-10-15):**
- **A hosting-team change clears the old team's future assignments and rotations** (what the save does); the editor's warning and this doc's "grandfather policy" are corrected to say so.
- **Rotations on open sign-up teams are additive:** a rotation adds its person to the sign-up list and never replaces anyone; a conflict is only the same person already signed up.
- **The daily rotation skips paused members.**
- **My Home keeps Join until the door closes** (end + the late grace), matching `/enter`.

**Step 1, broken today (done, `82751fa`; migrations confirmed in production):** PATCH claim gated on the retired HOST role (volunteers can't retake a removed session; managers claim anywhere without membership); coverage emails format dates in UTC (evening sessions show the next day); month bounds in UTC (last-evening sessions show "needed"); cover links lack `month=` and `SubRequest.sessionDate` is never set; a coordinator's Remove on a rotation date is undone by the next cron; an empty greeter session renders as a single-slot row; greeters' emails mention subs, and the removal email says "reassigned" when nobody was; team Home's open-request count never clears and Updates name the wrong requester; the month route drops the NEW badge.

**Step 1 left these rules in place (read before changing the Scheduler):**
- **Every self-claim goes through `authorizeSelfClaim`** (`lib/hubMemberAuth.ts`): access, then coverage allowed, then enrollment. PATCH claim and the sub-claim use it; POST still has its own copy until step 2.
- **Dates are Central Time** through `lib/timezone.ts`: `fmtSessionDay` for any date in an email, `ctMonthKey` for `?month=`, `ctMonthBounds` for a month query, `ctStartOfToday` for "still ahead".
- **A rotation-made session emptied by hand records a `StandingSkip`** (rule + CT date) in the same transaction; the engine won't refill it (the whole seat on a one-person team, that rule's person on an open sign-up team). Saving a slot with a different person clears that slot's skips.
- **The engine fires a rotation only where its team covers the program, in a format the team serves**, and only for ACTIVE members with coverage allowed.
- **`SubRequest.requestedById` is whose session it was**, set from the assignment; `sessionDate` comes from the assignment, never the body.
- **Coverage emails take the team's terms**: `changeNoteText` / `changeNoteHtml` in `lib/email.ts` (open sign-up teams cancel; one-person teams ask for a sub). The `host-assignment-confirmation` template carries `{{changeNote}}`.

**Step 2, structural (done, `4e3838c`):** one row builder; one staffing rule checked on every write; one coordinator gate; apply and preview held to the rotation's own team; reassign takes over a real assignment in one transaction; the unused all-teams `GET /sub-requests` and the no-month `GET /assignments` removed; open sign-up rotations additive; a start-time edit re-times future assignments; a save that leaves a team out clears that team's future coverage; the rotation preview and the staffing page match the engine; "today" in every host route is Central midnight (on Vercel's UTC clock "end this rotation today" recorded yesterday, and "future" clears caught last night's sessions).

**Step 2 left these rules in place (read before changing the Scheduler):**
- **One builder for the Scheduler's rows:** `buildHubMonthSessions(hubSlug, year, month0)` in `lib/scheduleSessions.ts`. The page and `GET /api/host/assignments?month=` both call it; `ScheduleSessionRow` / `ScheduleProgramSummary` are the client's types. Never build rows anywhere else.
- **One rule for "may this team staff this program now":** `teamCannotStaff(hubSlug, programSlug)` in `lib/programHub.ts` (team active with the Scheduler installed, program not archived, team hosts or covers it, format in the team's formats, the hosting team only when a host is needed). Every create checks it: assignments POST, rotation save, the staffing page. The engine uses the same test inline (`teamCovers`).
- **One hosting-team resolver:** `resolveHostingHubSlug(program)`; don't write `?? "host-team"` again.
- **One coordinator gate:** `canManageHubCoverage(userId, roles, hubSlug)` in `lib/hubAuth.ts` (HOST_MANAGER, ADMIN, or that team's coordinator), always with the resource's own team, loaded from the row, never the request body. A member placing themselves goes through `authorizeSelfClaim`; placing anyone else needs the gate.
- **A rotation's people:** someone new must be able to cover now; someone already on it may be paused (the engine skips them) but not gone from the team.
- **Open sign-up rotations add, never displace:** a rotation person joins whoever is signed up; within one rotation the 5th-week person still replaces the every-week person, as the preview shows.
- **A program save clears only what it changed:** `clearCoverageNoLongerStaffed(programSlug, onlyHubs)` judges just the teams this save affected (a team unticked, the old hosting team, every staffing team on a format change), and deletes their future assignments (SubClaim → SubRequest → HostAssignment) and rotations. A switched-off Scheduler or an archived program clears nothing.
- **Central "today" is `ctStartOfToday()`**, never `new Date(toLocaleString(…TZ))` with `setHours(0)`: on a UTC server that is 7 pm the evening before.
- **A schedule change clears what no longer fits (Jesse, 2026-10-16: "they should be cleared. I don't like a lot of junk in our system if it's not being used.").** When the days a program meets change (the start's Central date, frequency, interval, days, count, or a one-time program's end date; a time-only edit doesn't count), `clearOffScheduleCoverage(programSlug)` in `lib/programHub.ts` deletes every team's future assignments on dates the program no longer meets, and rotations that can't match any meeting in the coming year by the engine's own test (weekday, nth week, last). The people who had cleared sessions get one `sessions-cleared-schedule-change` email per team listing the dates; the editor says what was cleared beside Save. Rotation holders with no dated session to lose aren't emailed: the coordinator sets up the new days.

**Step 3, new teams by configuration (done, `7f3b757`):** `/admin/hubs` sets open sign-up and formats, with guards against changes that would break the schedule; a team's slug rename carries its programs, schedule and Files with it (the Hosting Team's can't move); the Hosting team list and both program routes use `hostingTeamRefusal`; the editor's warning matches the ruling; coverage wording fits every team (dialogs, notices, rotations, members page, staffing page) and empty states branch on the team's kind, not its slug; releasing a member's sessions works on open sign-up teams and holds their rotation dates. The checklist is "Adding a scheduling team" below. Follow-ups closed 2026-10-16: off-day sessions and dead rotations are cleared on a schedule change (above), and a rename rewrites custom app links in any Space that point at the team's own pages (`retargetTeamLink` in `lib/linkInput.ts`: RIM paths and RIM full URLs only, `/account/hub/<slug>` and `hub=<slug>`; other sites' links are left alone).

### The deep audit, 2026-10-16 (Jesse: "make sure that this is done right and the integrity of these systems is sound")

Five parallel read-only audits (hosting leakage outside the Scheduler; every write path and cron; every notification; the UI by team kind; walking three hypothetical new teams through setup) plus a production invariant check. Fixed in `4fa231d`. An honest correction first: step 3 said the Rotations tab's wording fit every team. It didn't ("schedule a host", "Host every week", "Each affected host is emailed" were still there); it does now.

**Production data:** clean except two things, both awaiting Jesse's approval to repair: 11 upcoming Awakening the Heart sessions stored an hour off the program's start (made by the June rotation, before start-time edits re-timed sessions), and two cover requests from May still open on past Peer-Led sessions.

**Rules this audit left in place (read before changing the Scheduler):**
- **A session is its program, its team and its Central day** (`ctDayBounds` in `lib/timezone.ts`), never an exact timestamp. The Zoom door, the designated-host line and the create path all match this way; the create path stores the program's own start for that day and refuses a day the program doesn't meet. Exact matching had hidden the Awakening the Heart host from the door.
- **A seat is taken only if still empty:** claims use a conditional update (`updateMany` where `userId` is null), the create path runs its check and write under `pg_advisory_xact_lock` on the session, and cover claims/cancels act only while the request is OPEN. Known residue: the 3 am rotation run doesn't take the lock; its race with a manual claim is theoretical at that hour.
- **Taking a person off their sessions is one function,** `releasePersonCoverage` (`lib/applyStandingAssignments.ts`): an open sign-up is removed, a seat emptied with its cover request closed, rotation dates held (a pause) or rotations ended (archive, Inactive, deletion). Account deletion also hands rotations the person created to the deleting admin.
- **Everyone a change takes off sessions is told,** by `sendCoverageClearedEmails` (template `coverage-sessions-cleared`), with one sentence of reason from the caller and the team as `teamPhrase` gives it ("the Greeter team", "the Hosting Team"). Wired into: hosting-team change, "No host needed", a team unticked or out of format, an admin format drop or a team stopping, a member's sessions opened, the team Reset, a program's rotation Reset, removal from a team. Not for the person who made the change; not for archive or deletion (no sign-in to come back to). The schedule-change case keeps its own template.
- **A team newly responsible for a program is told** (moved to it, needs a host again, or moved into its format).
- **The server applies the editor's lists:** `hostingTeamRefusal(team, format)` and `supportingTeamRefusal(team, format)` run before anything is written; the editor sends only ticked teams that still fit.
- **A team can't stop scheduling with work in hand:** archiving, removing the Scheduler or switching off "runs live sessions" is refused while it hosts programs, and clears its own sessions and rotations only after a confirmation that counts them. The engine skips archived teams, teams with the Scheduler off, and archived people.
- **The Scheduler offers only what the server allows:** claim and sign-up buttons follow `canSelfClaim`; pickers list people who can be scheduled (a paused person already on a rotation stays visible); no `?hub=` lands a member on their own team; a team without the Scheduler has no board; errors are words, not "Forbidden".
- **Account merge knows every person column,** including tables without a Prisma model (`reflection_responses`, `pages`). When adding a column that points at a user, add it to `lib/memberMerge.ts` or every merge of someone holding one fails.

**Jesse's rulings on the audit (2026-10-16), done in `2a84320`:**
- **Data repaired** (approved, snapshot first, one transaction): the 11 Awakening the Heart sessions now sit at 9:30 Central; the two May cover requests are closed.
- **"Sub needed" became the team's words:** `sub-request-posted` reads "Cover needed: …" and "… is asking someone to {{coverageAction}}: …" (flag-guarded, only where unedited).
- **Teacher-pill settings retired:** `Hub.assignmentGrantsTeacher`, `Hub.teacherLabel` and `Program.teacherLabel` are gone from the forms and APIs, with the session-role path that used them (it only ever applied to someone already the host). The columns stay, unused.
- **My Home names a supporting-team duty in Today** ("You're greeting", in the team's words, no button), or adds it to the program's own row.

**Found on the way: sessions drifted an hour across every time change.** `shiftToDate` (every placement: the Scheduler, the Zoom door and its window, rotations, seat conflicts, My Home) added 24-hour days, keeping UTC time, so from Nov 1 every program first dated in daylight time would have been placed an hour early, its door and Zoom meeting included. It now keeps the program's Central wall-clock time, and `centralToUtc` is exact on time-change days. Zoom meetings are found by program and Central day (`lib/sessionMeeting.ts`), so one made at a drifted time is reused, never doubled. **Rule:** a session's time comes from `shiftToDate`, and anything that finds a session matches its Central day, never the exact instant.

**Data now true (Jesse approved, 2026-10-16):** the 46 upcoming winter sessions the old placement had stored an hour early (The Art of Meditation on the hosting, AV and greeter teams; Essential Dharma Study; Meditation and Dharma Talk) were re-timed to 9:30 Central, same days and people, in one transaction after a snapshot. The production invariant check is clean.

**Still open, for Jesse:** a supporting team for **virtual** sessions can't enter the room without new engineering. The tool-wide button height is 40px against the 44px standard (a design-system call).

## Hub-scoping — every layer

Per `RIM_Hub_Engineering.md`'s "four routing layers" model:

**Capability gates (layer 1).** Self-claim, sub-claim, sub-request creation, and standing-rotation writes all route by the **resource's** hub. After session 129, the resource is the assignment itself (`HostAssignment.hubSlug`) or the rotation record (`StandingAssignment.hubSlug`) — not the program's primary hub. A peer-leader of `peer-led-silent-meditation` can claim sessions on peer-led programs; an AV volunteer can claim AV slots on hybrid programs whose primary is host-team. ADMIN bypasses.

**Notification recipients (layer 2).** Sub-request notifications route to `getHubNotificationRecipients(assignment.hubSlug, …)` — active members of the assignment's hub with `communicationsEnabled`. Slice 1 changed this from hardcoded `"host-team"` to per-program; session 129 narrows further to per-assignment (an AV sub-request notifies AV teammates, not host-team).

**UI filter (layer 3).** The Schedule page unions primary + auxiliary programs for the active hub via `getProgramSlugsForHub(activeHubSlug)`, then filters by the hub's `appliesToFormats`:
```ts
const eligibleSlugs = await getProgramSlugsForHub(activeHubSlug);
const programs = await db.program.findMany({
  where: {
    programFormat: { in: hubConfig.appliesToFormats },
    archivedAt: null,
    slug: { in: eligibleSlugs },
  },
});
```
Primary-hub coverage: programs with `hostingHubSlug = hub` (host-team picks up null + explicit via Prisma `OR`).  Auxiliary-hub coverage: programs with a matching `ProgramCoverageHub` row.

**Outbound URLs (layer 4).** Every email sent from a Scheduler action constructs URLs via `hubScopedUrl(path, hubSlug)` where `hubSlug` is the assignment's / rotation's own hub. Slice 2.5 established the helper; session 129 routes by the resource's hub so AV emails land in AV, etc.

---

## Coordinator coverage authority — the role model (sessions 142–143)

A **hub coordinator** (a `HubMember` with `isCoordinator=true` on the hub — NOT necessarily holding the global HOST_MANAGER role) is a manager *for their own hub's coverage*. The rule across every coverage mutation: **`isManager(roles) || isHubCoordinator(userId, resource.hubSlug)`**, scoped to the *resource's* hub (the assignment's or rotation's `hubSlug`, server-loaded — never a body value). A coordinator of hub A cannot touch hub B's coverage. **ACTIVE-only (session 171):** `isHubCoordinator` requires `status: "ACTIVE"` — a PAUSED/INACTIVE coordinator keeps board *visibility* (`canAccessHubScheduler` is deliberately status-blind) but loses coordinator *authority* until reactivated, matching `getEffectiveHostingCapability`'s ACTIVE gate on claiming and the `/admin/hubs` edit-page precedent. The Scheduler page's inline `isManager` computation carries the same filter so the UI and the route gates agree.

| Coverage action | Host volunteer | Hub coordinator (own hub) | HOST_MANAGER / ADMIN |
|---|---|---|---|
| Claim an open session · cover a sub · ask for cover on own · cancel own request | ✓ (self) | ✓ | ✓ |
| Assign a host (`POST /assignments`, s140) | — | ✓ | ✓ |
| Remove / unassign a host (`PATCH …/[id]` unclaim, `DELETE …/[id]`) | own only | ✓ | ✓ |
| Reassign to self (`POST …/reassign`) | — | ✓ | ✓ |
| Clear a cover request (`PATCH /sub-requests/[id]`) | own only | ✓ | ✓ |
| Request a sub on a host's behalf (`POST /sub-requests`, s143) | own only | ✓ | ✓ |
| Reset rotations / reset everything / clear-rotations | — | ✓ | ✓ |

**Implementation notes / pitfalls:**
- The PATCH `…/[id]` handler authorizes **per action, after loading the assignment** — there is intentionally no early system-role-only gate (an earlier `hasHubAccess`-style top gate *shadowed* the coordinator check and 403'd the very coordinator the change targeted; ship-3 review caught it).
- **Removing a host notifies them** (`sendHostAssignmentRemovedEmail`) only when the remover ≠ the removed user; self-removal is silent. This holds on **both** removal paths: single-slot `PATCH …/[id]` unclaim and the greeter `DELETE …/[id]` (session 143 — the DELETE serves both self-cancel and coordinator-remove, and `removedUserId !== session.user.id` is the distinguisher). The `host-assignment-removed` template is pre-threshold-gated, so staged accounts get nothing.
- UI affordances on covered/needs-sub rows are gated by `isManager` (which the page computes as `isHostManager || coordinator-of-the-active-hub`), **not** `isHostManager`.
- **Request-a-sub-on-behalf — now coordinator (session 143, was backlog `2026-06-08-001`).** `POST /sub-requests` gates `isManager || isHubCoordinator(assignmentHubSlug)` (greeter/multi-claim hubs are rejected earlier in the handler, so the widening can't reach them). UI: an **"Ask the team to cover"** button in the covered-row coordinator cluster (ordered ahead of Remove + Reassign) opens a distinct `ask-cover-for` modal whose copy names the host — so it never reads as "your session" — and reuses the existing sub-request POST + the covered→needs-sub optimistic transition. This **completed the role model**: every coverage mutation is now coordinator-capable for the resource's own hub.

## "No host needed" — `Program.hostingRequired` (session 142)

`Program.hostingRequired` (default true; the checkbox on the editor's Hosting & Access tab). False = self-led / community-led (Recovery Dharma, drop-in groups). **It governs the PRIMARY host only** — auxiliary AV/greeter coverage is independent and unaffected. Enforced consistently across:
- **View:** `getProgramSlugsForHub` filters `hostingRequired:true` on the **primary** branch only; the auxiliary (coverage) branch filters `archivedAt` only. So a self-led program with explicit greeter coverage still appears in the greeter scheduler.
- **Apply engine:** `generateCandidates` skips a self-led program's **primary-hub** rotations (`selfLedPrimaryHub.get(slug) === sa.hubSlug`) but lets its auxiliary-hub rotations apply.
- **Mutation guards:** the assignment + rotation POSTs refuse only when `targetHubSlug === programHubSlug` (the primary) — so a self-led program is still staffable in its auxiliary hubs. (These three layers must agree — the show-but-can't-staff mismatch was ship-5 review's finding.)
- **Per-program staffing page** (`/tools/schedule/program/[slug]`): shows a self-led program's auxiliary sections; 404s only if it has no coverage at all.
- Helper: `lib/programHub.ts::programNeedsHost(slug)` (reads `hostingRequired`; fail-safe true).

## Hub-relative copy reaches beyond the Scheduler (session 145)

The per-hub coverage copy (`getHubCoverageCopy` → noun/verb/action, session 130) governs more than the Scheduler card list. Session 145 finished wiring it through every scheduler-hub surface that still said "host":
- the **dashboard** first-login welcome panel ("you're on the {Noun} team") — the dashboard resolves the staged hub's noun and passes it to `HostWelcomePanel`;
- the **hub home/sidebar** coverage count (`lib/hubContext.ts`) — generalized from a host-team-only `case` to host-team / audio-visual / peer-led, each counting its OWN *hub-scoped* unclaimed slots in its own noun ("open AV slot"). Greeter (multi-claim) has no unclaimed-slot concept → no count. (Also fixed a latent bug: the old host-team count wasn't hub-scoped.)
- the **shared host/sub emails** (see `RIM_Email_Engineering.md`).
- Deliberately left "host": the dashboard early-open "Enter as host" names the live session-**room** role, not hub coverage.
- **Rule:** when you add a scheduler-hub surface that names the coverage role, resolve `getHubCoverageCopy(hubSlug)` — don't hardcode "host". The leak hides in the dashboard + email bodies, not just `/tools/schedule`.

## ⚠️ The Scheduler is one surface shared by FOUR hubs — always check both directions

host-team + peer-led (single-slot, virtual/hybrid) · audio-visual (single-slot aux, in-person/hybrid) · greeter (**multi-claim** aux, in-person/hybrid). **Any change to the Scheduler must be audited in both directions:**
1. **Does it need to propagate** to AV / greeter / peer-led? (Single-slot hubs share the host-team row shapes — "covered" / "needs-host" / "needs-sub" — so single-slot affordances reach AV + peer-led automatically. Confirm the route gate is hub-scoped, not host-team-hardcoded.)
2. **Does it pollute** the multi-claim (greeter) model? A greeter session always renders through `kind === "multi"` (it carries a `claimants` array; see `rowKind`), so the single-slot affordances (Remove / Reassign / Clear-request, which gate on `kind === "covered"` / `"needs-sub"`) **cannot** appear on greeter rows. Verify any new single-slot affordance stays in those branches. Greeter has its own affordances (sign-up / cancel-my-signup / per-claimant Remove for coordinators) and **no sub-request flow**. The assign-others picker is hidden on multi-claim rows (`!allowsMultipleAssignments`) because open sign-up rejects assign-others server-side.

---

## The membership invariant — "covers ⇒ member" (session 146)

**Every `HostAssignment` / `StandingAssignment` in a hub must belong to a current `HubMember` of that hub.** The Scheduler draws two lists from two tables — the assignment *ledger* (`HostAssignment` — "who's covering this session") and the team *roster* (`HubMember` — the member picker, "who's on the team"). When those disagree about a real person, a coordinator sees "Nancy is covering" but can't find Nancy in the picker: the show-but-can't-act failure (`feedback-clear-seeing-is-correctness.md`). The invariant keeps the two reconcilable by construction.

This is **NOT** a cross-hub entanglement bug and is **not** a reason to split the shared Scheduler — it's a referential-integrity gap that would exist in a per-hub-component world too (each component would still read `HostAssignment` for display and `HubMember` for its picker). The four routing layers were clean; this is a separate integrity axis. Enforced at five points + a one-time heal:

1. **Access gate (the door).** `lib/hubAuth.ts::canAccessHubScheduler(userId, roles, hubSlug)` — you can open a hub's Scheduler (`/tools/schedule?hub=X`, its month-nav GET, the create POST) only if you're a `HubMember` of X (any status — pause governs hosting, not visibility) **or** hold an oversight role (HOST_MANAGER / ADMIN / GUIDING_TEACHER). This per-hub gate replaced tool-level-only access: a host-team member can no longer switch `?hub=greeter` and sign themselves up there. Distinct from `getEffectiveHostingCapability` (which decides whether they may *claim*).
2. **Create-time.** Self-claim auto-enrolls the claimer if they lack a row (`lib/hubMemberAuth.ts::ensureActiveHubMembership` — silent, no-op for existing members, only on `action === "claim"`); assign-others requires the assignee already be an active hosting-capable member (`getEffectiveHostingCapability(assignee, hub, /* fallback */ false)` — **no role fallback for the person being placed**).
3. **Step-In.** `/api/livekit/step-in` also calls `ensureActiveHubMembership` after writing the HostAssignment — stepping in puts you on the roster too.
4. **Cron-time.** `generateCandidates` drops any candidate whose `(userId, hubSlug)` isn't a current member (defense-in-depth: a stray rotation rule can't have the daily cron resurrect an orphan).
5. **Removal-time.** The member hard-DELETE (`/api/hub/[slug]/members/[userId]`) cleans up that user's future HostAssignments (FK-safe SubClaim→SubRequest→HostAssignment) + StandingAssignment rules in that hub, in one transaction. Past stays as history. **This was the most likely original cause** — a member removed while their assignments remained.

**One-time heal:** migration `heal_membership_orphan_assignments_v1` (runs *after* `backfill_host_team_membership_v1`, which gives every HOST/HOST_MANAGER a host-team row so role-only hosts aren't misread as orphans) deletes future orphan assignments + orphan rules, logging each (name · hub · program · date). Future rows only; past coverage is historical record.

**When adding any code that writes a `HostAssignment` or `StandingAssignment`:** the assigned user must be — or become — a member of the row's hub. Use `ensureActiveHubMembership` for self-service writes; require membership with no role fallback for assign-others.

---

## A hosting-team change clears the old team (Jesse, 2026-10-15)

Supersedes the grandfather policy (session 128), which the code had stopped following. When a program moves to a new Hosting team, the save deletes the old team's future assignments (with their cover requests) and all its rotations for the program, in one transaction. The ProgramEditor warns before saving, with the count. The new team schedules from there. Supporting teams (AV, greeters) are untouched.

Only a team that runs sessions (`hasSchedule`), is active, and has the Scheduler installed can be chosen (`hostingTeamRefusal`; the editor's list uses the same rule and keeps a program's current team).

---

## Multi-claim rendering (greeter hub, session 129)

When `Hub.allowsMultipleAssignments` is true, the Schedule page renders one card per session that contains every signed-up volunteer rather than one card per claim. The row uses a **plain-language state header sentence** plus a **stacked list of names** with a **self-recognition mark** ("YOU" badge in `--rim-blue`) on the signed-in user's row. This is correctness-level UI, not polish — see `feedback-clear-seeing-is-correctness.md` for why the comma-separated CSV version was rejected.

State header sentences — role-aware via the hub's `coverageNoun` (lower-cased except "AV"), pluralized with a trailing `s` (session 146 follow-up: "We have N greeters" reads as the team it is, not a generic count):
- `count === 0` (not past): "No {noun}s yet — be the first?"
- `count === 0` (past): "No {noun}s"
- `count === 1 && mine`: "We have 1 {noun} — that's you"
- `count === 1 && !mine`: "We have 1 {noun}"
- `count > 1 && mine`: "We have {count} {noun}s — you're one of them"
- `count > 1 && !mine`: "We have {count} {noun}s"

Action button labels read as invitation, not transaction:
- Not signed up, no one else: "I'll be the first"
- Not signed up, others present: "I'll be there too"
- Signed up: "Cancel my signup"

No sub-request flow in multi-claim hubs — the open sign-up model doesn't have a "need a sub" semantic; the only exit is self-cancel. `/api/host/sub-requests` POST refuses on multi-claim hubs with a 400.

**Coordinator remove (session 142).** A coordinator/manager can remove *another* person's signup: a per-claimant "Remove" renders in the multi list (`isManager && !isMe && !isPast`) → `removeSignup()` → `DELETE /assignments/[claimant.assignmentId]` (the real HostAssignment id, not the synthetic `multi::` card id) → reload. The DELETE route is hub-coordinator-gated. Direct action with a toast, no modal — same low-ceremony shape as "Cancel my signup." The signed-in user's own row uses "Cancel my signup," not "Remove." **The removed person is now notified (session 143, was backlog `2026-06-08-002`):** the DELETE handler fires `sendHostAssignmentRemovedEmail` when `removedUserId !== session.user.id` — exactly what separates a coordinator-remove (notify) from a self-cancel (silent), since both callers share this one DELETE route. Pre-threshold-gated, so staged accounts get nothing.

CSS lives in `public/css/custom.css` under `.hs-row__multi*` (incl. `.hs-row__multi-remove`). The card itself is the standard `.hs-row` chrome; only the right-hand block (status + action) differs.

---

## Sub-requests

A host who can't make a session they're committed to posts a sub-request:

1. They open the session in `/tools/schedule?hub=<their-hub>`, click **"Ask the team to cover"** on their assignment.
2. The POST to `/api/host/sub-requests` creates the `SubRequest` row, then notifies other active members of the program's hub via `sendSubRequestEmail`.
3. The email contains:
   - Context: who's requesting, what program, what date, the requester's optional note
   - `{{coverUrl}}` — a deep link that opens `/tools/schedule?action=cover&id=<id>&hub=<slug>` with the cover modal pre-opened
   - `{{coverButton}}` — the canonical CTA button (since Slice 2.5)
4. Another member clicks "Fill in" / the button → lands at `/tools/schedule?action=cover&id=<id>&hub=<slug>` → cover modal → POST to `/api/host/sub-requests/[id]/claim`.
5. The claim writes the new userId to the HostAssignment + closes the SubRequest. Two emails go out: a `sub-request-claimed` to the original host ("your session is covered"), and a `host-assignment-confirmation` to the new host.

All three emails carry `hubSlug` derived from `program.hostingHubSlug` so every link lands the recipient in the correct hub view. Slice 2.5 fix.

### Sub-request discoverability — `?month=YYYY-MM` deep-link

Affordance gates: `kind === "mine"` AND `!isPast`. `kind === "mine"` requires `hostUserId === currentUserId`. The Schedule page defaults to the current month; the apply path (`applyStandingAssignments.ts`) skips past dates when creating HostAssignments — so a host whose rotation starts in a future month has no "mine" rows in the current-month default view, and the "Ask the team to cover" button never appears.

Session 130 closed this with a month-specific email deep link:

- **`sendStandingAssignmentScheduledEmail`** now takes `firstSessionMonth?: string` (the YYYY-MM of the earliest scheduled session) and deep-links the CTA URL to `/tools/schedule?month=<that>&hub=<slug>`. Computed at the apply / standing-assignments POST / cron call sites from the apply result's `sessions[].dateStr`. The schedule page reads `?month=` permissively (bad input falls back to current month).

The former "Your Rotations" summary above the Schedule was removed in session 168 because it duplicated the actual dated assignments and added visual clutter. Rotation rules remain fully available to coordinators in the Rotations tab; members see the resulting sessions in the Schedule. Keep the `?month=YYYY-MM` email deep link as the direct path to a future assigned session.

When adding any feature that points a user at a specific session by URL, prefer `?month=YYYY-MM` (deep-link the month) over relying on the current-month default. The URL is the contract.

---

## Standing rotations

Standing rotations are recurring patterns: "Maria hosts every 2nd and 4th Thursday." They're stored as `StandingAssignment` rows keyed `(programSlug, dayOfWeek, occurrence, hubSlug)` as of session 129 — the unique was widened to allow a program to have parallel rotations in different hubs (a host-team rotation + an AV rotation on the same first-Saturday is two records). A cron job (`/api/cron/apply-standing-assignments`) walks forward, creating `HostAssignment` rows from each rotation.

**Hub-scoped per record (session 129).** Every standing-rotation route accepts a `hubSlug` body field. When omitted, falls back to the program's primary hub for backward compat. Slice 2.6 routed by program's primary hub; session 129 lets the caller scope to the rotation's own hub, which matters when the same program has rotations in multiple hubs.

**Auth model per route:**

| Route | Hub source | Gate |
|---|---|---|
| `POST /api/host/standing-assignments` | `body.hubSlug` (else program's primary) | manager OR `isHubCoordinator` for that hub |
| `GET /api/host/standing-assignments?hub=&programSlug=` | `?hub=` (or `programSlug`'s hub if given) | hosting capability in that hub |
| `POST .../apply` (per-program) | `body.hubSlug` (else program's primary) | manager OR `isHubCoordinator` |
| `POST .../apply` (apply-all) | none | HOST_MANAGER or ADMIN only |
| `POST .../preview` | `body.hubSlug` (else program's primary) | manager OR `isHubCoordinator` |
| `POST .../release-host` | `body.hubSlug` (else program's primary) | manager OR `isHubCoordinator` |
| `POST .../end-bundle` | `body.hubSlug` (else program's primary) | manager OR `isHubCoordinator` |
| `DELETE /api/host/standing-assignments/[id]` | `rotation.hubSlug` | manager OR `isHubCoordinator` |

**`lib/applyStandingAssignments.ts`** — `Candidate` carries `hubSlug` so applied HostAssignments inherit the source rotation's hub. Conflict detection scoped per `(programSlug, dateStr, hubSlug)` — an AV rotation candidate doesn't conflict with a host-team HostAssignment on the same date. Apply takes an optional `hubSlugFilter` so per-hub callers can narrow the apply to one team's rotations.

**Emails carry hubSlug.** `sendStandingAssignmentScheduledEmail`, `sendStandingAssignmentReplacedEmail`, `sendStandingAssignmentReleasedEmail`, and `sendStandingAssignmentEndedEmail` all accept an optional `hubSlug` and build the "view schedule" link via `hubScopedUrl`. The apply route groups byUser sessions by `hubSlug` so a user with rotations in two hubs gets one email per hub, each linking to the right Scheduler view. `sendStandingAssignmentScheduledEmail` (session 130) also accepts `firstSessionMonth?: string` and deep-links the CTA URL to that month. **Their look (2026-10-14):** all four render through `renderEmailHtml` in `lib/email.ts` (the shared frame and text style); before that they went out as bare HTML with no logo or panel. Their bodies carry no inline sizes or colors (see `RIM_Email_Engineering.md`, "The look").

**`RotationsClient.tsx`** receives `hubSlug` as a prop and passes `?hub=<active>` to its rotation-list fetch. Each hub's Rotations tab loads only that hub's rotations.

### Released vs Ended — two distinct semantics (session 130)

Two distinct exits, two distinct email builders, two distinct UI actions. Don't conflate them.

| Action | Route | Behavior | Email |
|---|---|---|---|
| Remove one person from a still-active rotation | `POST /standing-assignments/release-host` | Deletes the user's `StandingAssignment` rules in the bundle + their future `HostAssignment` rows. Other people in the bundle keep their rules. The rotation continues. | `sendStandingAssignmentReleasedEmail` — subject "You've been removed from the {programName} rotation." Renders a no-list body variant when no future HostAssignments existed yet (rule just created, cron hadn't applied) so the user still hears about the removal. |
| End an entire rotation rule | `POST /standing-assignments/end-bundle` (with `releaseFuture=true`) or `DELETE /standing-assignments/[id]` | Sets `endsOn` (or deletes the rule entirely on the [id] DELETE path). Future HostAssignments tied to that rule are deleted. Cron honors `endsOn` and won't re-apply. | `sendStandingAssignmentEndedEmail` — subject "Your hosting rotation has ended." |

**Pre-session-130 history (don't reintroduce):** `release-host` used to delete only the HostAssignments and leave the `StandingAssignment` row active. The daily cron at 8am UTC would re-apply the released user the next morning — the "release" silently undid itself. Maria's beta test surfaced this. The fix is the now-canonical "release means actually remove this person."

**Where each is wired:**

- `RotationsClient`'s "Manage rotation" panel → "Remove from rotation" (per-host) → `release-host` → Released email.
- `RotationsClient`'s "Manage rotation" panel → "End this rotation" (whole bundle) → `end-bundle` with `releaseFuture: true` → Ended email.
- `RotationsClient`'s "End on a specific date" → `end-bundle` with `endsOn` (no `releaseFuture`) → no email (set-end-date is non-disruptive).
- The `[id]` DELETE route (legacy) — same Ended email.

**Per-date "I can't make this one" is a separate exit.** Hosts who can't make a single specific date should use the per-session "Ask the team to cover" affordance on the Schedule tab, not the rotation-management Remove. The Manage panel's copy spells this out. Keep them visually distinct in any future UI work.

### Sub-claim rows on rotation removal — intentional behavior (session 130)

`release-host` queries the user's `StandingAssignment` rules in the bundle (`where: { programSlug, dayOfWeek, hubSlug, userId }`) and then deletes future `HostAssignment` rows tied to *those specific rules* AND held by the user. A future row where the user took over via sub-claim (HostAssignment's `userId = X` but `standingAssignmentId` points at someone else's rule) is **not** freed.

This is intentional: sub-claims are deliberate single-date opt-ins, not rotation membership. Removing X from "the rotation" shouldn't auto-release a session X voluntarily took. The pre-session-130 code did free those rows, but the new behavior is more semantically correct. If the held sub-claim is also a problem, X can post their own sub-request for it.

---

## Member picker (situational-awareness affordance)

The Schedule page includes a member picker that shows hosting capability and pause state for everyone in the active hub. It's a coordinator-facing tool for understanding "who's available right now."

Hub-scoped:
- `activeHubSlug` drives which hub's members appear
- `HubMember.status` + `hostingCapability` + `pausedAt` are read for each member
- Pause states (PAUSED, INACTIVE) render dimmed; assigned hosts with pause state show a small "paused" badge

The picker is scoped to one hub at a time — multi-hub members appear in whichever hub view the coordinator is currently in. That's intentional: the picker is *about* hub-specific situational awareness, not cross-hub identity lookup.

---

## PDF export — removed (session 139)

The per-user schedule PDF export (`/api/host/schedule/pdf` + `ScheduleDocument` + the `@react-pdf/renderer` dep) was removed in session 139 as unused. If a PDF export is wanted again, rebuild on a serverless-safe renderer (the old one needed no headless Chromium).

---

## Rotation-edit safety + the coordinator view (session 140)

From host-coordinator feedback. Two durable rule-changes to the edit/apply path, plus the start of a coordinator-facing view.

### "Replace all" never overrides a manual self-claim
`applyStandingAssignments` treats `source: "manual"` conflicts as **protected** under `replace-all`, exactly like sub-cover — a blanket "Replace all" must not silently stomp a date someone deliberately picked for themselves (the likely cause of the "Maria removed unexpectedly" report). To override a manual claim the coordinator switches to **Decide one by one** (`perDate`) and toggles it. Server (`applyStandingAssignments`) and client (`RotationConflictModal`) share one predicate — `isShieldedFromReplaceAll(c) = c.protected || c.source === "manual"` — so the modal's summary count and its per-row decision can't drift apart.

### Pattern-editor removal cleans up orphans
The bundle-save `POST /api/host/standing-assignments` deletes `StandingAssignment` rules dropped from the new pattern. It now **also deletes those rules' future `HostAssignment` rows** (FK-safe SubClaim→SubRequest→HostAssignment→StandingAssignment order, future-only) and emails each displaced host via `sendStandingAssignmentReplacedEmail`. Before this, `standingAssignmentId`'s SetNull-on-delete left the removed host orphaned on the calendar — so "remove Nancy" silently didn't take (bug #4). The response carries a `removed` count (surfaced in the save confirmation), and the post-save re-preview conflict count is now hub-scoped.

### The conflict modal is hub-scoped
`RotationConflictModal` previously had **no `hubSlug`** and applied un-hub-scoped. It now threads `hubSlug` into the preview + apply request bodies (both routes already accepted it), and `applyStandingAssignments` keys `candidatesByKey` by `programSlug::dateStr::hubSlug` with `hubSlug` carried on the `Conflict` type. This is what keeps a replace on a multi-hub program from crossing host-team / AV / greeter / peer-led. (Qigong is single-hub, so this wasn't *its* bug — but it's a real latent one on hybrid programs.)

### Diagnostic logging
`applyStandingAssignments` logs `[rotation-apply]` with the exact per-date `from→to` deltas **only when a replace happens** (never in the cron's "leave" mode, so no daily-run spam). Removable once rotation-edit reports settle; it's the reconstruction trail for unclear "my edit changed the wrong thing" reports.

### Coordinator view — Phase 2 (mobile-first, gap-first)
The coordinator's headline complaint was page-hopping + "disjointed pages you connect in your own head." The answer is **one surface that's both the picture and the editing desk, organized by time** — programs × dates, gaps the most visible thing, edit in place. Build order is **mobile-first** (a wide grid can't fold to 390px) and **gap-first**.

- **Slice 1 (shipped, session 140):** on the existing Schedule tab — a coordinator status banner ("N sessions still need coverage · Show them") and **assign-in-place** on needs-coverage rows via `AssignControl` (a native `<select>`, the mobile-right control). `assignMember` POSTs the chosen `userId` to `/api/host/assignments` and optimistically updates the row (swapping the synthetic `unassigned::` id for the real one).
  - **`POST /api/host/assignments` gate widened:** assigning *others* now allows a **hub coordinator** of the target hub, not just HOST_MANAGER/ADMIN — same trust model as the rotation routes; it had been locking out the coordinators who staff the team. The target hosting-capability check was hoisted above the row lookup (guards every assign path), and a new branch assigns a chosen person to an existing **unclaimed seed** row instead of returning a confusing "a session already exists" 409.
- **Slice 2 (next):** the desktop 2-D grid (programs × dates) — the "more room" rendering of the same model.
- **Slice 3:** the by-program lens with inline rotation editing + live conflict preview.
- **Later:** AV/greeter coverage as sub-lanes; a teacher-vs-host distinction shown on the surface.

---

## Coordinator view + trust/clarity finish (session 141)

Session 140's plan was "build the coordinator's synoptic view, slices 2–3." **Slice 2 was built and reverted**; the direction changed to *make the surfaces that already exist trustworthy* rather than add new ones. What shipped and stuck:

### Enter-room link is gated to "live now"
The Schedule tab's "Enter room →" rendered on every upcoming virtual/hybrid row, but it carries **no date** and the token route only opens *today's* session — so clicking it on a non-live row dead-ended ("the room isn't on this date"). It now renders only when the occurrence is inside its entry window, computed client-side from a new `sessionEnd` field threaded through both `app/tools/schedule/page.tsx` and the `/api/host/assignments` GET (so it survives a month-nav re-fetch). The recurring-session join refusal underneath was already fixed s137; this closed the residual UX dead-end (Maria's #2). Teacher does **not** bypass the gate (only ADMIN/GT) — which is why it was invisible to Jesse.

### Entry-window timing lives in one shared constant
`lib/sessionWindowConstants.ts` (dependency-free → client-safe) is the single source for `EARLY_OPEN_MIN` (30), `MEMBER_JOIN_MIN` (10), `LATE_GRACE_MIN` (30), `FALLBACK_DURATION_MIN` (90). The gate (`lib/sessionWindow.ts`), the dashboard tiers, and the "Enter room" link all import it, so the numbers can't drift. Host/teacher early-entry moved 22→**30**; member "Join now" 12→**10**. Host-vs-member is a dashboard-UI distinction; the gate is the permissive outer boundary (any host can enter early in an emergency via the Scheduler link).

### Gap signal folded into the pill; staffing edit-link is direct
The "N sessions still need coverage" banner duplicated the "Needs help N" pill — removed; the pill goes **amber** (`.hs-filter--alert`, `--color-warning`) when a manager has uncovered single-slot sessions. The cross-hub staffing page's "Edit in [hub] →" deep-links single-slot hubs straight to the Rotations editor (`?view=rotations`, honored via a guarded `view` initializer in `HubScheduleClient`); multi-claim hubs go to the schedule.

### The Coverage grid was built and reverted — the agenda is the coordinator home
Slice 2 (programs × weeks grid on desktop + gap-first list on mobile, manager default landing, fill-in-place) was built (`4732fd4`) and **reverted** (`2d7a763`). Two structural strikes: the mobile list degraded to a flat one-row-per-gap dump (worse than the agenda), and the grid assumes **one weekday, repeating weekly** — so multi-day programs break it (a weekly multi-day program fragments into N repeated rows; a consecutive retreat shatters into N single-cell weekday rows). The time-ordered **agenda** handles every program shape uniformly and is already gap-aware (the amber pill + slice-1 assign-in-place), so it remains the coordinator's home. **If the grid ever returns**, scope it to weekly-rhythm programs, handle events/retreats separately, and give it a real mobile layout — backlog `2026-06-07-001`. Lesson: don't answer a list of feedback pains with a new surface per pain (restraint; "pivot when fragile").

### The rotation editor confirms the result in place (Maria's #5)
After **Save & apply**, `RotationsClient` shows an inline **"✓ [Day]'s rotation saved"** panel on that bundle's row, with the change summary + projected next sessions (date → host) — so a coordinator sees the change landed without navigating + scrolling to verify. Reuses the live-preview projection, extracted into a shared `projectUpcoming(form, teamMembers)` so preview and confirmation can't drift. The save/apply logic is unchanged; the confirmation is a read-only capture taken from the form before `cancelForm()` clears it, set on the two no-conflict success paths (the conflict modal already shows its own resolution). Cleared on re-edit or dismiss. CSS `.hs-rot__saved*` (success tint).

---

## Recurrence — monthly is weekday-of-month (session 153)

A program with `recurrenceFreq = "MONTHLY"` repeats on the **same weekday-and-position-in-month as its start date** — "the last Sunday", "the 2nd Wednesday" — derived from `startDatetime` (no day-of-month field, no extra editor input; the weekday picker stays weekly-only). `lib/scheduleUtils.ts::isOccurrenceOnDate` matches the anchor's weekday + ordinal, where **"last" stays last** even in 5-occurrence months (anchorIsLast ⇒ match the last occurrence; else match the Nth). Interval = "every N months"; `recurrenceCount` bounds the series. Every occurrence-driven surface (This Week, dashboard, the Scheduler, host assignments, standing rotations, the session-room join gate) inherits this through `isOccurrenceOnDate` — there is exactly one place to change. Previously there was no MONTHLY branch, so monthly programs silently occurred only on their anchor date (and the session-room room never opened on later months — fixed here too).

**Pitfall — keep the four schedule-label copies in lockstep.** The monthly label ("Last Sunday of the month") comes from `monthlyPatternPhrase()` in `lib/scheduleUtils.ts`, consumed by `lib/programUtils.ts::computeDateText`, `lib/dateLabel.ts::buildDateLabel`, the **ProgramEditor inline preview**, and an **inline copy in `prisma/migrate.mjs`** (the `recache_program_date_time_text` block, which recomputes every program's `dateText` on every deploy). Change the wording in one → change all four, or the recache silently overwrites the API-saved label on the next deploy. `recurrenceFreq` is stored UPPERCASE — compare uppercase (`buildDateLabel` once compared lowercase and its recurrence branches were dead).

**`.ics` export** still recurs monthly by date-of-month, not weekday-of-month — backlog `2026-06-17-004` (needs a CT `TZID`/`VTIMEZONE` treatment because the export emits UTC start times).

## Common pitfalls

**The schedule URL without `?hub=` defaults to host-team.** Always include the hub when generating links — internally (sidebar app-link auto-append), externally (email URLs via `hubScopedUrl`).

**The cover URL deep link.** The full URL pattern is `/tools/schedule?action=cover&id=<id>&hub=<slug>` (Slice 2.5 added the hub param). The schedule page reads `action` and `id` from the query string and opens the cover modal. Don't break that handshake — if you change the URL shape, update both the email and the page.

**Pause-state and hosting-capability are coordinator-owned.** Don't write to `HubMember.status`, `hostingCapability`, `communicationsEnabled`, `pausedAt`, `pausedById`, `pauseNote` from any route other than `/api/hub/[slug]/members/[userId]` PATCH. These fields are gated to coordinators-of-this-hub specifically.

**`Program.endDatetime` is NOT a series-end date for recurring programs — never treat it as a forward cutoff.** For a recurring program, `endDatetime` is the end *time* of a single occurrence (same calendar day as `startDatetime`); the series bound is `recurrenceCount`. `lib/scheduleUtils.ts::isOccurrenceOnDate` applies the `dateStr > endDatetime` cutoff **only inside the `!p.recurrenceFreq` (non-recurring) branch**. A guard added in session 131 placed that cutoff *before* the recurrence handling, so it fired for recurring programs too — and because every recurring program carries a same-day `endDatetime`, the helper reported zero future occurrences for **all** of them. That silently erased recurring offerings from the dashboard "Coming up for you", `/this-week`, the Scheduler grid, `applyStandingAssignments` (so the daily 08:00 UTC cron created no future host rotations), and `lib/sessionWindow.ts` (so non-ADMIN/GT members were refused a token to join recurring sessions — ADMIN/GT bypassed, masking it). Found via LoriLee's registrar testing, session 137. **If you ever need a date-based "this recurring series ends on X," add a dedicated field (e.g. `recurrenceUntil`) — do not overload `endDatetime`, which is wired everywhere else as the per-occurrence end time** (time-range labels, ICS calendar links, `sessionWindow.closesAt`).

---

## Destructive-route deletion pattern (session 130 follow-up)

Every destructive route in the Scheduler API touches three tables in a fixed order. **Don't deviate from this pattern.** Skipping a step or reordering it produces FK-Restrict violations (HTTP 500) the moment a historic non-OPEN SubRequest exists on a target HostAssignment.

```ts
await db.$transaction(async (tx) => {
  // 1. Collect target HostAssignment ids first.
  const targetIds = (await tx.hostAssignment.findMany({
    where: { /* hub-scoped + program-scoped + future-scoped */ },
    select: { id: true },
  })).map((a) => a.id);

  if (targetIds.length > 0) {
    // 2. SubClaim cascades on SubRequest delete, but delete explicitly for
    //    consistency with /api/host/assignments/clear and to make the
    //    intent obvious to future maintainers.
    await tx.subClaim.deleteMany({
      where: { request: { assignmentId: { in: targetIds } } },
    });
    // 3. SubRequest.assignmentId FK is Restrict — MUST delete (not cancel)
    //    before the parent. Pre-session-130 routes that used updateMany
    //    cancel-OPEN-then-delete worked only when no non-OPEN SubRequests
    //    existed; the moment a CLAIMED or CANCELLED row appeared on a
    //    target HostAssignment, the next destructive call returned 500.
    await tx.subRequest.deleteMany({
      where: { assignmentId: { in: targetIds } },
    });
    // 4. Now the parent can be deleted.
    await tx.hostAssignment.deleteMany({
      where: { id: { in: targetIds } },
    });
  }

  // 5. (Optional) Then any related StandingAssignment rules.
});
```

**Why `updateMany`-cancel was wrong.** `cancel-OPEN-then-delete` was the historical pattern. It assumed every SubRequest pointing at a doomed HostAssignment was OPEN (and that cancelling closed-state rows was wrong because of audit-trail concerns). Both assumptions broke down: CLAIMED rows are real sub-cover arrangements that survived their session, and CANCELLED rows are routine history. Either status will FK-Restrict-block the parent delete.

**Why delete (not nullify) SubRequest.** `SubRequest.assignmentId` is non-nullable (`String`, not `String?`). The row can't be orphaned from its assignment; it has to die with it. The audit-trail concern that motivated `updateMany`-cancel is moot — the parent assignment is being deleted, so the SubRequest is referencing a row that won't exist anymore. Better to delete cleanly than to leave dangling pointers.

**Where this pattern is now applied:**
- `/api/host/assignments/clear` (canonical — was already correct)
- `/api/host/programs/[slug]/clear-rotations` (session 130 follow-up)
- `/api/host/standing-assignments/release-host` (session 130 follow-up)
- `/api/host/standing-assignments/end-bundle` — both branches: set-end-date and release-future (session 130 follow-up)
- `/api/host/standing-assignments/[id]` DELETE (session 130 follow-up)
- `/api/host/assignments/[id]` DELETE (session 130 follow-up)
- `/api/host/assignments/reassign` (session 130 follow-up — the `previousUserId` cleanup path)
- `/api/programs-pg/[slug]` PUT, hub-change branch (session 130 follow-up — atomic with the program.update)
- `heal_orphan_standing_assignments_v1` migration (session 130 — same pattern at data-heal layer)

**PATCH unclaim on `/api/host/assignments/[id]` keeps the cancel-OPEN behavior** because it only sets `userId = null` (no parent delete). No FK violation possible. Other routes that update HostAssignment but don't delete it can also keep the cancel pattern.

## Per-day Reset is a first-class affordance (session 130 follow-up)

For multi-day programs (Good Morning / Good Evening Silent Meditation, etc.), a coordinator usually wants to reset *one day's* rotation while leaving the other days intact. The row-level destructive button is named for the day: **"Reset Monday"**, **"Reset Tuesday"**, etc. (programmatically derived from `DAY_LABEL[d]` in `RotationsClient.tsx`). Clicking it opens the manage panel whose copy is also day-named ("Manage Tuesday's rotation for [Program]"). The destructive option inside the panel reads "Reset Tuesday's rotation. Deletes the Tuesday rotation rule and clears upcoming Tuesdays from hosts' schedules. Other days for [Program] are untouched. Past sessions stay on the record. Each affected host is emailed."

The success toast also carries the day: "Reset Tuesday's rotation · 4 upcoming Tuesdays released. Other days untouched."

The per-program "Reset rotations" button at the bottom of each program card is still the nuke-all-days option (deletes every rotation rule + future HostAssignment for this program in this hub). Its confirmation copy spells out the scope: "Deletes *every* rotation rule for this program in [hubSlug], and removes every upcoming session this program has in this team. Other teams scheduling this program are unaffected. Past sessions stay in the historical record."

## Cross-hub program-staffing view (session 130 follow-up)

A program is staffed by multiple hubs in parallel: the primary hub holds the live session (Host role), and any `ProgramCoverageHub` row adds an auxiliary role (Audio Visual, Greeter, etc). Coordinators planning a week want to see all of those roles for one program in one place — not switch hub tabs to assemble the picture.

The view: **`/tools/schedule/program/[slug]`**. Read-only. One section per hub covering the program:

- **Single-slot hubs** (host-team, peer-led, audio-visual): a per-day table with columns *Day · Host(s) · Pattern*. Each host's pattern is summarized via `formatPattern`: "1st & 3rd," "2nd & 4th," "every," "last," etc.
- **Multi-claim hubs** (greeter): the next four upcoming sessions with signup counts. No rotation pattern semantic — these are open sign-up.

Each section's header shows the hub role badge (`Primary host` for the primary hub, `Auxiliary coverage` for others), a `Open sign-up` italicized hint for multi-claim hubs, and an "Edit in [hub] →" link that deep-links to `/tools/schedule?hub=<slug>` for actual editing. The page itself does not allow inline editing.

Access gating: inherited from the parent layout (`/tools/schedule`) — HOST / HOST_MANAGER / ADMIN / individual `UserToolAccess` grant. The view is read-only so broad access is appropriate; a coordinator on host-team can see how Saturday Sit is staffed across host-team + AV + greeter even if they're not a member of every hub.

Discoverability: each program card in the Rotations grid carries a `View all roles →` link in its header that opens the staffing view.

**Edge case (resolved):** `findUpcomingDates` walks forward collecting a program's next occurrences. Originally `isOccurrenceOnDate` didn't honor `Program.endDatetime`, so ended programs surfaced phantom "upcoming" sessions in the multi-claim block — the staffing view clipped its walk at `endDatetime` locally to compensate. Session 137 pushed that cutoff into the shared helper: `isOccurrenceOnDate` now applies the `endDatetime` forward-cutoff inside its **non-recurring branch only** (recurring series stay bound by `recurrenceCount` — see the pitfall below). The local clip is gone; `findUpcomingDates` relies on the shared helper natively. The two remaining private copies that shared the same blind spot — the one in `app/api/host/assignments/route.ts` and the dashboard's `isOccurrenceToday` — were later folded onto `lib/scheduleUtils.ts` as well, so there is now a **single definition site** for occurrence logic, mechanically guarded by a `no-restricted-syntax` rule in `eslint.config.mjs` that forbids redefining an `isOccurrence*` helper anywhere but `lib/scheduleUtils.ts`.

## Role-aware copy (session 130 final follow-up)

Each hub represents a functional role per the programs it covers — host, AV, greeter, facilitator — and the user-facing copy in the Schedule tab, the Rotations grid, and outbound emails reads from the hub's configured language rather than the host-team default.

Three fields on `Hub` carry this:

| Field | Form | Examples |
|---|---|---|
| `coverageNoun` | Capitalized noun | "Host" / "AV" / "Greeter" / "Facilitator" |
| `coverageVerb` | Present-continuous verb phrase | "hosting" / "covering AV" / "greeting" / "facilitating" |
| `coverageAction` | Base-form action phrase | "host this" / "cover AV" / "greet" / "facilitate" |

All three default to host-team values, so existing behavior is preserved when a hub is missing values. Configured per-hub at `/admin/hubs` (form fields are an open follow-on; for now configured via migration).

Helper: `lib/programHub.ts::getHubCoverageCopy(hubSlug)` returns `{ noun, verb, action }` or `DEFAULT_COVERAGE_COPY` for unknown slugs.

### Where the copy is used

**UI (HubScheduleClient.tsx):**
- "{Noun} needed" — empty session card
- "Yes, I can {action}" — claim button
- "You're {verb}" — own assignment status
- "{Noun}: [Name]" — covered session
- Toast: "You're {verb}. The team has been notified."

**Emails (lib/email.ts):**
- `sendStandingAssignmentScheduledEmail` body — "scheduled to be {verb} the following sessions"
- `sendStandingAssignmentReplacedEmail` subject — "You're no longer {verb} {program}"
- `sendStandingAssignmentEndedEmail` subject — "Your {verb} rotation has ended"
- `sendStandingAssignmentReleasedEmail` body — "removed from the standing rotation as {Noun}"

### When adding new user-facing copy to the Scheduler

Default to using `coverageCopy` if the copy is about the user's role on a session. If the copy is hub-agnostic (filter labels, modal titles, calendar nav), use generic language.

A rule of thumb: if the same string would read awkwardly on the AV hub or the greeter hub, it probably needs `coverageCopy`.

## Occurrence-first agenda grammar

Every dated Scheduler occurrence uses the same visual order: **calendar date and time → program → coverage state → next action**. Date and time share one quiet calendar block (weekday, month, day, time) rather than splitting the time into a second strip below the date, so a volunteer can orient themselves before parsing the row. This is shared by all Scheduler hubs: host-team, peer-led, audio-visual, and greeter.

- **Single-slot hubs:** the coverage state remains plain-language and role-aware; the volunteer's relevant action stays visible. Coordinator-only choices are grouped under the visible native disclosure **“Manage coverage”** (ask team to cover → remove role → reassign to me), rather than competing with the normal action on every card.
- **Multi-claim hubs:** the date block is shared, but the people-and-signup area stays the dedicated greeter community rendering described above. Do not fold it into the single-slot assignment interface.
- **Rotations:** a rotation is a recurring rule, not an occurrence, so its editor continues to lead with weekday/pattern. Only its *projected next sessions* and saved confirmation use compact calendar blocks.
- **Other surfaces:** `/this-week` uses one calendar block per day heading; the cross-hub program staffing page uses it for Greeter's next dated signups. Registration timestamps, activity timestamps, monthly hub summaries, and recurring date labels are metadata/rules — do not apply the calendar block to them.
- **Section rhythm:** “This week” / “Next week” and similar group headings rely on spacing and type hierarchy. Do not add a divider line beneath them when the following card already establishes the boundary.

This is presentation-only. It must not alter assignment data, filters, hub scoping, deep links, rotation application, permissions, or emails.

## Orphan-hub rotations + atomic program transfer (session 130 follow-up)

A program's `hostingHubSlug` is the primary hub. Its `ProgramCoverageHub` rows list auxiliary hubs (session 129 — AV team, greeter team). A `StandingAssignment` or `HostAssignment` is **valid** on the program if its `hubSlug` is the primary OR is in the auxiliary set.

Pre-session-130, transferring a program from hub A to hub B left every rule and future assignment on hub A intact. They became invisible in every UI (hub A's grid filters its program list by `hostingHubSlug = A`, but the program is no longer there; hub B's grid filters by `hubSlug = B`, but the orphans are still on A). The apply cron walks every rule regardless of hub, so the orphans kept producing new HostAssignments under the old `hubSlug` daily. Coordinator-visible symptom: "the Reset rotations button doesn't work — it cleans up, but the rotation comes back."

**The one-shot heal:** migration `heal_orphan_standing_assignments_v1` in `prisma/migrate.mjs` deletes orphan rules + their future HostAssignments site-wide. Past HostAssignments stay as historical record. The valid-hubs set per program includes BOTH primary and every auxiliary coverage row (reviewer caught the initial implementation that only checked primary — it would have wiped every legitimate AV/greeter rotation).

**The recurrence-prevention:** the PUT handler at `/api/programs-pg/[slug]` now detects a hub change and runs the cleanup + the `program.update` in a single `$transaction`. Atomic — if cleanup throws, the transfer doesn't commit. **Don't add new mid-flight hub-change side effects outside this transaction.** They'd open the door to the same orphan state the migration just healed.

**Why we don't auto-migrate the rotation users.** A rotation rule for user X on hub A says "X hosts this program from hub A's pool." When the program transfers to hub B, X may not be a member of hub B at all. Silently moving X's rule to hub B would mean X starts getting emails for a hub they can't see, can't claim sessions in, and can't manage. Cleaner: delete the rule, let the new-hub coordinator set up fresh rotations with hosts from their hub.

## Destructive-route hub-scoping (session 129 audit)

Both destructive routes the Scheduler exposes are now hub-aware. Pattern matches the rest of the standing-assignment routes:

**Per-program reset** (`POST /api/host/programs/[slug]/clear-rotations`):
- Body: `{ mode: "clear" | "reset", hubSlug?: string }`. `hubSlug` defaults to the program's primary hosting hub if omitted.
- Gate: `isHubCoordinator(userId, targetHubSlug) || ADMIN`.
- `mode: "clear"` deletes upcoming HostAssignment rows for this `(programSlug, hubSlug)`. `mode: "reset"` also deletes StandingAssignment rows for this `(programSlug, hubSlug)`. Other hubs covering the same program are untouched.

**Whole-hub reset** (`POST /api/host/assignments/clear`):
- Body: `{ hubSlug: string (required), scope: "future" | "all", endRotations?: boolean }`.
- Gate: `isHubCoordinator(userId, hubSlug) || ADMIN`.
- `scope: "future"` deletes upcoming HostAssignment in this hub. `scope: "all"` adds past assignments. `endRotations: true` also wipes StandingAssignment in this hub.
- RotationsClient calls this with the active hub. UI copy reads "Reset this team" with explanatory text that other teams' data stays intact.

The pre-audit versions of both routes were either hardcoded to `host-team` or globally unscoped — clicking from greeter's UI would have wiped host-team's data. After the audit, the blast radius is contained per hub.

---

## Every action answered (2026-10-13)

The Scheduler's 3-second toast is `ActionNotice` (`components/FormDone.tsx`): fixed to the bottom of the screen, kept until closed or the next action, announced (status, or alert for a problem), wrapping on phones, with a 44px Close. A failed confirm in the take/cover/ask/cancel/reassign/remove modal is said inside the modal beside its button (`HsModal` `error`), and a month that fails to load says so. Same for every hub mode (single-slot and multi-claim); only the messages changed. Rule: `RIM_Web_Design_Philosophy.md`, "Every submit is answered where the person is looking".

## Coverage notices: every role accounted for (2026-10-16)

Jesse signed up as the first greeter, cancelled, and nothing happened: *"Shouldn't it send a notification … that it needs a greeter? … this is one of the main features to support teams and to make sure roles are all accounted for, and that they can do this all through the app in a convenient, well-informed way."* An inventory found the one pattern behind it: **a team heard only when someone asked for cover.** A session emptied any other way (a greeter cancelling, a coordinator taking someone off, a pause, leaving a team, archive, a rotation ended) went quiet, and a session no one ever took was never mentioned. Team Home counted only cover requests, and volunteers got no reminder.

**Jesse's rulings (2026-10-16, all four as recommended):**
- **A session within two weeks that loses its last person on a team:** that team's members who can take sessions are emailed at once (`coverage-gap-opened`), never the person who made the change or the person taken off. Further out, the look-ahead says it.
- **Every Monday** each team gets the next two weeks' sessions that still need someone (`coverage-lookahead`); **two days before**, the team's coordinators hear about anything still open, open cover requests included (`coverage-still-needed`).
- **Two days before**, each person serving gets a reminder (`coverage-session-reminder`) with the time, their role, and everyone serving the session ("Host: …", "AV: none yet", "Greeters: …").
- **A host is not emailed about a supporting team's gap;** their reminder and the Scheduler show it.

**And Jesse on the confirmation** (*"You're confirmed for Dummy Test Program on Fri, Oct 16"*): *"Confirmed to greet, because what if they're part of different teams?"* Every per-session coverage email now names the role, the team and the time: "You're greeting: … · Fri, Oct 16 at 9:30 AM" / "You're confirmed as greeter for … with the Greeter team." (`coverageWords()` in `lib/email.ts`, `fmtSessionWhen` in `lib/timezone.ts`; template swap `coverage_emails_name_the_role_2026_10_16_v1`, only where unedited). The "Take this session?" dialog said "The team will be notified"; nothing goes to the team on a take, so it now says a confirmation is emailed.

**How it works** (`lib/coverageNotices.ts`):
- **"Needs someone" is what the Scheduler shows:** a row from `buildHubMonthSessions` that is `unclaimed` or `sub_needed`. Never count rows another way.
- **A gap is checked after the write commits, and never fails the write:** `prepareGapNotices(rows, excludeUserIds)` (logs and returns nothing on an error) keeps sessions that had someone on them, ahead, within 14 days (`COVERAGE_LOOKAHEAD_DAYS` in `lib/sessionWindowConstants.ts`), that the team still staffs (`teamCannotStaff`), with nobody left on that team for that Central day, and not announced in the last day. Then `deliverGapNotices` in `after()`. The route answers `teamTold`, so the toast says whether the team heard.
- **Wired into:** `DELETE` and `PATCH unclaim` on `/api/host/assignments/[id]`, a coordinator's pause or removal (`/api/hub/[slug]/members/[userId]`), the registry's team removal, archive, Inactive and deletion (`/api/admin/members/[id]*`), and the rotation's release-one-person route. **Not** wired into structural changes (ending or resetting a rotation, the rotation Save and its pattern edits, a team Reset, "Clear upcoming schedule", a program moving team, format or days): the coordinator is reshaping the schedule and usually saves a new rotation next, which would refill what the team had just been told was open (reviewer, 2026-10-16). The Monday look-ahead and the two-days-before coordinator note cover them.
- **The daily pass** (`/api/cron/coverage-notices`, 13:00 UTC, after the 08:00 rotation run): reminders, the coordinator note, and on Mondays (Central) the look-ahead, for every ACTIVE team with the Scheduler installed. A team that fails is logged and the others continue.
- **`coverage_notices`** (`CoverageNotice`) records each notice: nothing goes out twice, and Updates shows "**Program · Oct 18** needs a greeter" from `gap-opened` rows (it names no one; who left, or why, isn't the team's news). A reminder points at its assignment, not a person, so the merge needs nothing.
- **Team Home's line** is the true count: "3 sessions in the next two weeks need a greeter", "Every session in the next two weeks has a greeter.", or with nothing scheduled "No sessions on the schedule in the next two weeks." (closes backlog `2026-10-13-005`). **Updates' For me** shows a gap only while its session still has no one; All and Recent keep it as history.
- **The Scheduler:** cancelling when you're the last one signed up asks first ("You're the only greeter for …. If you cancel, we'll let the team know it needs a greeter."); a coordinator's Remove dialogs say the team will be told. The toast after says whether the team was actually told (the server's `teamTold`).
- **Known residue, accepted:** two people cancelling the same session at the same moment can both announce it; a reminder is keyed by its assignment, so if a cover is claimed between two runs on one day the new person isn't reminded that day; the mail sender swallows a refused send, so the daily pass paces its sends (600 ms) but still records a notice it couldn't deliver.

**From the signed-in walk (2026-10-18), Jesse's rulings:**
- **Peer-Led facilitators are both host and teacher** (*"think of it like they're both the host and the teacher/facilitator"*): Good Morning and Good Evening are meant to have a facilitator signed up, so that team's notices go out as for any team. At the walk, all 19 of its sessions in the next two weeks had no one.
- **The Dummy Test Program stays** while the hosts train on it, so the Hosting, Greeter and AV teams' notices include its daily 6:00 AM sessions until Jesse deletes it by hand. Archiving it takes it off every schedule and out of the notices; deleting it (archive first, its test registrations cancelled) also removes its sessions, rotations and team coverage.
- The walk also found the door's early entry (admin or guiding teacher) saying "You're teaching today" for the next session days away; it now says the day ("You're teaching on Tue, Oct 20").

**Recipients:** gap and look-ahead emails go to `getHubNotificationRecipients(team, { canCover: true })`, the coordinator note to `{ coordinatorsOnly: true }` (a team with no active coordinator is logged), so the pre-threshold gate applies at the source; the reminder is slug-gated and needs an ACTIVE membership with communications on. All four templates are in `/admin/emails` (Host Team group). **Their wording is provisional until Jesse's read-aloud.**

## What's deferred

| Item | Status | Why |
|---|---|---|
| Time-gate adjustments per-program | Deferred (parked) | The entry window is uniform across programs (host/early-open **30 min** before, member "Join now" **10 min** before, close **30 min** after — `lib/sessionWindowConstants.ts`, session 141); if dharma retreats want a longer pre-open, add a per-program override |
| Sub-request flow on AV (in-person) | Edge case to verify | Sub-requests still work in single-slot AV; verify on live deploy that the in-person hub's coordinator notifications behave correctly |
| Manual chapter for AV + greeter hubs | Open follow-on | Write a hub-specific manual chapter explaining the AV / greeter flow, the difference between single-slot and multi-claim, sub-request semantics. Can be done via `/admin/manual/<slug>/edit` once the hubs are configured. |
| Hub-aware new-program notifications | ✅ Done (session 146) | Every scheduler hub now gets the "needs coverage" heads-up, not just the primary host hub. An auxiliary hub (AV / greeter) is notified when a program is tagged for it — on **create** AND when **added on edit** (diffed against existing coverage rows so re-saving the editor doesn't re-notify; removals stay silent). Reuses the hub-neutral `new-program-needs-host` template (subject "New program added", body "may need {{coverageNoun}} coverage"); helper `lib/email.ts::notifyHubOfNewProgramCoverage`. Per-hub grain by design — a dual-hub member gets one email per role, each with that hub's noun + scoped link. |

---

## Adding a scheduling team (2026-10-15, corrected 2026-10-16)

A new team uses the Scheduler by configuration. No code changes, and no slug in code. Done in this order:

1. **Create the team** at `/admin/hubs/new`. You become its coordinator, able to take sessions and on its email pool; step back in its Members tab if that's not wanted.
2. **Install the Scheduler app** in the team's apps list (as primary if it's the team's main work). The Scheduler section appears in the form.
3. **Choose its kind:**
   - **Runs the session** (like the Hosting Team or Peer-Led Silent Meditation): check "This hub runs live sessions". It can then be a program's Hosting team; its people are the session's host at the Zoom door. (The teacher-pill settings on this form do nothing since sessions moved to Zoom; pending Jesse's decision.)
   - **Supporting role** (like AV or greeters): leave that off. Programs add it under "Auxiliary role coverage"; it never opens the room or admits anyone at the door. A supporting team for **virtual** sessions (say, tech support) would need new engineering to enter the room: today only the hosting team does.
4. **Open sign-up or one person per session.** Open sign-up means several people per session and no cover requests (greeters). Off means one person, who asks the team for cover (hosts, AV). Switching later is refused while it would break something: sessions with more than one person, or open cover requests.
5. **Formats it staffs** (virtual, in-person, hybrid). Removing one later asks first if it clears scheduled sessions, and refuses if the team hosts a program in that format.
6. **Its words:** role name, -ing verb and claim phrase ("Greeter" / "greeting" / "greet"). A blank field falls back to Host / hosting / host this. An abbreviation written in capitals (AV) stays capitalized. A regular plural is assumed ("Greeters"). They fill the Scheduler, the Zoom door (hosting teams), Home and coverage emails; dialogs and notices are written to fit every team without them.
7. **Attach programs:** set it as a program's Hosting team (the program's format must be one the team staffs, and "No host needed" off), or tick it under Auxiliary role coverage. The server refuses a team that doesn't fit, and the team is emailed when a program becomes its to staff.
8. **Add members** with "Can take sessions on the schedule" on. Then open `/tools/schedule?hub=<slug>` as a member and as the coordinator: the month shows, Rotations works, and the right empty state appears if no programs are attached.

**Retiring or archiving a team:** move the programs it hosts to another hosting team first (the save refuses otherwise). Archiving it, or removing its Scheduler, then asks before clearing its upcoming sessions and rotations, and tells the people on them.

**An outside meeting link** sends everyone, the team's people included, straight to that room; there's no Claim Host there.

What the code guarantees for any team: every create passes `teamCannotStaff` (reassign, claim-by-id and cover act on existing rows and check the team where it matters), every gate is `canManageHubCoverage` with the resource's own team, rows come from `buildHubMonthSessions`, a session is matched by its Central day, and only the hosting team opens the room. If a new team needs behaviour none of these settings express, that is new engineering: follow the Hub App Integration Gate in `CLAUDE.md`.

---

## When adding a new tab or affordance to the Scheduler

1. Decide whether the new feature is hub-scoped or hub-agnostic. If unclear, default to hub-scoped.
2. Apply the four routing layers (see `RIM_Hub_Engineering.md`).
3. If it sends email, follow `RIM_Email_Engineering.md`.
4. Update this doc with the new feature's hub-scoping story.
5. At closing ritual, audit every callsite (the addition CLAUDE.md requires for hub slices).

---

*RIM Scheduler · September 2026 · Per-tool reference written during session 128 Slice 2.5.*
