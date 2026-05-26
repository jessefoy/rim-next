# RIM Scheduler — the per-tool reference

**Read this before writing or modifying any code on `/tools/schedule` or its supporting routes.**

This is the per-tool reference for the Scheduler. It catalogs what the tool does, what code implements it, what hub semantics apply, and the patterns to follow when extending it.

For broader hub rules see `RIM_Hub_Engineering.md`. For email rules see `RIM_Email_Engineering.md`. This doc is the operational ground truth for *this specific tool*.

---

## What it is

The Scheduler is the team tool for managing live session coverage. Every hub that hosts programs has its own scoped view of the Scheduler — host-team sees host-team programs, peer-led-silent-meditation sees peer-led-silent-meditation programs.

Two top-level tabs:
- **Schedule** — month-by-month view of upcoming sessions, claim/release affordances, sub-request UI, the "Your Rotations" panel summarizing the current user's standing assignments scoped to this hub.
- **Rotations** — coordinator-only editor for standing host assignments. Hub-scoped per record as of session 129; any hub's coordinator can manage rotations in their own hub.

The tool was originally named "Host Schedule" when host-team was the only hub. Renamed to "Scheduler" in Slice 2 to read correctly across multiple hubs.

**Two hub modes** (session 129):
- **Single-slot** (host-team, peer-led, audio-visual). One claimant per session per hub. Rows render the historical "Host: Maria" + claim/sub-request affordances.
- **Multi-claim** (greeter). `Hub.allowsMultipleAssignments = true`. Open sign-up — many people on one session, no sub-request flow, "I'll be there" / "Cancel my signup" actions. Rows render as a community of people with plain-language state header, stacked names, and self-recognition marks. See *Multi-claim rendering* below.

**Two format buckets** (session 129) — `Hub.appliesToFormats` drives which `programFormat` values surface:
- Host-team / peer-led: `["virtual","hybrid"]`
- Audio-visual / greeter: `["in-person","hybrid"]`

---

## Routes

| Path | What it does |
|---|---|
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

**Your Rotations panel (a layer-3 detail).** Hub-scoped via the new `StandingAssignment.hubSlug` column — the query is now `where: { userId, hubSlug: activeHubSlug }` directly, no in-memory filtering needed (replaces the Slice 2 in-memory filter).

---

## The grandfather policy on hub changes

When a coordinator transfers a program to a different hub via the ProgramEditor "Hosting & Access" tab, existing future HostAssignments stay valid in the old hub for the dates they were created for. New self-claims and sub-requests route to the new hub.

The ProgramEditor surfaces a mid-flight warning before save — count of affected upcoming HostAssignments + explanation of the grandfather policy.

Operational consequence: if a host-team member has claimed Good Morning Silent Meditation sessions before a coordinator transfers it to peer-led-silent-meditation, those host-team-claimed sessions remain on the host-team member's `/tools/schedule?hub=host-team` view. New claims will only come from peer-led members. The mixed-hub state resolves as the grandfathered sessions complete.

---

## Multi-claim rendering (greeter hub, session 129)

When `Hub.allowsMultipleAssignments` is true, the Schedule page renders one card per session that contains every signed-up volunteer rather than one card per claim. The row uses a **plain-language state header sentence** plus a **stacked list of names** with a **self-recognition mark** ("YOU" badge in `--rim-blue`) on the signed-in user's row. This is correctness-level UI, not polish — see `feedback-clear-seeing-is-correctness.md` for why the comma-separated CSV version was rejected.

State header sentences:
- `count === 0` (not past): "No one yet — be the first?"
- `count === 0` (past): "No one signed up"
- `count === 1 && mine`: "You're signed up"
- `count === 1 && !mine`: "1 person signed up"
- `count > 1 && mine`: "<count> signed up · you're one of them"
- `count > 1 && !mine`: "<count> signed up"

Action button labels read as invitation, not transaction:
- Not signed up, no one else: "I'll be the first"
- Not signed up, others present: "I'll be there too"
- Signed up: "Cancel my signup"

No sub-request flow in multi-claim hubs — the open sign-up model doesn't have a "need a sub" semantic; the only exit is self-cancel. `/api/host/sub-requests` POST refuses on multi-claim hubs with a 400.

CSS lives in `public/css/custom.css` under `.hs-row__multi*`. The card itself is the standard `.hs-row` chrome; only the right-hand block (status + action) differs.

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

Session 130 closed this with two layers of discoverability:

