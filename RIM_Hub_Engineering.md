# RIM Hub Engineering — rules for code that touches a hub

**Read this before writing or modifying any code that interacts with hubs, hub members, tool access, hub-scoped routing, or anything that emits a notification on behalf of a hub action.**

This document is the engineering checklist. It is distinct from `RIM_Hub_Model.md` (which describes *what hubs are*) and from per-tool engineering docs like `RIM_Scheduler.md` (which describe *one specific surface*). The rules here apply to *every* hub-related callsite.

If you're learning the system, read `RIM_Hub_Model.md` first. If you're writing code, read this.

---

## The core principle

> **Shared infrastructure, hub-scoped data.**

RIM uses one set of code, one set of routes, one set of UI for every hub. Each hub gets its own scoped slice of the data those shared components display.

This is the right architecture for RIM's scale (low double-digit hubs eventually, with the same coordinator practice across all of them). It's also the architecture with a sharp edge: **every callsite that touches hub context must honor scoping. Any one that doesn't creates a cross-hub leak.**

Slice 1 (session 128) routed the *data* layer correctly. Slice 2.5 (session 128 follow-up) caught and fixed the *email URL* layer that Slice 1 missed. Future slices will surface other layers we didn't think of. The discipline below is how we keep the architecture honest.

---

## The four routing layers

Every hub-related action touches up to four layers. **Every layer must honor the hub for the action to be correctly isolated.**

| Layer | Question | Slice 1 surface | Where the rule lives |
|---|---|---|---|
| **Capability** | Can this user perform this action in this hub? | `lib/sessionAuth.ts::resolveSessionRole`, `lib/hubMemberAuth.ts::getEffectiveHostingCapability` | API route handlers gate by `program.hostingHubSlug` |
| **Recipients** | When this action sends notifications, who gets them? | `lib/toolAuth.ts::getHubNotificationRecipients(hubSlug, …)` | Caller passes the *program's* hub, not the actor's hub |
| **UI filter** | What does the schedule / hub workspace show? | Filtered by `Program.hostingHubSlug === hub.slug` in queries | List queries always include the hub filter |
| **Outbound URLs** | When the email's recipient clicks through, where do they land? | `lib/email.ts::hubScopedUrl(path, hubSlug)` and `hubHomeUrl(hubSlug)` | Every URL variable in an email passes through a helper |

The leak class: forgetting any one of these.

