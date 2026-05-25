# RIM Scheduler — the per-tool reference

**Read this before writing or modifying any code on `/tools/schedule` or its supporting routes.**

This is the per-tool reference for the Scheduler. It catalogs what the tool does, what code implements it, what hub semantics apply, and the patterns to follow when extending it.

For broader hub rules see `RIM_Hub_Engineering.md`. For email rules see `RIM_Email_Engineering.md`. This doc is the operational ground truth for *this specific tool*.

---

## What it is

The Scheduler is the team tool for managing live session coverage. Every hub that hosts programs has its own scoped view of the Scheduler — host-team sees host-team programs, peer-led-silent-meditation sees peer-led-silent-meditation programs.

Two top-level tabs:
- **Schedule** — month-by-month view of upcoming sessions, claim/release affordances, sub-request UI, the "Your Rotations" panel summarizing the current user's standing assignments scoped to this hub.
- **Rotations** — coordinator-only editor for standing host assignments (recurring rotation patterns). Currently host-team-only at the route level; will generalize to other hubs when those hubs need rotations.

The tool was originally named "Host Schedule" when host-team was the only hub. Renamed to "Scheduler" in Slice 2 to read correctly across multiple hubs.

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
| `app/api/host/programs/[slug]/clear-rotations/route.ts` | Coordinator: clear all rotations on a program. |
| `app/api/host/schedule/pdf/route.ts` | PDF export of "my schedule" — uses `@react-pdf/renderer`. |

---

## Hub-scoping — every layer

Per `RIM_Hub_Engineering.md`'s "four routing layers" model:

**Capability gates (layer 1).** Self-claim, sub-claim, and sub-request creation all route by the program's hub via `getProgramHubSlug(programSlug)` and `getEffectiveHostingCapability(userId, hubSlug, fallback)`. A peer-leader of `peer-led-silent-meditation` can claim sessions on peer-led programs; they cannot claim sessions on host-team programs (and vice versa). ADMIN bypasses.

**Notification recipients (layer 2).** Sub-request notifications route to `getHubNotificationRecipients(programHubSlug, …)` — active members of the program's hub with `communicationsEnabled`. Slice 1 changed this from hardcoded `"host-team"` to per-program.

**UI filter (layer 3).** The Schedule page filters programs in its main Prisma query:
```ts
const programHubFilter =
  activeHubSlug === DEFAULT_HOSTING_HUB_SLUG
    ? { OR: [{ hostingHubSlug: null }, { hostingHubSlug: DEFAULT_HOSTING_HUB_SLUG }] }
    : { hostingHubSlug: activeHubSlug };
```
Host-team scope uses `OR` to catch both null (legacy programs that pre-date `hostingHubSlug`) and the explicit slug. Other hubs filter by exact match.

**Outbound URLs (layer 4).** Every email sent from a Scheduler action constructs URLs via `hubScopedUrl(path, programHubSlug)`. Slice 2.5 fix. See `RIM_Email_Engineering.md` for the full pattern.

**Your Rotations panel (a layer-3 detail).** The user's standing assignments are fetched globally (`db.standingAssignment.findMany({ where: { userId } })`) then **filtered in memory** by the active hub's program list (`pgPrograms.map(p => p.slug)`). The in-memory filter avoids sequencing the queries and is cheap because a user's rotation count is tiny.

---

## The grandfather policy on hub changes

When a coordinator transfers a program to a different hub via the ProgramEditor "Hosting & Access" tab, existing future HostAssignments stay valid in the old hub for the dates they were created for. New self-claims and sub-requests route to the new hub.

The ProgramEditor surfaces a mid-flight warning before save — count of affected upcoming HostAssignments + explanation of the grandfather policy.

Operational consequence: if a host-team member has claimed Good Morning Silent Meditation sessions before a coordinator transfers it to peer-led-silent-meditation, those host-team-claimed sessions remain on the host-team member's `/tools/schedule?hub=host-team` view. New claims will only come from peer-led members. The mixed-hub state resolves as the grandfathered sessions complete.

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

## Standing rotations (currently host-team-only)

Standing rotations are recurring patterns: "Maria hosts every 2nd and 4th Thursday." They're stored as `StandingAssignment` rows keyed `(programSlug, dayOfWeek, occurrence)`. A cron job (`/api/cron/apply-standing-assignments`) walks forward, creating `HostAssignment` rows from each rotation.

**Hub-scope status:** as of Slice 1, the standing-rotation routes still gate by hardcoded `"host-team"`. The Rotations tab is gated by `isManager` (HOST_MANAGER, ADMIN, or host-team coordinator) at the page level. Peer-led-silent-meditation doesn't yet expose rotations.

**When you need to generalize:**
- `/api/host/standing-assignments` and its sub-routes — broaden the gate the same way Slice 1 did for the per-session routes (route by `program.hostingHubSlug`).
- `lib/applyStandingAssignments.ts` — no changes needed; it operates on whatever rotations exist.
- `RotationsClient.tsx` — already accepts a program filter; just needs to filter by hub's programs the way the Schedule tab does.
- `sendStandingAssignmentScheduledEmail` and `sendStandingAssignmentReplacedEmail` — currently hub-agnostic with a comment. When peer-led hubs gain rotations, group sessions by hub and send one email per hub, scoping each link with `hubScopedUrl`.

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

## What's deferred

| Item | Status | Why |
|---|---|---|
| Standing-rotation routes hub-routing | Deferred (Slice 3) | Peer-led-silent-meditation doesn't expose Rotations yet — generalizing now would be dead code |
| Assignments-GET pause-map hub-routing | Deferred (Slice 3) | Same — the map only matters for the Rotations tab |
| PDF export hub-scoping | Deferred | "My schedule" is personal; revisit if peer-led members ask |
| Time-gate adjustments per-program | Deferred (parked) | The 22/30-min window is currently uniform across all programs; if dharma retreats want a longer pre-open, add per-program override |
| Hub-mixed standing-rotation emails | Deferred (Slice 3) | When standing rotations exist on multiple hubs, group + one email per hub instead of one email with mixed-hub schedule |

---

## When adding a new tab or affordance to the Scheduler

1. Decide whether the new feature is hub-scoped or hub-agnostic. If unclear, default to hub-scoped.
2. Apply the four routing layers (see `RIM_Hub_Engineering.md`).
3. If it sends email, follow `RIM_Email_Engineering.md`.
4. Update this doc with the new feature's hub-scoping story.
5. At closing ritual, audit every callsite (the addition CLAUDE.md requires for hub slices).

---

*RIM Scheduler · September 2026 · Per-tool reference written during session 128 Slice 2.5.*
