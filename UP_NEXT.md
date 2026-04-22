# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Host Hub Rework — Phase 3 shipped, Phase 1 reverted, Phase 2 skipped (session 92, 2026-04-22)

Phase 3 makes **hub membership the authority** for team state that used to be derived only from system roles. Coordinators can now pause a member, restrict hosting capability, disable hub notifications, or mark a member inactive — all without touching the global Role[]. This is the dimmer switch that replaces the old on/off role-strip.

### What session 92 shipped (Phase 3)

- `HubMemberStatus` enum (ACTIVE / PAUSED / INACTIVE) + 6 coordinator-owned fields on HubMember (`hostingCapability`, `communicationsEnabled`, `pausedAt`, `pausedById`, `pauseNote`, `coordinatorNote`). Idempotent migration `add_hub_member_authority_fields`.
- `lib/hubMemberAuth.ts` — `getEffectiveHostingCapability(userId, hubSlug, fallback)` + `canReceiveHubNotifications(userId, hubSlug, fallback)`. HubMember record authoritative when present; falls through to `fallback` when absent.
- `syncHubMembership` refactored — sync writes only identity + role-derived fields, never touches coordinator-owned state, and **never deletes** records on role revoke.
- `getHubNotificationRecipients` now filters by `status === "ACTIVE" && communicationsEnabled`.
- LiveKit gates: token, step-in, mute-participant, mute-all all pass tentative role/assignment grants through `getEffectiveHostingCapability("host-team", tentative)`.
- Host-team gates: sub-requests (GET + POST), sub-request claim, host assignments (GET + POST self-claim + manager-assign target validation), post-claim team notifications.
- Hub members API: path renamed `[memberId]` → `[userId]`. POST accepts initial `position` + `isCoordinator`. PATCH accepts all coordinator-owned fields with a destructive-action warning flow (409 + `force: true, releaseAssignments?` on upcoming HostAssignments). DELETE tightened to **ADMIN-only** (coordinators set status INACTIVE instead).
- `HubMembersClient` rewritten — per-member editor panel, status badges (Paused/Inactive), flags ("Hosting restricted", "Notifications off"), pause note display, warning dialog for destructive actions. Non-coordinator viewers see read-only roster. Groupings: Coordinators / Members / Paused / Inactive.
- Member picker guardrails — min 3 chars, archived + non-ACTIVE excluded, existing hub members excluded, max 20 sorted by name.
- `hub-mem-editor-*` + `hub-mem-dialog-*` + status badge CSS added.

### What was reverted from Phase 1

The `RoleProfile` layer (role-description model, MyRolesSection, admin section, role-profile API routes, role-profile editor placement, `lib/roleKeys.ts`, seed) was dropped. Role descriptions live as coordinator-authored Hub Home content instead. The `User.bio` field + BlockNote avatar + admin BioSection + `user-bio` editor placement all remain.

### What Phase 2 was supposed to be

Empty settings shell for hub-scoped preferences. Skipped — empty scaffolding is the same mistake Phase 1 stepped back from. Will build when a real setting exists.

### What comes next

There is no specific next phase committed. Possibilities:

- **Phase 4 — Hub-scoped preferences (deferred from Phase 2)**: only if a real setting needs a home. Not speculative.
- **Hub home surfaces for the new state**: the coordinator notes and pause notes are written but not yet surfaced on Hub Home or on a roster dashboard. If paused members + their notes should appear prominently somewhere beyond the Members tab, design the surface first.
- **Program Schedule display of paused hosts**: `HubScheduleClient` and the Host Team surfaces don't yet render a visual cue on assignments where the assigned host has their hosting capability revoked or is paused. Consider adding a "hosting revoked" flag to the session card when that's the case.
- **Editor/block work from session 90's queue**: all of the Stage 2d blocks (Announcement, EarlyArrival, DanaInvitation, etc.) remain open, plus the `TeacherProfile.bio` + `Course.completionNote` schema promotions and the terminal `<EditorField>` code-level gate.

### Things the opening ritual should know

- **Nothing is broken.** Build passes. All existing host/LiveKit/notification flows continue to work for users who have a HubMember record with ACTIVE status. Users who only hold a role and have no hub record fall through the legacy gate unchanged.
- **Hub membership is authoritative when it exists.** If gating a new surface on hosting or hub notifications, pass the tentative role-based decision as the third arg to `getEffectiveHostingCapability` / `canReceiveHubNotifications`. Do not re-implement the pattern.
- **No-delete is the policy.** Never call `db.hubMember.delete()` outside the ADMIN-only DELETE route. Revoking a role preserves the HubMember record and its coordinator-owned state.
- **Destructive actions get a confirmation flow, not a silent permission strip.** If a new surface can revoke hosting or pause a member with upcoming commitments, mirror the 409 + `force: true` pattern used on PATCH `/api/hub/[slug]/members/[userId]`.

### Files to keep in mind

- `RIM_System_Architecture.md § Hub Membership as Authority` — the canonical doc for this model
- `lib/hubMemberAuth.ts` — the two helpers
- `lib/syncHubMembership.ts` — sync policy (no-delete, field ownership)
- `lib/toolAuth.ts` — notification recipient filter
- `app/api/hub/[slug]/members/[userId]/route.ts` — warning-flow template for any similar destructive endpoint
- `components/HubMembersClient.tsx` — coordinator control surface template

### Known issues / deferred

- **Manual chapter** for coordinators managing hub members still needs updating — ManualSection content is DB-backed, edited at `/admin/manual/editor`. The chapter should cover: the three status values (ACTIVE/PAUSED/INACTIVE) and what dimming a member actually does; the distinction between pausing a member and revoking hosting capability; communications toggle for hub notifications; the destructive-action confirmation flow ("X has upcoming assignments — keep or release?"); and the policy that coordinators set INACTIVE rather than delete (ADMIN-only hard remove).
- **Session log + FEATURES §42** record the full change set. `RIM_Stack_Reference.md` has a one-paragraph summary in the Active Roles section.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
