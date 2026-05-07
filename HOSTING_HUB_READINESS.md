# Hosting Hub Readiness Inventory

**Purpose.** Decision-ready assessment of the entire host workflow system ahead of the May training session and June 17 Zoom renewal deadline. Produced in session 103 (2026-05-07) after reading all reference documents and walking the code.

**Deadline context.** Zoom renews June 17, 2026. LiveKit is already the technical foundation. The gap before that deadline is operational readiness: a coordinator who knows the system, hosts who can use it, and documentation that doesn't require Jesse to explain every step.

**Training target.** Mid-to-late May. New host coordinator Maria (no legacy knowledge). Approximately 5–6 active hosts.

---

## Status Labels

| Label | Meaning |
|---|---|
| **Ready** | Works correctly, no action needed before May training |
| **Functional — needs polish** | Works; rough edge worth fixing before training |
| **Functional — needs documentation** | Works correctly; manual or help text missing or stale |
| **Functional — needs content** | Works; coordinator needs to write content before training |
| **Gap: build needed** | Feature documented in role design or referenced in UI, not yet built |
| **Design-intent gap** | Role design documents it; was built, then removed; no replacement exists |

## Training Prioritization Tags

| Tag | Meaning |
|---|---|
| **blocks training** | Must resolve before mid-May; training fails or misleads without it |
| **build before training** | Meaningful improvement; not a strict blocker but worth doing |
| **acceptable to defer** | Gap acknowledged; training succeeds anyway; note it in documentation |
| **post-cutover** | Not relevant to May; schedule for after the Zoom deadline |

---

## Category 1 — Host Hub Home

**Component:** `components/HostHubHomeClient.tsx` (custom — host-team uses this, not the generic `HubHomeClient`)

**Route:** `/account/hub/host-team`

### What's there

**"Our offerings this month" panel** — Ready. On load, computes every virtual/hybrid session for the current calendar month, rolls up team coverage: total sessions, open sessions needing a host, which members are hosting (with session count), which members are available (assigned nothing this month). A functional at-a-glance for coordinators before they open the schedule tool. No interaction needed — it's a read-only digest.

**Welcome body** — Functional — needs content. The coordinator-editable `welcomeBody` section is live. Coordinators see a pencil icon; non-coordinators see the rendered HTML. If `welcomeBody` is empty, the section reads: *"No welcome content yet. Add one."* — the "Add one" link is visible only to coordinators. This is the mechanism for welcoming new hosts. It is not an interstitial.

**Help icon** — Ready. A quiet "?" in the header links to `/admin/manual/host-hub` — the orientation chapter. That chapter exists and is well-written for hosts.

### Coordinator onboarding thread

When ADMIN assigns Maria the `HOST_MANAGER` role and marks her `isCoordinator: true` on her HubMember record, here is exactly what she experiences:

1. **Coordinator welcome email fires.** `sendHostManagerRoleAssignmentEmail` triggers when the `HOST_MANAGER` role is newly added. Maria receives an email linking to the hub, the schedule tool, and the manual, with a note that coordinator-specific chapters are coming soon. Built session 104.

2. **No newcomer interstitial.** The `firstVisitedAt`-based interstitial that fires for other hubs on first visit is NOT used for the host-team hub. The `HostHubHomeClient` renders the same view for everyone. There is no pop-up.

3. **First visit.** Maria lands on the hub home. She sees: the header "Welcome / Host Team" with the "?" help icon, the "Welcome" section with "No welcome content yet. Add one." (she can see this CTA as coordinator), and the "Our offerings this month" panel.

4. **Her first coordinator task.** Writing the welcome body. This is not a bug — it is the intended flow. But it means she arrives to a blank page with no system-driven guidance about what to do first.

**Assessment:** The welcome body as content is Maria's first coordinator task. The coordinator welcome email (now built) tells her she has access and points her to the hub and manual. What it doesn't tell her is specifically that writing the welcome body is her first task — that still needs to be covered in training or an out-of-band note from Jesse.

| Item | Status | Priority |
|---|---|---|
| "Our offerings this month" panel | Ready | — |
| Welcome body (mechanism) | Ready | — |
| Welcome body (content) | Functional — needs content | **blocks training** |
| Coordinator role assignment email | Ready (built session 104) | — |
| Newcomer interstitial | Not applicable to host-team | — |

---

## Category 2 — Schedule Tool

**Component:** `components/HubScheduleClient.tsx`