Real example from Slice 2.5: capability gates routed correctly to peer-led-silent-meditation. Recipient pool routed correctly to peer-led members. UI scoped correctly. **But the URL in the sub-request email was `/tools/schedule` with no `?hub=`**, so Nancy (who's in both hubs) landed in host-team. Three layers right, one wrong, action looked broken.

---

## Helpers and where they live

| Helper | File | Purpose |
|---|---|---|
| `getProgramHubSlug(programSlug)` | `lib/programHub.ts` | Returns the program's hub slug. Null `hostingHubSlug` defaults to `"host-team"`. Use this every time you need to route a per-program action by hub. |
| `getProgramHostingHub(programSlug)` | `lib/programHub.ts` | Returns `{ hubSlug }` (the teacher-pill fields were retired 2026-10-16). Used by `resolveSessionRole`. |
| `teamCannotStaff(hubSlug, programSlug)` | `lib/programHub.ts` | The one rule for "may this team staff this program now" (active, Scheduler installed, hosts or covers it, format among the team's, a host needed). Every coverage create checks it. |
| `hostingTeamRefusal(hubSlug, format)` / `supportingTeamRefusal(hubSlug, format)` | `lib/programHub.ts` | May this team be a program's Hosting team / supporting team? Returns why not, in words. Program routes run them before writing. |
| `canManageHubCoverage(userId, roles, hubSlug)` | `lib/hubAuth.ts` | The one coverage-management gate: HOST_MANAGER, ADMIN, or that team's ACTIVE coordinator. Always pass the resource's own team, loaded from the row. |
| `authorizeSelfClaim` / `canSelfClaim` | `lib/hubMemberAuth.ts` | Taking a session yourself (access, coverage allowed, then enrollment); `canSelfClaim` is the same test without enrolling, for showing buttons. |
| `releasePersonCoverage(tx, userId, byUserId, opts)` | `lib/applyStandingAssignments.ts` | Take one person off their upcoming sessions (pause, archive, Inactive, deletion). |
| `sendCoverageClearedEmails({ rows, reason })` | `lib/email.ts` | Tell everyone a coverage change took off sessions (template `coverage-sessions-cleared`). |
| `DEFAULT_HOSTING_HUB_SLUG` | `lib/programHub.ts` | The constant `"host-team"`. Use this everywhere you need the default — never inline the string. |
| `getEffectiveHostingCapability(userId, hubSlug, fallback)` | `lib/hubMemberAuth.ts` | "Is this user an active hosting-capable member of this hub?" Pass `program.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG`. |
| `getHubNotificationRecipients(hubSlug, opts)` | `lib/toolAuth.ts` | Active members of a hub with `communicationsEnabled`. Use for notification recipient pools. Pass `canCover: true` for coverage asks (cover requests, a new program to staff), so people taken off the schedule aren't asked. |
| `getHubMembership(slug, userId, roles)` | `lib/hubAuth.ts` | Returns `{ hub, member, isAdmin }`. Fetches the row; gate access with `canAccessHub`, never a bare `!member` (see *ADMIN policy* below). |
| `canAccessHub(member, roles)` | `lib/hubAuth.ts` | **The access door** (session 135). True if a `HubMember` row exists OR roles includes `GUIDING_TEACHER`. ADMIN-alone does NOT pass. Single source of truth — use at every hub access gate (the layout, all sub-pages, every `/api/hub/[slug]/**` route). (The session-165 `openToAll` argument was removed when the Community Space retired in session 166.) |
| `effectiveCoordinator(member, roles)` | `lib/hubAuth.ts` | "Is this user acting as coordinator on this hub?" True for ADMIN, GUIDING_TEACHER, or an **ACTIVE** member with the coordinator flag (ACTIVE since 2026-10-19: a paused coordinator steps back from the Members tab, moderation, the team line and Trash). `member` must carry `status`. Use everywhere you would have written `(member?.isCoordinator ?? false) || isAdmin`. `canManageTrash(roles, member)` is the same rule. |
| `hubScopedUrl(path, hubSlug)` | `lib/email.ts` | Append `?hub=<slug>` to a `/tools/*` URL when the slug isn't the host-team default. Use for every email link to a hub-scoped tool view. |
| `hubHomeUrl(hubSlug)` | `lib/email.ts` | Build `/account/hub/<slug>` (the hub's own workspace URL). |
| `emailButtonHtml(label, url)` | `lib/email.ts` | Canonical CTA button HTML for emails. See `RIM_Email_Engineering.md`. |
| `removeHubMembershipWithCleanup(hubId, hubSlug, userId)` | `lib/removeHubMembership.ts` | Hard-removes a `HubMember` AND its future coverage footprint (FK-safe: SubClaim → SubRequest → HostAssignment → StandingAssignment) in one transaction. The "covers ⇒ member" cleanup, shared by the in-hub hard-remove and the Member-Registry Teams tool — never inline this cascade again. |
| `roleDerivedHubs(roles)` | `lib/syncHubMembership.ts` | The hubs a user's roles imply (Courses ← TEACHER, Registrar ← REGISTRAR). Drives the locked "via role" rows + the 409 guard in the Member-Registry Teams tool. |

When you find yourself reaching for a fresh `${BASE_URL}/tools/schedule` or hardcoding `"host-team"`, stop. There's a helper.

---

## Member data, hub membership, and person-pickers (session 153)

**Who hasn't signed in (2026-10-21):** a team's Members tab tells its coordinators which members have never signed in ("Hasn't signed in yet. Team emails start when they do."). The page and `POST /api/hub/[slug]/members` send `signedIn` (from `User.emailVerified`, the test the pre-threshold email gate uses) only when the viewer coordinates that team, the same rule as `coordinatorNote` and members' email addresses; everyone else receives `null`.


- **The Member Registry now WRITES hub membership.** `/api/admin/members/[id]/hubs` (ADMIN + REGISTRAR) is the canonical place to add/remove a person to/from any hub — the profile's "Hub memberships" (Teams) section. Previously hubs owned their rosters; this is a deliberate shift. Removal MUST go through `removeHubMembershipWithCleanup` so the assignment ledger can't outlive the roster ("covers ⇒ member", s146).
- **Roles vs membership.** Being on a team is a `HubMember` row, not a role. The plain `HOST` role is retired — host-team membership is the source of truth for hosting (capability / scheduler / tool access all already read membership). Only `TEACHER`/`REGISTRAR` still *imply* a hub (`ROLE_HUB_MAPPINGS` → `roleDerivedHubs()`); those rows are role-governed, shown locked in the Teams tool, and the routes 409 direct writes to them. `HOST_MANAGER` is a cross-hub scheduling power, NOT a host-team membership.
- **Every person-picker must exclude the legacy-unclaimed pool.** Any UI that searches/lists `User` rows to pick a person (hub member search, household add-member, instructor picker, future autocompletes) MUST filter `isLegacyUnclaimed: false` (and usually `archivedAt: null`). Imported-but-never-claimed ghosts must never be pickable; they become pickable when they claim their account on first login. Admins still pre-stage a legacy person **by id** from the Member Registry — that path is by-id, not search, so it's exempt.

---

## The ADMIN / GUIDING_TEACHER access policy

**The access door is `canAccessHub(member, roles)`: a HubMember row OR the GUIDING_TEACHER role.** (Door established session 128 for ADMIN; GT added to it session 135.)

A hub is a team space, and the team is defined by membership — with one exception. The two roles relate to that door differently, and the distinction is the whole point:

- **ADMIN does NOT pass the door.** ADMIN is *technical* authority: it configures hubs from `/admin/hubs` (still ADMIN-gated) but to interact with hub content — read or post conversations, view documents, claim sessions — an ADMIN must be a HubMember like everyone else.
- **GUIDING_TEACHER DOES pass the door, without a membership row** (session 135). GT is *dharma* authority — the sangha-wide steward of every hub's content and tone (`RIM_Role_Design.md`). The role doc always granted this reach; before session 135 the access gate silently blocked it (the powers were unreachable). `canAccessHub` now honors it.

The reason the two diverge: pastoral reach into a team's private space belongs to the dharma role, not the technical one. A future technical operator who isn't a teacher should not inherit it. (Jesse holds both roles; his hub access flows through GUIDING_TEACHER — the right reason — which is also why GT had to be made assignable in the member registry; see session 135.)

What's still ADMIN-only:
- `/admin/hubs/*` configuration (hub create, edit, delete)
- Hard-remove member at `/api/hub/[slug]/members/[userId]` DELETE
- The `/admin/hubs/[slug]/add-me-as-coordinator` endpoint (bootstrap path for an admin who needs to enter a hub someone else created — see auto-coordinator note below)
- Anywhere `effectiveCoordinator` or `requireCoordinator` is consulted — those still ADMIN/GT-bypass because they're coordinator-level authority, not access

The mental model: **ADMIN configures hubs from outside; ADMIN participates from inside (as a member).**

**Auto-coordinator on hub creation (session 131).** `POST /api/admin/hubs` writes a `HubMember` row for the calling admin atomically alongside the hub itself, via Prisma nested `members.create`. Values mirror `/api/admin/hubs/[slug]/add-me-as-coordinator` exactly (`isCoordinator: true`, `status: ACTIVE`, `hostingCapability: true`, `communicationsEnabled: true`, `position: "Coordinator"`). The standard creator flow no longer requires the post-create "Add me as coordinator" click. The safety-net endpoint stays for the case where an admin needs to bootstrap into a hub someone else created. **Implication for new code:** when a hub exists, its creating admin is *always* a coordinator-member. Don't write defensive code that assumes "the creator might not be a member."

---

## Per-hub feature switches

`Hub.conversationsEnabled` (default true) gates both the Conversations tab and every conversation page/API. Never ship show-but-can't-act or hidden-but-reachable behavior: one flag closes or opens the entire feature boundary. The session-165 `openToAllMembers` primitive and Community Space were retired in session 166; every Space again uses a real roster plus the `canAccessHub(member, roles)` membership-or-GT door.

## Common pitfalls

**Hardcoding `"host-team"`.** It's the historical default but it's no longer the only option. Use `DEFAULT_HOSTING_HUB_SLUG`. When routing capability or notifications, always derive the hub from the *thing being acted on* — usually `program.hostingHubSlug`.

**Routing by the actor's hub instead of the resource's hub.** A peer-leader of `peer-led-silent-meditation` might also be on the host-team. If they take an action on a peer-led program, capability + notifications + URLs should all route by the **program's** hub, not the actor's. The actor's current viewing context (`?hub=` in URL) is a UI affordance, not an authoritative routing input.

**Bare `.catch(() => {})` for fire-and-forget side-effects** — NOT just emails. Vercel's serverless lifecycle kills in-flight Promises when the response returns. Use `after()` from `next/server` — that's the canonical fire-and-forget for route handlers. For functions called by routes (`syncHubMembership` etc.), either `await` the sends so the parent route waits, or accept an `after()` callback the route can wrap. Bare `.catch(() => {})` also swallows errors silently — even if delivery worked, we'd lose observability. The pattern applies to **every** fire-and-forget — emails, enrollment side-effects, alert dispatch, role-side-effects, payment-completed actions. Session 131 swept the codebase and converted 9 remaining sites; structured `console.error("[route-name] fnName failed", err)` makes future failures discoverable in Vercel logs.

**Filtering at the page level without filtering at the API.** A common shortcut: page query returns all data, page UI filters by hub. Wrong — the API should filter, because (a) it's where security boundaries live and (b) downstream consumers (counts, badges, exports) shouldn't have to re-implement the filter. See `app/tools/schedule/page.tsx` for the canonical pattern of filtering programs by hub in the Prisma query.

**Forgetting the host-team-null edge.** Old programs (and any program where the coordinator hasn't set a hub) have `Program.hostingHubSlug === null`. The convention is null = host-team. UI queries for the host-team hub use Prisma's `OR` to catch both null and explicit `"host-team"`:
```ts
where: { OR: [{ hostingHubSlug: null }, { hostingHubSlug: "host-team" }] }
```
Other hubs filter by exact match. Don't omit the `OR` for host-team or existing programs disappear.

---

## The closing-ritual addition (session 128 follow-up)

When a slice touches a hub, member, tool access, or any hub-scoped route, the closing ritual MUST include an audit of all four routing layers across every callsite the slice touched.

Specifically:

- [ ] Every API route that gates an action: does the gate route by the **program's** hub (or the resource's hub), not the actor's?
- [ ] Every notification recipient pool: does it use `getHubNotificationRecipients(programHubSlug, …)`?
- [ ] Every page or query that lists items: does it filter by hub?
- [ ] Every email-template URL variable: does the calling code build the URL with `hubScopedUrl()` or `hubHomeUrl()`?
- [ ] Every hardcoded `"host-team"` string: was it intentional (host-team-specific behavior) or did you miss `DEFAULT_HOSTING_HUB_SLUG`?

Slice 1 (session 128) addressed layers 1–3. Slice 2.5 (session 128 follow-up) found and fixed layer 4. The next slice that touches hubs should treat all four as a single checklist item.

## Reviewer findings that identify a *pattern* require a codebase-wide audit (session 130 follow-up)

When the reviewer sub-agent flags a class of bug (not a single local mistake), the fix is not done until the same pattern has been grepped across the codebase and addressed everywhere it lives.

The lesson came from session 130's same-day follow-ups. The reviewer flagged a SubRequest FK-Restrict violation in the heal migration and the program-transfer PUT handler. I fixed both — but didn't ask "where else does this pattern exist?" Three production routes (`clear-rotations`, `release-host`, `assignments/[id]` DELETE, `assignments/reassign`) had the same FK-Restrict shape latent. Jesse hit the next one in production within an hour of the heal landing.

Specifically:

- The reviewer's finding **2** described "SubRequest FK is Restrict; cancel-OPEN-then-delete will FK-violate."
- I read that as "fix this in the migration and the PUT handler."
- The correct read was "audit every site that does cancel-OPEN-then-delete on HostAssignments."

When closing a reviewer finding, ask: **is this a local bug or a pattern?** If a pattern, the resolution is `grep` + audit, not just patching the cited line.

## Destructive routes — the deletion pattern (session 130 follow-up)

Every destructive route in the hub-scoped API touches three tables in a fixed order. Documented in detail at the bottom of `RIM_Scheduler.md`. The short version: **SubClaim → SubRequest → HostAssignment → (optional) StandingAssignment**, all `deleteMany` (never `updateMany` cancel for the SubRequest step), wrapped in `$transaction`. The `cancel-OPEN-then-delete` pattern that historically lived in some routes was unsafe — any non-OPEN SubRequest (CLAIMED, CANCELLED) on a target HostAssignment FK-Restrict-blocks the parent delete.

Add this to the closing checklist when touching any destructive route:

- [ ] Does the route do a `delete` or `deleteMany` on `HostAssignment`?
- [ ] If yes, are SubClaim + SubRequest rows for those HostAssignments deleted first (not just cancelled)?
- [ ] Are the deletes wrapped in a single `$transaction`?

## State changes that span multiple writes must be atomic (session 130 follow-up)

When a route's correctness depends on two or more writes succeeding together (e.g. "cleanup the old state + commit the new state"), wrap them in a single `$transaction`. The session 130 program-transfer route is the canonical example: it deletes the old hub's StandingAssignment rules + future HostAssignments AND updates `Program.hostingHubSlug` atomically. If the cleanup throws, the transfer rolls back together and the coordinator can retry.

The pre-session-130 (and pre-reviewer) version did them sequentially: `program.update` first, then cleanup. A cleanup failure left the program on the new hub with orphan rules on the old hub — exactly the bug session 130 was healing.

**Rule:** if step 2 depends on step 1's outcome to be coherent, and a partial failure produces an invalid system state, both belong in the same `$transaction`.

## Client mutations must explicitly pass `hubSlug` (session 130 follow-up)

The server-side fallback in standing-assignment routes:

```ts
const programHubSlug = await getProgramHubSlug(body.programSlug);
const targetHubSlug = body.hubSlug || programHubSlug;
```

…is **backward-compat for legacy callers**, not a default for new client code. When `body.hubSlug` is missing, the server falls back to the program's primary hub. For a coordinator on an auxiliary hub (AV, greeter), that means the mutation silently writes to the wrong hub — invisible in the view that submitted it.

The session-130 bug: `RotationsClient.handleSave`, `handleEnd`, and `handleSetEndDate` all POSTed without `hubSlug`. A coordinator on Greeter trying to save a rotation found their rule written into host-team. The UI looked broken — the save returned 200, but the new rotation was in a different hub than the one they were viewing.

**Rule:** every client-side mutation that targets a hub-scoped resource MUST pass `hubSlug` in its body. The server's primary-hub fallback should only ever fire for legacy callers that pre-date the field (and those should be migrated when found). Treat a missing `hubSlug` in new code as a client bug.

**Closing checklist:** when touching a client handler that POSTs to a hub-scoped route, grep its body string for `hubSlug` before committing. If it's not there, the fallback is masking a bug.

## Hub config is the right granularity for behavior variance (session 130 follow-up)

After session 130's final commits, six hub-config fields drive every per-hub behavior in the Scheduler with no code branches per slug:

| Field | Drives |
|---|---|
| `hasSchedule` | Hosting team dropdown eligibility (the Home month overview it once drove was retired 2026-10-13) |
| `allowsMultipleAssignments` | Single-slot vs open-signup Schedule UX (set in `/admin/hubs` since 2026-10-15, guarded) |
| `appliesToFormats` | Which programs a team staffs (set in `/admin/hubs` since 2026-10-15; a dropped format confirms before clearing) |
| ~~`assignmentGrantsTeacher` + `teacherLabel`~~ | Retired 2026-10-16 (did nothing after the move to Zoom; columns unused) |
| `coverageNoun` + `coverageVerb` + `coverageAction` | User-facing UI + email copy |
| `ProgramCoverageHub` (join table) | Primary + auxiliary program coverage |

When adding a new hub-aware behavior, the first question is: **is this a code branch per slug, or a new hub-config field?** Default to the config field. New hubs become configuration on top of the architecture, not new code. A code branch per slug is a hint that a missing config field hasn't been articulated yet.

## A registered app is a contract, not a link (sessions 167–168)

`HubAppLink.toolSlug` marks a real installation. `lib/toolRegistry.ts` declares the app's canonical route, distinct semantic `iconKey`, compatibility, whether it may be primary, and which Space contributions it promises. `lib/hubApps.ts` is the server provider registry that fulfills those promises. The module validates declared Updates/attention capabilities at load time, and its provider map is exhaustive over `ToolSlug`; registering a slug without a provider is a compile-time failure. A row with `toolSlug: null` is a custom navigation link only.

An installation may provide five things: sidebar navigation, active-member tool access, one Home contribution, source-aware Updates, and personal attention. Those must agree about the same Space. It must never replace the base Home or use a hub-slug switch to create a parallel Space implementation.

Current safety rules:

- Scheduler is multi-Space because every query/write already routes by `hubSlug` and the program/resource hub.
- Helping with (2026-10-24) is multi-Space: every read is scoped by the team (`program_helpers.hubId`), so any team that prepares for programs may install it. See "Helping with: the gate and the four-layer audit" below.
- Registration is restricted to `registrar`, Programs to `registrar` and `program-central` (`alsoSpaceSlugs`, 2026-10-24), and Course Manager to `courses`, until their data and permissions are truly multi-Space scoped.
- Admin UI and POST/PATCH APIs both block newly incompatible installs. Ordinary edits preserve an existing incompatible row so an unrelated save cannot break a team.
- Hub config + app replacement commit in one `$transaction`; never delete all links before a possibly-failing hub update.
- `hasToolAccess()` grants the app-link pathway only to ACTIVE members of an ACTIVE hub. Custom links never grant access. Registration is the exception: role-only (`canUseRegistration`: Registrar, Admin, Guiding Teacher) on every page and API, and a team's Home and rail show it only to those roles through `canSeeInstalledApp` (2026-10-23, `RIM_Registration_App.md`). Programs follows the team pathway since 2026-10-24 (`canUsePrograms`: the roles or a member of a team with it), with archive, delete, the guest-link reset and categories still role-only (`RIM_ProgramEditor.md`).
- When a Space has enabled registered apps, one is primary (`HubAppLink.isPrimary`); a partial unique index enforces at most one primary per Space. Other registered apps are supporting. Custom links can never be primary.
- Home renders at most one contribution per app, and only the primary app's: one summary line in the highlighted tool card at the top of team Home (2026-10-13). Supporting apps and custom links are quiet destination rows. No app adds a module, disclosure or second card, and a summary never states a count it cannot compute truthfully (the Scheduler's row count would have; see "Team Home, 2026-10-13").
- Updates adapters emit only meaningful, visible events (never held Google-file draft activity) and every item names `sourceKey`, `sourceLabel`, and `kind`.
- The Updates View picker's types derive from enabled core features plus installed apps whose registry contract promises Updates. Type filtering happens in `listHubActivity()` (the `folder` and, with For you, `source` parameters) on the server before the merged stream is paginated; never filter only the already-loaded client page.
- Personal attention is separate from shared Updates. An app owns the meaning and recipients; the Space owns the consistent Home rendering. Passive history must not become an attention badge.
- Updates is an inbox (2026-10-19; supersedes "no read boundary"): read is a mark, never a removal, and All keeps everything. The rail's Updates number counts only unread items **for you**, never team news alone. Team Home's attention line stays app-owned and unchanged. See "The Updates inbox" below.

### New app integration gate

Before a new app may be installed through `HubAppLink`, all ten answers must be explicit:

1. Is it `multi-space` or `primary-space`?
2. May it be the primary app, and which unique semantic icon identifies it?
3. Do every scoped read and write derive authority from the resource Space?
4. What is its single Home contribution (`summary` or `none`; the `module` mode was retired 2026-10-13)?
5. Which durable, actor-attributed events are meaningful Updates?
6. Which signals are personally actionable, and for whom?
7. Which detailed count does the app itself own?
8. Does install/remove leave the base Space intact?
9. Do navigation, access, Home, Updates, attention, notifications, and URLs use the same Space?
10. Has the four-layer hub audit passed?

If any answer is missing, restrict the app to its primary Space or ship it as a custom link. Installing an existing compatible app must be an admin configuration action; only building genuinely new app behavior should require engineering.

## Helping with: the gate and the four-layer audit (2026-10-24, Phase 3 slice 5)

Helping with is the app for a team that prepares for programs without being on their schedule (a kitchen team). A program adds the team under Who's helping → Teams that prepare (`program_helpers`, by team id, with `canReach`); the team then sees, in `/tools/helping?hub=<team>`, each program it prepares for, how many are coming, and the answers to the questions it asks (`askedBy: "team:<hubId>"`), with email and phone only when `canReach`. Never dana. Rules: `lib/programHelpers.ts`.

The ten answers:
1. **Multi-Space.** Any team may install it; nothing is shared across teams.
2. **May be primary** (a team that only prepares has nothing else to lead with). Icon: `helping` (hand with heart).
3. **Scoped by the resource Space:** every page derives the team from `?hub=` through `helpingTeamAccess` (active team, app installed, the person an active member or the guiding teacher), and a program page also requires that team's `program_helpers` row. Writes to `program_helpers` happen only in the program editor's save routes (`checkHelperTeams`: a newly added team must be active with the app).
4. **Home:** one summary line, "N programs to help with", counted from this team's rows only (current programs: not archived, not a one-time program that is over).
5. **Updates:** none at first.
6. **Attention:** none at first.
7. **Counts:** owned by the app (people with a place, per program).
8. **Install and remove:** removing the app leaves the base Home, Conversations, Files and Members intact. The team's `program_helpers` rows stay; a new one can't be added until the app is back, and `loadAskerContext` keeps the team's questions while the team is active.
9. **Same Space everywhere:** the rail link, Home line, pages and links all carry the team (`?hub=`); `canSeeInstalledApp` shows it to the team's active members and the guiding teacher, as the pages admit.
10. **The four layers** (below) pass.

| Layer | Helping with |
|---|---|
| Capability | `helpingTeamAccess(userId, roles, hub)` on both pages; the program page also needs the team's `program_helpers` row; Admin alone has no path. |
| Recipients | None: it sends no email or notice. |
| UI filter | Programs: `program_helpers.hubId = team.id`. Questions: `askerOf(...)` is this team's id. Contact fields are selected only when `canReach`. |
| Outbound URLs | Every link carries `?hub=<team>` (list → program → back). No emails. |

Also in Phase 3 (the helpers' pages; recorded in `RIM_Member_Area.md`): the teacher's page (`/account/teaching`, program teachers and the guiding teacher) and a supporting team's Today's list (`/account/greeting`, assigned team members, the team's active coordinators, the guiding teacher). Neither is an installable app; both follow the same rules: derived from the resource (the program, the session), never Admin alone, never dana.

## Audit at the user-flow layer, not just the code-correctness layer (session 130)

The code-correctness audit above is necessary but not sufficient. Session 129's five-phase audit verified hub-scoping correctness across every routing layer and ran clean. The next slice (session 130, Maria's beta test) immediately surfaced four real bugs in the *user flow*:

- Sub-request affordance technically present but undiscoverable because the email link landed on the wrong month.
- "Release their dates" route silently undone by the next cron run because the rotation rule wasn't deleted.
- Destructive-action toasts didn't name what was deleted, so a coordinator couldn't verify their intent.
- An email body claimed an action that didn't match what the route did.

None of these would fail a routing-layer audit. They're all gaps at the user-flow layer: what happens when a real person follows the actual path the UI offers?

**Add to the closing ritual when a slice touches a tool with a human-facing flow:** walk the user's flow as the actual user, end to end. Click the affordance the system tells them to click. Read the email the system sends. Reach the destination the link lands on. Verify the success toast tells the truth. If any of those layers lies to the user — even when the code is "correct" — that's a real bug in scope for this slice, not a polish item for later.

---

## A `Program.hostingHubSlug` change clears the old team (2026-10-15)

Supersedes the session-128 grandfather policy. When a program moves to a new Hosting team, the save (`app/api/programs-pg/[slug]/route.ts`) deletes the old team's future HostAssignments (with their cover requests, FK-safe) and all its rotations for the program, in one transaction; supporting teams are untouched. The editor warns before saving with the count. Only a team that runs sessions, is active and has the Scheduler installed may be chosen (`lib/programHub.ts::hostingTeamRefusal`). A save that unticks a supporting team, or changes the format, clears only the teams it affected (`clearCoverageNoLongerStaffed(programSlug, onlyHubs)`). Detail: `RIM_Scheduler.md`.

---

## Two hub signals — `hasSchedule` vs `usesScheduler`

These are distinct concerns. Conflating them in session 129's first ship caused two visible bugs (AV/greeter hubs rendering the host-team Home view; peer-led-silent-meditation disappearing from the Hosting team dropdown after a tightening fix).

| Signal | Storage | Means | Drives |
|---|---|---|---|
| `Hub.hasSchedule` | column on Hub (boolean) | "this hub runs live sessions" and holds primary hosting authority | ProgramEditor's Hosting team dropdown eligibility (the Home month module was retired 2026-10-13) |
| `usesScheduler` | derived (`HubAppLink` with `toolSlug = "schedule"` exists on the hub) | "this hub uses the Scheduler tool to staff roles" | ProgramEditor's Auxiliary coverage eligibility, Members tab hosting affordances, destructive-action warning |

Rule of thumb when adding a hub-aware feature:
- Asking "is this a hosting hub?" → use `hasSchedule`
- Asking "does this hub schedule volunteers?" → use the HubAppLink lookup (or pass it through as `usesScheduler`)
- Asking "does this hub schedule volunteers for *this program*?" → use `getProgramSlugsForHub(hubSlug)` (covers primary + auxiliary)

The admin form at `/admin/hubs` exposes `hasSchedule` directly; `usesScheduler` is derived per-hub from the app links (not a separate column).

---

## Destructive routes need hub-scoping discipline

The session-129 audit found that the destructive routes (`/api/host/programs/[slug]/clear-rotations` and `/api/host/assignments/clear`) were both unscoped or hardcoded to host-team. The blast radius of a destructive route is bigger than a read route's, so the four routing layers from the table below apply *more* strictly there, not less.

Pattern for any destructive route:
1. Take `hubSlug` as a required body field (or derive from a resource the user explicitly identified).
2. Gate coverage routes by `canManageHubCoverage(userId, roles, hubSlug)` (HOST_MANAGER, ADMIN, or the team's ACTIVE coordinator, built on `isHubCoordinator`); content routes by `effectiveCoordinator` / `canManageTrash`. All three are ACTIVE-only: `isHubCoordinator` since session 171 (including `isSpaceLead` in Google Files), `effectiveCoordinator` and `canManageTrash` since 2026-10-19.
3. Scope every `deleteMany` / `updateMany` by `hubSlug`.
4. Update UI copy to make the hub scope plain ("Reset this team" not "Reset everything").

---

## Auxiliary-hub coverage (session 129 — many-to-many)

The Slice 1 / 2.5 / 2.6 model assumed **one program ↔ one hub** via `Program.hostingHubSlug`. Session 129 generalised this to **one program ↔ many hubs, each covering a different role**. An in-person Saturday Sit can now be: host-team (or peer-led) for the live session + audio-visual for the AV slot + greeter for the greeter signup. Three hubs, three independent scheduler views, three sets of HostAssignment rows.

**Schema model** — `Program.hostingHubSlug` is the **primary** hub (who runs the live session, owns the LiveKit room, holds dharma authority). Auxiliary hubs are listed in the `ProgramCoverageHub` join table (`programSlug` + `hubSlug`). `HostAssignment.hubSlug` and `StandingAssignment.hubSlug` columns carry the assignment's owning hub directly — the database-level unique on `(programSlug, sessionDate)` was dropped; app-layer enforcement handles single-slot uniqueness per `(programSlug, sessionDate, hubSlug)`.

**Two hub modes** — `Hub.allowsMultipleAssignments` flips the model:
- **False (single-slot)** — host-team, peer-led, audio-visual. One claimant per session per hub. Existing claim-the-seed pattern, sub-requests, standing rotations all apply.
- **True (multi-claim)** — greeter. Open sign-up: every claim is a fresh row keyed `(programSlug, sessionDate, hubSlug, userId)`. No sub-request flow — release-my-claim is the only exit. Multi-claim rows render as a community of people (stacked names + self-recognition + plain-language state header), never as a comma list.

**Two format buckets** — `Hub.appliesToFormats` declares which `programFormat` values a hub schedules. Host-team / peer-led: `["virtual","hybrid"]`. Audio-visual / greeter: `["in-person","hybrid"]`. Drives the Scheduler page's program filter.

**Five-question routing checklist** for any hub-touching API:
1. Capability gates by the **resource's** hub (HostAssignment.hubSlug or program.hostingHubSlug, depending on what the action operates on).
2. Notification recipient pool uses `getHubNotificationRecipients(<that hub>, …)`.
3. UI / list queries filter by `hubSlug`.
4. Every email URL variable passes through `hubScopedUrl()` / `hubHomeUrl()`.
5. **(session 129)** Multi-claim hubs honor `Hub.allowsMultipleAssignments` — single-slot semantics (uniqueness, sub-requests, claim-the-seed) do not apply.

**Helpers added in session 129** (`lib/programHub.ts`):
- `getProgramCoverageHubs(programSlug)` — auxiliary hub slugs for a program
- `getProgramSlugsForHub(hubSlug)` — union of primary + auxiliary programs for a hub
- `getHubCoverageConfig(hubSlug)` — `{ slug, appliesToFormats, allowsMultipleAssignments }`

**Standing rotations now hub-scoped per-record.** Slice 1's "still gates by host-team" warning is closed: every standing-assignments route accepts a `hubSlug` body field (defaults to program's primary hub), `StandingAssignment.@@unique` was widened to include `hubSlug`, and `lib/applyStandingAssignments.ts::Candidate` carries `hubSlug` so applied HostAssignments inherit the source rotation's hub. A program can hold parallel rotations on the same day in different hubs (host-team on first-Saturday + AV on first-Saturday is two records, no conflict). Apply-time emails group per-user-and-hub so each notification's CTA points at the right Scheduler view.

---

## Coverage copy is a routing layer that reaches the dashboard + emails, not just the Scheduler (session 145)

Layer 4 (copy) of the four routing layers isn't only the Scheduler's card text. **Any** surface that names a scheduler hub's coverage role — the dashboard welcome panel, the hub home/sidebar count (`lib/hubContext.ts`), the shared host/sub emails — must resolve `getHubCoverageCopy(hubSlug)` (→ noun/verb/action) or stay hub-neutral, so AV / greeter / peer-led never read "host". Session 145 swept the surfaces that still hardcoded it (and fixed a latent bug where the host-team home count summed *every* hub's gaps). The audit rule: when you touch a host/coverage surface, grep for hardcoded `"host"`/`"hosting"` and ask "does a non-host hub render this?" — the leak hides in the dashboard and email bodies, not just `/tools/schedule`. (Greeter is multi-claim and has no unclaimed-slot count; that's intended, not a gap.)

---

## The assignment ledger must not outlive hub membership — "covers ⇒ member" (session 146)

`HostAssignment` / `StandingAssignment` are an assignment *ledger*; `HubMember` is the team *roster*. They're decoupled in the schema (no FK between them, and the no-delete-on-role-revoke policy protects the roster, not the ledger), so nothing inherently stops the ledger from naming someone who isn't on the roster. The Scheduler then shows that person as covering a session but omits them from the member picker — the "Nancy" symptom (assigned but un-findable).

**Rule:** any code that writes an assignment for a hub must ensure the assigned user is (or becomes) a member of that hub; any code that hard-removes a member must clean up that member's future assignments + rotation rules in that hub (FK-safe SubClaim→SubRequest→HostAssignment, in a `$transaction`). The invariant is enforced at five points — see `RIM_Scheduler.md` ("The membership invariant"). Helpers: `canAccessHubScheduler` (`lib/hubAuth.ts` — the per-hub Scheduler access door, distinct from `canAccessHub`) and `ensureActiveHubMembership` (`lib/hubMemberAuth.ts` — auto-enroll on self-service writes).

This was **not** a cross-hub leak (the four routing layers above were clean) — it's a separate integrity axis. When you add a surface that writes coverage, ask: *can this create a row whose user isn't on the hub's roster?* If yes, close it at the write, not in the display.

---

## Google Files are resource-gated inside a Space (sessions 163–166)

The Space rail identifies context; it is not file authorization. Every file read/write resolves the file back to an accessible Google Files place and, for folder-scoped Spaces, verifies that it descends from that Space's configured root. Use the gates in `lib/googleFiles.ts`; never trust a caller's `hubSlug`, Drive id, or file id by itself. Held drafts must not leak through lists, Home, or Updates. Full model: `RIM_GoogleWorkspace.md`.

---

## Presentation shell invariant (session 162)

Hub context has one local navigation rail. A normal hub page renders beneath the shared member header and inside `HubWorkspaceSidebar`; it must not also render `AccountSidebar`, a second tool header, or a page-local outer shell. A hub-launched tool uses `WorkspaceShell` with `?hub=` so the same hub rail persists. Direct tool entry may use `ToolsNav` instead.

This is a visual invariant, not an access rule. The hub shown in the rail does not itself prove that data, capability, recipients, or outbound URLs are scoped correctly. Continue to audit all four routing layers independently.

Inside `.hub-ws-content`, prefer the existing hub destination prefixes and shared container widths. Do not add page-local hardcoded widths/colors/shadows to repair one screen; update the shared hub grammar when the relationship is truly common. Focused canvas/editor pages may reduce the rail, but must preserve an explicit way back.

---

## Engineering rules in one paragraph

When you touch a hub: derive the hub from the resource (usually a program), pass it through every layer (capability, recipients, UI filter, URLs), use the canonical helpers (`getProgramHubSlug`, `getHubNotificationRecipients`, `hubScopedUrl`, etc.), never hardcode `"host-team"`, never bypass hub membership for ADMIN on content access, use `after()` for fire-and-forget emails from route handlers, await emails from non-route functions whose callers already await, and at closing audit all four layers across every callsite you touched.

---

*RIM Hub Engineering · September 2026 · Written during session 128 Slice 2.5 as the institutional response to the email-URL leak.*

## Team Home, 2026-10-13 (supersedes the September presentation below)

Jesse: "I would like to simplify this page… if there is a tool associated with the Team Hub, that should be highlighted… Let's get rid of the 'About this team', team schedule overview and team guidance… out of the system altogether… we should have an editable text underneath the hub name… This should be a standard across all of these teams."

Every team's Home is now, in order: the team's name; **its own line** (`Hub.description`, one sentence, at most 200 characters, edited in place by the team's leads, `effectiveCoordinator`, through `PATCH /api/hubs/[slug]/home`; empty shows "Your team's shared space."); **the team's tool** when it has a primary registered app (one bordered card: "This team's tool", the app's name, its one summary line, one button "Open the …"); personal attention ("N items need your attention", unchanged); then the destination list (Conversations, Files, Members, supporting apps, custom links).

Retired, from the code and the UI: the first-visit welcome screen (and `PATCH /api/hubs/[slug]/membership/visited`), "About this team" (welcome text and the custom-links block, whose links moved into the destination list), the Scheduler's month overview ("Team schedule overview"; the registry's `module` home mode is gone), pinned conversations on Home (pinned topics lead the Conversations list), and "Team guidance". The `welcomeHeadline`, `welcomeBody` and `homeContent` columns were dropped later on 2026-10-13 (`drop_team_home_text_v1`; each team's text was archived off-repo and given to Jesse for its leads, backlog 2026-10-13-006). `HubMember.firstVisitedAt` stays, unread except by the account merge.

The Scheduler's summary is a true count since 2026-10-16: the team's sessions in the next two weeks that need someone, from the Scheduler's own row builder (`countSessionsNeedingSomeone` in `lib/coverageNotices.ts`), or "Every session in the next two weeks has a greeter." A row count would have told a team it was covered when it wasn't (open sessions usually have no `HostAssignment` row). See `RIM_Scheduler.md`, "Coverage notices".

Words: "team", not "hub", wherever people read (rail type label "Team", "Team settings", page titles, admin "Teams", the two hard-coded team emails). Routes keep `/account/hub/…` and `?hub=`. Three teams renamed in production with Jesse's approval: Hosting Team, Course Team, Support.

## September 2026 home presentation (superseded 2026-10-13)

The universal Home now renders the core destinations and installed apps as one compact navigation list. The Scheduler overview is retained behind its named disclosure; it is not copied into a second dashboard or reimplemented. Welcome/orientation editing, pinned conversations, and personal attention remain reachable without filling the default Home. These are presentation changes only: the exhaustive app registry, feature switches, app compatibility, source meaning, four routing layers, and access helpers remain authoritative. Home app links continue to carry `?hub=`. The team rail returns to the member’s `/account/teams` directory.

## The Updates inbox (2026-10-19)

Jesse: *"I feel like the team updates section can be improved. It's uncategorized and incomplete. People should be able to read it like an inbox and by type. It should also go to the item specifically. … It should say when subs happen and claims etc."* His rulings that day: inbox read marks (reversing July's no-read-state rule); the rail's number counts only what is for you; acting in place ("Take this session") is in; and **who drops a session outright is shown to the team's leads and the person, never the whole team** (asking for a sub is not leaving: the team is being asked, so the asker is named to everyone).

**The record (`hub_events`, `lib/hubEvents.ts`).** Most Scheduler changes overwrite or delete their row, so Updates could not show them. Every Scheduler write now records one line, inside the change's own transaction: `session-taken`, `session-assigned`, `session-left`, `sessions-released` (pause, Inactive, archive, deletion, a clear, a program change), `rotation-set`, `rotation-ended`, `member-left`. Rules for new code:
- **Any new route that changes who is on a session, a rotation or a team records an event**, against the resource's own team (the assignment's or rotation's `hubSlug`), with `actorId` (null for the daily pass) and `subjectUserId`.
- **Leaving kinds are `LEADS_ONLY_EVENT_KINDS`.** Readers show them only when `hubLeadAllowed(roles, member)` or the viewer is the subject. Prisma's `{ not: x }` drops NULLs: when matching "not done by me", write `OR: [{ actorId: null }, { actorId: { not: me } }]`.
- A slug rename carries `hub_events` with the other slug-keyed tables (`app/api/admin/hubs/[slug]`).
- Cover requests, claims and gaps keep reading their own rows (`sub_requests`, `sub_claims`, `coverage_notices`); the record does not duplicate them.

**Read state.** `hub_update_reads` (one row per opened item key) plus `HubMember.activitySeenAt` (everything before it is read; null = `joinedAt`; set to the deploy moment for everyone once, flag `updates_inbox_start_read_v1`). Item ids are the read keys; a day's replies in one conversation are one item carrying every reply's key. Needs-you items are dated by their session, so "Mark all as read" also sends their keys. A viewer without a membership row has no read state.

**Needs you** is a provider method (`needs`) beside `updates` and `attention` in `lib/hubApps.ts`. The Scheduler's: sessions in the next two weeks that need someone (`sessionsNeedingSomeone`, the Scheduler's own row builder), minus the viewer's own cover request, with an action only when `canSelfClaim` is true; a lead who can't take sessions sees them with a link. The action posts to the Scheduler's existing routes with the session's `hubSlug`, so every gate, lock and email is the Scheduler's.

**Links go to the item.** `scheduleSessionHref` (`/tools/schedule?hub=…&month=…&session=program~YYYY-MM-DD`, which the Scheduler scrolls to, opening "Earlier this month" if needed, and marks), `#reply-<id>`, `#comment-<id>` (the comment id is in the file audit's detail), `#member-<userId>`; `components/hooks/useHashArrival.ts` brings a client-drawn target into view.

**Paging.** Each source fetches up to a page of rows; a page shows only what is newer than the newest of the oldest rows among the sources that filled up (`completeDownTo`, counted on raw rows before replies group and hidden files drop), and the next page starts at that moment, inclusive (`lte`), so a batch sharing one timestamp is never split or lost. An app's `updates` provider returns `{ items, boundary }` for this. Items that are one thing across two passes merge by id.

**Read rules.** Your own doings are never unread (each item, and each reply in a group, carries its `actorId`). A Needs-you key includes what opened it (the cover request, or the latest gap notice), so a session that reopens is news again. "Mark all as read" sends `asOf` (when the page loaded) and only moves the read point forward. A cover request that closed reads "Closed", not "Withdrawn": it also closes when its person is taken off, which isn't the team's news. An account merge carries `hub_update_reads`, `hub_events` and the later `activitySeenAt`.

**Cost.** The hub layout and `/api/hubs/[slug]/nav` compute the rail number on every hub page (`countHubUnreadForYou`: the For-you history query narrowed to after the read point, plus Needs you, which builds up to two Scheduler months, and only for someone who could take sessions or lead). Both are computed once per request (React `cache`), shared by the layout and the Updates page. It is wrapped so a failure shows no number rather than breaking the page.

## One filter grammar (2026-10-20)

Jesse: *"We already have a general navigation for these kinds of things, for example, in the calendar hub. I don't think we should have too many different configurations. That's confusing for people. Consistency is key."* Every list that filters uses `components/FilterBar.tsx`, drawn with the Scheduler's own classes: **`FilterPills`** (pills with counts: which items), **`ViewPicker`** (a labelled pill with a dropdown: which kind, which person, how sorted), **`SectionTabs`** (underline tabs for the parts of a page). The Scheduler, Updates (All · For you · Unread; View by type), Conversations (Active · Archived; View by category), a person's Notifications (All · Unread; From a team; View by type) and Files (Team files · Leads only tabs; All files · Favorites; Sort) use it. A new page uses these, never its own segment, chips or column of folders. Counts past 99 read "99+".