- **`sendStandingAssignmentScheduledEmail`** now takes `firstSessionMonth?: string` (the YYYY-MM of the earliest scheduled session) and deep-links the CTA URL to `/tools/schedule?month=<that>&hub=<slug>`. Computed at the apply / standing-assignments POST / cron call sites from the apply result's `sessions[].dateStr`. The schedule page reads `?month=` permissively (bad input falls back to current month).
- **The Your Rotations panel's "Next" block** is a clickable `<button>` that jumps the calendar to the target month via `jumpToMonth(year, month)` in `HubScheduleClient`. Use `Intl.DateTimeFormat(..., { timeZone: TZ }).formatToParts()` to extract year/month from the next-session ISO — locale-string parsing through `new Date()` is not in the ECMA spec and is unreliable on Safari.

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

**Emails carry hubSlug.** `sendStandingAssignmentScheduledEmail`, `sendStandingAssignmentReplacedEmail`, `sendStandingAssignmentReleasedEmail`, and `sendStandingAssignmentEndedEmail` all accept an optional `hubSlug` and build the "view schedule" link via `hubScopedUrl`. The apply route groups byUser sessions by `hubSlug` so a user with rotations in two hubs gets one email per hub, each linking to the right Scheduler view. `sendStandingAssignmentScheduledEmail` (session 130) also accepts `firstSessionMonth?: string` and deep-links the CTA URL to that month.

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

## PDF export

`/api/host/schedule/pdf` uses `@react-pdf/renderer` (no headless Chromium). Renders a per-user schedule for a date range. Currently hub-agnostic — exports all of the requesting user's HostAssignments regardless of hub. Likely fine since "my schedule" is a personal export, but worth hub-scoping if/when peer-led members request it.

---

## Common pitfalls

**The schedule URL without `?hub=` defaults to host-team.** Always include the hub when generating links — internally (sidebar app-link auto-append), externally (email URLs via `hubScopedUrl`).

**Standing rotations leaking across hubs in the "Your Rotations" panel.** Fixed in Slice 2 by the in-memory filter, but if you change the data flow (e.g. add a second query that pulls rotations), apply the same filter or replicate the program-slug `IN (...)` constraint.

**The cover URL deep link.** The full URL pattern is `/tools/schedule?action=cover&id=<id>&hub=<slug>` (Slice 2.5 added the hub param). The schedule page reads `action` and `id` from the query string and opens the cover modal. Don't break that handshake — if you change the URL shape, update both the email and the page.

**Pause-state and hosting-capability are coordinator-owned.** Don't write to `HubMember.status`, `hostingCapability`, `communicationsEnabled`, `pausedAt`, `pausedById`, `pauseNote` from any route other than `/api/hub/[slug]/members/[userId]` PATCH. These fields are gated to coordinators-of-this-hub specifically.

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
- `/api/host/assignments/[id]` DELETE (session 130 follow-up)
- `/api/host/assignments/reassign` (session 130 follow-up — the `previousUserId` cleanup path)
- `/api/programs-pg/[slug]` PUT, hub-change branch (session 130 follow-up — atomic with the program.update)
- `heal_orphan_standing_assignments_v1` migration (session 130 — same pattern at data-heal layer)

**PATCH unclaim on `/api/host/assignments/[id]` keeps the cancel-OPEN behavior** because it only sets `userId = null` (no parent delete). No FK violation possible. Other routes that update HostAssignment but don't delete it can also keep the cancel pattern.

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

## What's deferred

| Item | Status | Why |
|---|---|---|
| PDF export hub-scoping | Deferred | "My schedule" is personal; revisit if AV/greeter members ask |
| Time-gate adjustments per-program | Deferred (parked) | The 22/30-min window is currently uniform across all programs; if dharma retreats want a longer pre-open, add per-program override |
| Sub-request flow on AV (in-person) | Edge case to verify | Sub-requests still work in single-slot AV; verify on live deploy that the in-person hub's coordinator notifications behave correctly |
| Manual chapter for AV + greeter hubs | Open follow-on | Write a hub-specific manual chapter explaining the AV / greeter flow, the difference between single-slot and multi-claim, sub-request semantics. Can be done via `/admin/manual/<slug>/edit` once the hubs are configured. |
| Hub-aware new-program notifications | Open | When a coordinator creates a hybrid program AND ticks AV/greeter auxiliary coverage, only the primary hub gets the "new program needs a host" email. The auxiliary teams don't yet. Worth a separate slice when the need is real. |

---

## When adding a new tab or affordance to the Scheduler

1. Decide whether the new feature is hub-scoped or hub-agnostic. If unclear, default to hub-scoped.
2. Apply the four routing layers (see `RIM_Hub_Engineering.md`).
3. If it sends email, follow `RIM_Email_Engineering.md`.
4. Update this doc with the new feature's hub-scoping story.
5. At closing ritual, audit every callsite (the addition CLAUDE.md requires for hub slices).

---

*RIM Scheduler · September 2026 · Per-tool reference written during session 128 Slice 2.5.*