**Route:** `/tools/schedule`

**API base:** `/api/host`

### What's there

**Monthly agenda view** — Ready. Sessions grouped by week ("This week", "Next week", "Week of…"). Past sessions collapsed into "Earlier this month" with a `<details>` toggle. Month navigation with ← / → arrows and "This month" jump.

**Filter pills** — Ready. Four filters: All (count of upcoming sessions), Needs help (unclaimed + sub-needed, excluding self), Mine (defaults to current user; member picker lets coordinators switch to any team member), My requests (cover requests the current user has open). Counts update from the session list client-side — no re-fetch for filter changes.

**Session cards** — Ready. Each card shows: date/time, program name, format label (Virtual / In-person / Hybrid), hosting status color-coded with label, and exactly one action button (if applicable):
- Unclaimed → "Yes, I can host this" (take modal)
- Sub needed → "Yes, I can cover" (cover modal)
- Mine, no sub request → "Ask the team to cover" (ask-cover modal with optional message)
- Mine, sub request open → "Cancel my request"
- Covered by someone else → no button; manager sees "Reassign to me"

**Confirmation modals** — Ready. All five modal types show program, date, time before committing. The ask-cover modal includes an optional RimTiptapEditor message field.

**Deep links** — Ready. Email action buttons link to the schedule with `?action=take|cover|cancel&id=…`, which auto-opens the correct modal on page load. Covers the case where a host clicks "Cover this session" from an email notification.

**Standing rotations view** — Ready. HOST_MANAGER and ADMIN see a "Rotations" tab in addition to "Schedule". The RotationsClient (`components/RotationsClient.tsx`) manages standing rules: which host covers which occurrence of which program (1st, 2nd, last, every). Rotations auto-generate HostAssignment records daily via cron.

**My rotations summary** — Ready. Any user on a standing rotation sees a strip above the month nav listing their rotations and occurrences. Visible regardless of role — a host sees their own, not others'.

**NEW badge** — Ready. Programs created within the last 14 days show a NEW badge on their session cards. Disappears automatically — no manual dismissal.

**"Via rotation" marker** — Ready. Sessions that originated from a standing rule show a small "via rotation" badge on the program name. Distinguishes auto-scheduled from manually-claimed sessions.

**Member picker** — Ready. A dropdown inside the "Mine" filter pill lets coordinators switch the view to any team member's sessions. Useful for coordinators checking coverage or planning.

**Help icon** — Ready. A "?" at the end of the filter row links to `/admin/manual/host-schedule`. That chapter is comprehensive and current.

### Gaps

**Coordinator-specific schedule guidance** — Functional — needs documentation. The schedule manual chapter covers the host perspective (4 actions, filters, confirmations) well. There is no section explaining the coordinator-specific affordances: the member picker, the Rotations tab, how reassign-to-me works, or how to use the tool to check a paused member's assignments.

| Item | Status | Priority |
|---|---|---|
| Monthly agenda, filters, modals | Ready | — |
| Deep links from email | Ready | — |
| Standing rotations management | Ready | — |
| NEW badge, "via rotation" markers | Ready | — |
| Member picker (coordinator view) | Ready | — |
| Host-side manual chapter | Ready | — |
| Paused host visual indicator | Ready (built session 104) | — |
| Coordinator schedule manual additions | Functional — needs documentation | **build before training** |

---

## Category 3 — Session Room

**Entry page:** `app/session/[slug]/page.tsx`

**API routes:** `/api/livekit/token`, `/api/livekit/guest-token`, `/api/livekit/step-in`, `/api/livekit/mute-all`, `/api/livekit/mute-participant`, `/api/livekit/end-session`

### What's there

**Member join flow** — Ready. From the dashboard, a member clicks "Join" → `/session/[slug]` → POST `/api/livekit/token` → token returned → `VideoRoom` / `RIMConference` renders full-page. Auth redirect to `/login` if not logged in. No downloads, no Google account, no Zoom account.

**Host permission chain** — Ready. Token API determines `isHost` in this order:
1. ADMIN → always host
2. HostAssignment exists for this user + program (+ optional sessionDate) → host
3. HOST_MANAGER role → host
4. ProgramTeacher for this program → host
5. All of the above are then gated by `getEffectiveHostingCapability()` from `lib/hubMemberAuth.ts`: if a HubMember record exists, `status === "ACTIVE" && hostingCapability` must be true. ADMIN bypasses this gate.

