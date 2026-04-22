# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: nothing in flight — Host Hub Rework fully shipped (session 93 closing, 2026-04-22)

The Host Hub Rework spec is now substantively delivered across Phases 1 → 5. The next session can either pick up one of the small open threads below or start on a new initiative.

### What went live in session 93

- **Phase 4 (Schedule)** — Program diagnostic panel + reassign-to-self action (HOST_MANAGER/ADMIN only) on the session detail in `HubScheduleClient`.
- **Phase 5 (role-adaptive Hub Home)** — `/account/hub/host-team` branches at the page level. Coordinators land on a coordinator shell with four attention-list sections (pending new hosts, unassigned programs, unclaimed sub requests, new conversations) plus team-directory prose + quick links + coordinator-notes placeholder. Hosts land on a welcome + pinned + roster + troubleshooting + quick-links shell. Coordinators get a session-scoped toggle to preview the host view.
- **Manual chapter** — `host-hub-team-management` seeded, reachable at `/admin/manual/host-hub-team-management` after the next deploy.
- **Placeholder content** — `prisma/seed-host-hub-home-content.mjs` seeds `Hub.welcomeBody` and `Hub.homeContent` with initial prose, write-only-if-null.

### Small open threads (pickable, not required)

- **Schedule display of paused hosts** — `HubScheduleClient` still renders assignments without a visual cue when the assigned host is paused or has `hostingCapability = false`. Consider a "hosting revoked / paused" marker on the session card when the assigned user no longer has effective hosting.
- **Coordinator notes area (dedicated editor)** — Phase 5 currently renders a placeholder pointing at Documents. A real implementation would need a field (`Hub.coordinatorNotes Json?` is the natural shape), a coordinator-only editor surface, and a decision on audit/versioning. Not started — the placeholder is honest, not blocking.
- **Editor/block work from session 90's queue** — Stage 2d blocks (Announcement, EarlyArrival, DanaInvitation, etc.), the `TeacherProfile.bio` + `Course.completionNote` schema promotions, and the terminal `<EditorField>` code-level gate.
- **Duplicate-Aside backlog item** — see session 90 closing. Editor allows inserting an Aside immediately after another Aside; product question is whether that's ever intended.

### If starting Phase 5-adjacent work, the bits worth remembering

- **The view split lives at the page level, not in `HubHomeClient`.** `app/account/hub/[slug]/page.tsx` has a `slug === "host-team"` branch that fetches both coordinator and host data in parallel and renders `HostHubHomeClient`. Other hubs still flow through the generic `HubHomeClient`.
- **`HostHubHomeClient.tsx` carries both views.** The coordinator/host toggle is a local `useState` (session-scoped). Preserve that — don't move it to a URL param.
- **Attention items are Host-Hub-specific.** When a second hub asks for an attention view, refactor the card primitives (`AttentionCard`, `AttentionRow`) + empty-state pattern into shared pieces. Don't generalize preemptively on a sample size of one.
- **Team directory = `hub.homeContent`.** Per the Phase 1 revert, role descriptions are prose, not a `RoleProfile` model. Coordinators edit via `/admin/hubs/[slug]/edit`. Any attempt to add a structured team-directory component is a regression on that decision — read the Phase 1 revert notes before going there.
- **Roster reads live data.** Names, titles, avatars, and bios come from `HubMember` + `User` at request time. No caching layer in front of it. `HubMember.position` wins over `User.title` when both are set.
- **Placeholder content never overwrites coordinator edits.** The `seed-host-hub-home-content.mjs` upsert is write-only-if-null. Deploys do not clobber.

### Permanent reminders from earlier phases (still true)

- **Hub membership is authoritative when it exists.** If gating a new surface on hosting or hub notifications, pass the tentative role-based decision as the third arg to `getEffectiveHostingCapability` / `canReceiveHubNotifications`.
- **No-delete is the policy.** Never call `db.hubMember.delete()` outside the ADMIN-only DELETE route. Revoking a role preserves the HubMember record and its coordinator-owned state.
- **Destructive actions get a confirmation flow.** The 409 + `force: true` pattern on `app/api/hub/[slug]/members/[userId]/route.ts` is the template.

### Files worth keeping in mind if the next task touches the Host Hub

- `RIM_System_Architecture.md § Hub Membership as Authority` — canonical doc for the permission model.
- `lib/hubMemberAuth.ts` — the two permission helpers.
- `lib/syncHubMembership.ts` — sync policy (no-delete, field ownership).
- `lib/toolAuth.ts` — notification recipient filter (`getHubNotificationRecipients`).
- `components/HubMembersClient.tsx` — coordinator control surface pattern.
- `components/HubScheduleClient.tsx` — `<ProgramDiagnostics>` + reassign flow (Phase 4).
- `components/HostHubHomeClient.tsx` — role-adaptive Hub Home (Phase 5).
- `app/account/hub/[slug]/page.tsx` — the host-team page-level branch + attention-item queries.
- `app/api/host/assignments/reassign/route.ts` — HOST_MANAGER/ADMIN-only mutation template.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
