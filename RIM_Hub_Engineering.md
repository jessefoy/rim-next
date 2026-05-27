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
| **Capability** | Can this user perform this action in this hub? | `lib/livekitAuth.ts::resolveSessionRole`, `lib/hubMemberAuth.ts::getEffectiveHostingCapability` | API route handlers gate by `program.hostingHubSlug` |
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
| `getProgramHostingHub(programSlug)` | `lib/programHub.ts` | Returns `{ slug, assignmentGrantsTeacher, teacherLabel }`. Use when you also need the hub's teacher-capability config. |
| `resolveTeacherPillLabel(programLabel, hubLabel)` | `lib/programHub.ts` | Pill hierarchy: `program.teacherLabel ?? hub.teacherLabel ?? "Teacher"`. |
| `DEFAULT_HOSTING_HUB_SLUG` | `lib/programHub.ts` | The constant `"host-team"`. Use this everywhere you need the default — never inline the string. |
| `getEffectiveHostingCapability(userId, hubSlug, fallback)` | `lib/hubMemberAuth.ts` | "Is this user an active hosting-capable member of this hub?" Pass `program.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG`. |
| `getHubNotificationRecipients(hubSlug, opts)` | `lib/toolAuth.ts` | Active members of a hub with `communicationsEnabled`. Use for notification recipient pools. |
| `getHubMembership(slug, userId, roles)` | `lib/hubAuth.ts` | Returns `{ hub, member, isAdmin }`. Access gate is `!member` only — ADMIN no longer bypasses content access (see *ADMIN policy* below). |
| `effectiveCoordinator(member, roles)` | `lib/hubAuth.ts` | "Is this user acting as coordinator on this hub?" True for the coordinator flag, ADMIN, or GUIDING_TEACHER. Use everywhere you would have written `(member?.isCoordinator ?? false) || isAdmin`. |
| `hubScopedUrl(path, hubSlug)` | `lib/email.ts` | Append `?hub=<slug>` to a `/tools/*` URL when the slug isn't the host-team default. Use for every email link to a hub-scoped tool view. |
| `hubHomeUrl(hubSlug)` | `lib/email.ts` | Build `/account/hub/<slug>` (the hub's own workspace URL). |
| `emailButtonHtml(label, url)` | `lib/email.ts` | Canonical CTA button HTML for emails. See `RIM_Email_Engineering.md`. |

When you find yourself reaching for a fresh `${BASE_URL}/tools/schedule` or hardcoding `"host-team"`, stop. There's a helper.

---

## The ADMIN policy

**ADMIN no longer bypasses hub content access** (session 128 follow-up).

A hub is a team space. The team is defined by membership. ADMIN configures hubs from `/admin/hubs` (still ADMIN-gated) but to interact with hub content — read or post conversations, view documents, claim sessions — an ADMIN must be a HubMember just like everyone else. This matches GUIDING_TEACHER's existing behavior.

What's still ADMIN-only:
- `/admin/hubs/*` configuration (hub create, edit, delete)
- Hard-remove member at `/api/hub/[slug]/members/[userId]` DELETE
- The `/admin/hubs/[slug]/add-me-as-coordinator` endpoint (bootstrap path for an admin who needs to enter a hub someone else created — see auto-coordinator note below)
- Anywhere `effectiveCoordinator` or `requireCoordinator` is consulted — those still ADMIN/GT-bypass because they're coordinator-level authority, not access

The mental model: **ADMIN configures hubs from outside; ADMIN participates from inside (as a member).**

**Auto-coordinator on hub creation (session 131).** `POST /api/admin/hubs` writes a `HubMember` row for the calling admin atomically alongside the hub itself, via Prisma nested `members.create`. Values mirror `/api/admin/hubs/[slug]/add-me-as-coordinator` exactly (`isCoordinator: true`, `status: ACTIVE`, `hostingCapability: true`, `communicationsEnabled: true`, `position: "Coordinator"`). The standard creator flow no longer requires the post-create "Add me as coordinator" click. The safety-net endpoint stays for the case where an admin needs to bootstrap into a hub someone else created. **Implication for new code:** when a hub exists, its creating admin is *always* a coordinator-member. Don't write defensive code that assumes "the creator might not be a member."

---

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
| `hasSchedule` | Hub Home view (HostHubHomeClient vs generic) + Hosting team dropdown eligibility |
| `allowsMultipleAssignments` | Single-slot vs open-signup Schedule UX |
| `appliesToFormats` | Which programs surface (virtual/hybrid vs in-person/hybrid) |
| `assignmentGrantsTeacher` + `teacherLabel` | Session-room pill semantics |
| `coverageNoun` + `coverageVerb` + `coverageAction` | User-facing UI + email copy |
| `ProgramCoverageHub` (join table) | Primary + auxiliary program coverage |

When adding a new hub-aware behavior, the first question is: **is this a code branch per slug, or a new hub-config field?** Default to the config field. New hubs become configuration on top of the architecture, not new code. A code branch per slug is a hint that a missing config field hasn't been articulated yet.

## Audit at the user-flow layer, not just the code-correctness layer (session 130)

The code-correctness audit above is necessary but not sufficient. Session 129's five-phase audit verified hub-scoping correctness across every routing layer and ran clean. The next slice (session 130, Maria's beta test) immediately surfaced four real bugs in the *user flow*:

- Sub-request affordance technically present but undiscoverable because the email link landed on the wrong month.
- "Release their dates" route silently undone by the next cron run because the rotation rule wasn't deleted.
- Destructive-action toasts didn't name what was deleted, so a coordinator couldn't verify their intent.
- An email body claimed an action that didn't match what the route did.

None of these would fail a routing-layer audit. They're all gaps at the user-flow layer: what happens when a real person follows the actual path the UI offers?

**Add to the closing ritual when a slice touches a tool with a human-facing flow:** walk the user's flow as the actual user, end to end. Click the affordance the system tells them to click. Read the email the system sends. Reach the destination the link lands on. Verify the success toast tells the truth. If any of those layers lies to the user — even when the code is "correct" — that's a real bug in scope for this slice, not a polish item for later.

---

## Grandfather policy on `Program.hostingHubSlug` changes

When a coordinator transfers a program to a different hub via the ProgramEditor "Hosting & Access" tab, **existing future HostAssignments stay** — they don't migrate. New self-claims route to the new hub.

The editor surfaces a mid-flight warning before the save commits, showing the count of affected upcoming HostAssignments. The warning is enforced server-side by counting future rows with `userId: { not: null }` on the program. Same pattern applies if you build other mid-flight migration affordances.

---

## Two hub signals — `hasSchedule` vs `usesScheduler`

These are distinct concerns. Conflating them in session 129's first ship caused two visible bugs (AV/greeter hubs rendering the host-team Home view; peer-led-silent-meditation disappearing from the Hosting team dropdown after a tightening fix).

| Signal | Storage | Means | Drives |
|---|---|---|---|
| `Hub.hasSchedule` | column on Hub (boolean) | "this hub runs live sessions" — it owns the LiveKit room, holds dharma authority | Home view (`HostHubHomeClient` vs generic), ProgramEditor's Hosting team dropdown eligibility |
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
2. Gate by `isHubCoordinator(userId, hubSlug)` plus ADMIN bypass.
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

## Engineering rules in one paragraph

When you touch a hub: derive the hub from the resource (usually a program), pass it through every layer (capability, recipients, UI filter, URLs), use the canonical helpers (`getProgramHubSlug`, `getHubNotificationRecipients`, `hubScopedUrl`, etc.), never hardcode `"host-team"`, never bypass hub membership for ADMIN on content access, use `after()` for fire-and-forget emails from route handlers, await emails from non-route functions whose callers already await, and at closing audit all four layers across every callsite you touched.

---

*RIM Hub Engineering · September 2026 · Written during session 128 Slice 2.5 as the institutional response to the email-URL leak.*