**Host controls** — Ready. When `isHost`, the session header shows: "Mute All" (mutes every non-host participant via LiveKit server SDK), "End for All" (confirm prompt, then ends the room), plus per-participant mute inside the RIMConference tile panel. Non-host host-team members see "Step in as Host" (see below).

**Step-in** — Ready. If `isHostTeam` is true but `isHost` is false (e.g. a host joins their own session but it's actually assigned to someone else, or a coordinator is checking in), the header shows "Step in as Host." POST `/api/livekit/step-in` → new token with admin privileges → client cycles state and reconnects with full host controls. Useful for coordinator oversight without pre-assignment.

**Guest access** — Ready. Open-access programs set `guestAccessKey` on the program record. Members share the link `/session/[slug]?key=xxx`. Guests see a name-entry form → POST `/api/livekit/guest-token` validates the key → guest joins with participant privileges only.

**Nonverbal signals, chat, presence photos, audio prompt** — Ready. Full RIMConference experience as built in session 86. Raised-hand banner, emoji signals (✋❤️🙏✓✗), chat sidebar, presence avatars, dark header, audio playback prompt for Safari.

### Gaps

**Live attendance view during session** — Design-intent gap. `RIM_Role_Design.md` describes a live view that populates as members click the Join link: first-timer flag, returning-after-absence flag, one-tap flag for follow-up. This was built and then removed in session 89. Nothing replaced it. During training, a host has no in-session tool for pastoral tracking. Manual note-taking is the current answer.

**One-tap flagging** — Design-intent gap. Removed with the live view. No replacement.

**Post-session form** — Design-intent gap. `RIM_Role_Design.md` describes a form the host fills immediately after the session: flagged people with routing (gentle follow-up / Jesse only / technical issue / no action) + session reflection + session resource. The email scaffolding for this routing was removed in session 76 (`email.ts:807`). Nothing replaced it. Post-session reflection and pastoral follow-up are untracked.

**Automated attendee emails** — Design-intent gap. First-time attendee welcome and returning-after-absence were designed (RIM_Role_Design.md) and noted as "starting in disabled state." The infrastructure was removed in session 76. No attendance records exist that would trigger them.

**No session room manual chapter** — Functional — needs documentation. The `host-hub` chapter mentions "Schedule (under Tools)" but does not cover the actual session room: how to navigate to `/session/[slug]`, what the controls do, how step-in works, what to do if the audio prompt appears. A host encountering the session room for the first time during a live session has no in-context help.

| Item | Status | Priority |
|---|---|---|
| Member join flow | Ready | — |
| Host controls (Mute All, End, per-participant) | Ready | — |
| Step-in as Host | Ready | — |
| Guest access | Ready | — |
| RIMConference (chat, signals, avatars) | Ready | — |
| Live attendance view | Design-intent gap | **acceptable to defer** |
| One-tap flagging | Design-intent gap | **acceptable to defer** |
| Post-session form | Design-intent gap | **acceptable to defer** |
| Automated attendee emails | Design-intent gap | **acceptable to defer** |
| Session room manual chapter | Functional — needs documentation | **blocks training** |

---

## Category 4 — Notifications & Email

**Primary file:** `lib/email.ts`

### What fires automatically

**Sub-request posted** — Ready. When a host asks the team to cover their session, `sendSubRequestEmail` sends to all active, `communicationsEnabled` host-team members. Email includes program name, date, the host's optional message, and a deep-link button that opens the schedule with the cover modal pre-opened.

**Sub claimed** — Ready. When someone claims the sub, `sendSubClaimedEmail` fires to the original requester. Confirms who stepped in and closes the loop.

**New program created (virtual/hybrid)** — Ready. When a virtual or hybrid program is created in the Program Manager, `sendTemplatedEmail("new-program-needs-host")` fires to the team. Template managed via the Email Template Manager.

**Standing assignment scheduled** — Ready. When `apply-standing-assignments` runs (cron or manual apply), `sendStandingAssignmentScheduledEmail` sends a per-host digest listing every session they've been auto-assigned. One email per host, not one per session.

**Standing assignment displaced** — Ready. When a coordinator edits a rotation and displaces a host from one or more future sessions, the displaced host receives a soft notification listing the sessions. Tone is informational: "your coordinator updated the rotation."

**Rotation ended with release** — Ready. When a coordinator ends a standing rotation and releases future assignments, the host receives a notification listing the cleared sessions with a soft close ("thank you for the time you've contributed").

**HOST role assigned** — Ready (with stale copy). `sendHostRoleAssignmentEmail` fires when the `HOST` role is newly added to a member's record. Template "host-role-assigned" links to the hub and the manual. The function comment reads "to new Meet host" — stale from the Google Meet era. The actual template copy is managed in the Email Template Manager and may or may not reference Meet; worth verifying before training.

### Gaps

**First-time attendee welcome email** — Design-intent gap. Designed in `RIM_Role_Design.md`, never operationalized. The role design notes it should start in disabled state. The infrastructure (the triggering mechanism) was removed in session 76. The copy has never been written.

**Returning-after-absence email** — Design-intent gap. Same as above. Never built to the triggering stage.

**Post-session routing emails** — Design-intent gap. Role design describes routing flagged session notes to Jesse, the host coordinator, or the registrar depending on flag type. The email functions were removed in session 76. Nothing replaced them.

| Item | Status | Priority |
|---|---|---|
| Sub-request posted email | Ready | — |
| Sub claimed email | Ready | — |
| New program email | Ready | — |
| Standing assignment emails (assigned / displaced / ended) | Ready | — |
| HOST role assignment email | Ready (stale comment) | verify copy before training |
| HOST_MANAGER role assignment email | Ready (built session 104) | — |
| First-time attendee welcome | Design-intent gap | **post-cutover** |
| Returning-after-absence | Design-intent gap | **post-cutover** |
| Post-session routing emails | Design-intent gap | **post-cutover** |

---

## Category 5 — Host Management (Coordinator Controls)

**Auth helpers:** `lib/hubMemberAuth.ts` — `getEffectiveHostingCapability()`, `canReceiveHubNotifications()`

**Schema fields on HubMember:** `status` (ACTIVE/PAUSED/INACTIVE), `hostingCapability` (bool), `communicationsEnabled` (bool), `pausedAt`, `pausedById`, `pauseNote`, `coordinatorNote`

**Manual chapter:** `host-hub-team-management` — coordinator-specific; covers pause flow, status, coordinator notes, activity tracking, member management

### What's there

**Pause / restore** — Ready. Coordinators can set a host's status to PAUSED from the hub Members page without touching the host's global roles. The three pause decisions (can they still host? receive emails? why?) are well-documented in the team management manual chapter. The pause note is private; the host doesn't see it.

**409 conflict flow** — Ready. If a coordinator pauses a member who has upcoming HostAssignment records, the API returns a 409 with the assignment list and asks for confirmation (`force: true`). The coordinator can optionally release future assignments (`releaseAssignments: true`) to return them to the unclaimed pool. The team is notified of released sessions.

**Effective hosting capability gate** — Ready. `getEffectiveHostingCapability()` is called at every hosting-permission decision point: LiveKit token grant, sub-request claim, HostAssignment creation. If a HubMember record exists, `status === "ACTIVE" && hostingCapability` is authoritative. ADMIN bypasses. This means a paused host's token request is refused at the room gate — not just filtered from the schedule view.

**Communications gate** — Ready. `canReceiveHubNotifications()` gates sub-request emails. A host with `communicationsEnabled: false` is excluded from the team notification list. Useful for a host taking a leave of absence who doesn't want to see team emails during their break.

**No-delete policy** — Ready. When a HOST role is revoked, the HubMember record persists. Coordinator-owned state (pause notes, capability flags, coordinatorNote) is preserved. Hard removal (`DELETE /api/hub/[slug]/members/[userId]`) is ADMIN-only.

**Coordinator notes field** — Ready. `coordinatorNote` on HubMember is a freeform text field the coordinator can use for per-host context. Visible only to coordinators and admins. The team management chapter covers this.

**Member management (add/remove, toggle coordinator)** — Ready. Coordinators can add members to the hub, remove them, and toggle `isCoordinator` on existing members.

| Item | Status | Priority |
|---|---|---|
| Pause / restore workflow | Ready | — |
| 409 conflict + release flow | Ready | — |
| Effective hosting capability gate | Ready | — |
| Communications gate | Ready | — |
| No-delete policy on role revoke | Ready | — |
| Coordinator notes | Ready | — |
| Team management manual chapter | Ready | — |
| Paused host display in schedule | Ready (built session 104) | — |

---

## Category 6 — Cron / Automation

**Source:** `vercel.json`

### Active crons

| Cron path | Schedule | What it does | Host-relevant? |
|---|---|---|---|
| `/api/cron/apply-standing-assignments` | Daily 8am UTC | Applies all active standing rotations to open future sessions (resolution: leave, never overrides). On the 1st of the month, pre-fills next month too. Sends per-host digest emails for newly-created assignments. | **Yes — primary automation for host scheduling** |
| `/api/cron/send-reminders` | Daily 14:00 UTC | Program registration reminders to registered members | No |
| `/api/cron/cleanup-incomplete-accounts` | Daily 5am UTC | Clears stale magic-link sessions | No |

### Notes on apply-standing-assignments

The cron runs daily but only creates assignments where none exist (resolution mode `"leave"`). This means:
- If a rotation covers "every Tuesday Good Morning Sit" and a HostAssignment already exists for a Tuesday session (someone claimed it manually), the cron skips that session.
- If a standing rule exists but no session date has been generated for next month yet (Sanity-based programs with recurrence), the cron can't create assignments until the schedule utility generates the dates. The cron and the schedule tool use the same `isOccurrenceOnDate()` logic from `lib/scheduleUtils.ts`.
- On the 1st of each month, the cron pre-fills the full next month. Hosts see their upcoming rotation assignments appear overnight on the 1st.

### Documentation drift

`RIM_Stack_Reference.md` describes the cron directory as *"scheduled jobs (reminders, unassigned-host check, support-sync)"* — all three referenced crons are wrong:
- `check-unassigned-hosts` was removed in session 96 with the Alerts module
- `support-sync` was never a cron (Gmail sync that blew the Neon free-tier cap in session 58 was removed)
- `apply-standing-assignments` (the only host-relevant cron) is not listed

Not a training blocker — hosts don't touch crons — but the reference doc is stale.

| Item | Status | Priority |
|---|---|---|
| apply-standing-assignments cron | Ready | — |
| Per-host assignment digest email | Ready | — |
| Month pre-fill on 1st | Ready | — |
| RIM_Stack_Reference.md cron description | Functional — needs documentation | **post-cutover** |

---

## Category 7 — Documentation

### Manual chapters (at `/admin/manual`)

| Chapter slug | Accessible from | Coverage | Status |
|---|---|---|---|
| `host-hub` | "?" icon on hub home header | Hub orientation for hosts: what each section is, where to go for what, who's on the team, what you'll find in Documents. Well-written; current as of session 97 rewrite. | Ready |
| `host-hub-team-management` | Manual table of contents | Coordinator-specific: adding/pausing/removing members, pause decisions (hosting/comms/why), coordinator notes, activity tracking. Well-written and comprehensive. | Ready |
| `host-schedule` | "?" icon in schedule filter row | Schedule tool for hosts: navigation, 4 actions, modals, filters, standing rotations awareness. Comprehensive. | Ready |
| *(none)* | — | **Virtual session room for hosts.** Nothing covers: how to navigate to `/session/[slug]`, what the session room UI looks like, host controls (Mute All, End for All, per-participant mute), the "Step in as Host" button, what to do when audio doesn't work, how to leave. A host encountering the room for the first time during a live session has no in-context help. | **Gap: build needed** |
| *(none)* | — | **New host onboarding sequence.** No checklist or "your first week" document: what to do after role assignment, how to navigate the hub, how the schedule works, who to contact, what a typical session looks like. Currently this exists only in the `host-hub` orientation chapter which covers the hub but not the workflow arc. | **Gap: build needed** |

### Stale references in reference documents

**`RIM_Role_Design.md` — Virtual Host section:** The entire section references "Google Meet" throughout. "Log into the correct room account before the session," "open the space," "close the room" — all describe the Google Meet shared-account workflow, which was replaced by LiveKit in session 86. The design intent (12-minute arrival, relational/technical dimensions, two-host ideal) is still accurate and valuable. The implementation description is now wrong. A coordinator reading this document would be confused about how sessions actually work.

**`lib/email.ts:440`** — Function comment on `sendHostRoleAssignmentEmail`: *"to new Meet host."* Minor, but visible to any developer reading the file.

**`RIM_Stack_Reference.md`** — Cron directory description references removed crons; omits `apply-standing-assignments`. (Covered in Category 6.)

| Item | Status | Priority |
|---|---|---|
| host-hub chapter | Ready | — |
| host-hub-team-management chapter | Ready | — |
| host-schedule chapter | Ready | — |
| Session room chapter for hosts | Gap: build needed | **blocks training** |
| New host onboarding sequence | Gap: build needed | **build before training** |
| RIM_Role_Design.md Google Meet references | Functional — needs documentation | **build before training** |
| email.ts comment "to new Meet host" | Functional — needs documentation | **post-cutover** |

---

## Consolidated Action List

Sorted by training-readiness priority. Each item is decision-ready: description, file/location, what to do.

### Blocks training — must resolve before mid-May

| # | Item | Location | Action |
|---|---|---|---|
| T2 | Session room manual chapter | `prisma/` (new seed file), `/admin/manual` | Write a chapter covering: how to navigate to a session, what the room looks like, host controls, Step in as Host, audio troubleshooting, how to leave. Slug: `host-session-room`. Wire the "?" help icon in `app/session/[slug]/page.tsx`. |
| T3 | Hub welcome body — content authored | Hub home at `/account/hub/host-team` | Jesse or Maria authors the welcome message before training. The mechanism works; the field is empty. Coordinator writes it via the inline editor. Not a code change. |

### Build before training — meaningful improvement, not strict blocker

| # | Item | Location | Action |
|---|---|---|---|
| B2 | New host onboarding sequence | `prisma/` (new seed file), `/admin/manual` | A "your first week as a host" chapter or section: what to do after role assignment, how to find the hub, how to navigate the schedule, who to call. Could be a subsection of `host-hub` or a standalone chapter. |
| B3 | RIM_Role_Design.md — update Google Meet references | `RIM_Role_Design.md` | Rewrite the Virtual Host section's implementation language to reflect LiveKit. The design intent (12-minute arrival, relational dimensions, two-host ideal) stays. The "log into the room account" / "open the space" / "close the room" language goes. A coordinator reading this should get an accurate picture of what LiveKit hosting looks like. |
| B4 | Coordinator-specific schedule guide | Existing `host-schedule` chapter or new section | Add a coordinator section to the schedule manual: how the member picker works, what the Rotations tab is for, how reassign-to-me works, how to check a paused host's assignments. |

### Acceptable to defer — with documentation

The following gaps exist in the system. Training succeeds without them if the manual or training session explicitly acknowledges them:

| # | Item | Note |
|---|---|---|
| D1 | Live attendance view | Removed session 89. Hosts do not have in-session attendance tracking. Manual note-taking is the current answer. Acknowledge this in training. |
| D2 | One-tap flagging | Removed with the live view. No in-session pastoral tracking tool. |
| D3 | Post-session form and routing | Removed session 76. Post-session reflection is untracked. Jesse may want to decide what replaces this before establishing the coordinator role. |
| D4 | First-time attendee welcome / returning-after-absence emails | Designed, never operationalized, infrastructure removed. Copy has never been written. When RIM decides to build this, it requires both the email infrastructure and the attendance tracking mechanism. |

### Post-cutover — schedule for after June 17

| # | Item | Note |
|---|---|---|
| P1 | RIM_Stack_Reference.md cron section | Update cron directory description; add apply-standing-assignments; remove references to check-unassigned-hosts and support-sync. |
| P2 | email.ts comment "to new Meet host" | Update function comment on sendHostRoleAssignmentEmail. One line. |
| P3 | Two-host / silent-host role | Design-intent in RIM_Role_Design.md. Not partially built. No scope here until Jesse directs otherwise. |

---

## Summary View

**What is ready now:** The core operational loop works. Hosts can sign up, ask for cover, accept cover, and join sessions with host controls. Standing rotations auto-schedule and notify. Sub-request emails fire. The hub has conversations, documents, and a members view. Three manual chapters exist and are current.

**What stands between Maria and a successful training session:** Two blocking items (T2–T3) and three improvement items (B2–B4). The most critical is T2 (session room documentation) — this is the part of the workflow that has no in-context help for a host who has never seen it. T1 (coordinator welcome email) and B1 (paused host badge) are complete as of session 104.

**What to tell the team about the gaps:** The live view and post-session form (D1–D3) were part of the original design and were removed during an earlier rebuild. They are not forgotten — they are intentionally deferred. Training should name them honestly: "We don't have in-session tracking yet. Here's how we handle it for now."

---

*Produced: 2026-05-07, session 103.*
*Companion files: `UP_NEXT.md`, `CLEANUP.md`, `RIM_Role_Design.md`, `session-log.md`.*
*Deadline: Zoom renews 2026-06-17. Training target: mid-to-late May 2026.*
