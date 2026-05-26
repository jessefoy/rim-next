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

1. They open the session in `/tools/schedule?hub=<their-hub>`, click "Request a sub" on their assignment.
2. The POST to `/api/host/sub-requests` creates the `SubRequest` row, then notifies other active members of the program's hub via `sendSubRequestEmail`.
3. The email contains:
   - Context: who's requesting, what program, what date, the requester's optional note
   - `{{coverUrl}}` — a deep link that opens `/tools/schedule?action=cover&id=<id>&hub=<slug>` with the cover modal pre-opened
   - `{{coverButton}}` — the canonical CTA button (since Slice 2.5)
4. Another member clicks "Fill in" / the button → lands at `/tools/schedule?action=cover&id=<id>&hub=<slug>` → cover modal → POST to `/api/host/sub-requests/[id]/claim`.
5. The claim writes the new userId to the HostAssignment + closes the SubRequest. Two emails go out: a `sub-request-claimed` to the original host ("your session is covered"), and a `host-assignment-confirmation` to the new host.

All three emails carry `hubSlug` derived from `program.hostingHubSlug` so every link lands the recipient in the correct hub view. Slice 2.5 fix.

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

**Emails carry hubSlug.** `sendStandingAssignmentScheduledEmail`, `sendStandingAssignmentReplacedEmail`, and `sendStandingAssignmentReleasedEmail` all accept an optional `hubSlug` and build the "view schedule" link via `hubScopedUrl`. The apply route groups byUser sessions by `hubSlug` so a user with rotations in two hubs gets one email per hub, each linking to the right Scheduler view.

**`RotationsClient.tsx`** receives `hubSlug` as a prop and passes `?hub=<active>` to its rotation-list fetch. Each hub's Rotations tab loads only that hub's rotations.

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
