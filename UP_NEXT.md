# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Host Hub Phase 5 — Role-adaptive Hub Home (queued, not yet started) (session 93 closing, 2026-04-22)

Phases 3 and 4 of the Host Hub Rework are both shipped. Phase 5 is the next phase and has a spec but no code yet.

### What Phase 5 is

Hub Home shows different content based on the viewer's role. The Host Hub is the first hub to get this treatment — generalization to other hubs waits until Course Hub or Registration Hub asks for their own attention view.

**Coordinator view:**
- Attention items (see below)
- Team directory — coordinator-authored prose in the Hub Home editor, *not* a structured component. Per the Phase 1 revert decision, role descriptions live as BlockNote content the coordinator writes and updates manually. Seed with placeholder prose based on the draft role statements from the original spec conversation.
- Quick links
- Coordinator notes area

**Host view:**
- Welcome content (seed with the draft Host description from the spec)
- Pinned threads
- Team roster with photos and bios
- Troubleshooting guidance
- Quick links

**Toggle:** coordinators and admins can preview the host view. Session-scoped, resets on refresh.

### Coordinator attention items (Host Hub-specific)

Implement each as its own section; hide the section entirely when its list is empty. If *all* sections are empty, show a single "Everything's handled" message.

1. **Pending new hosts** — `HubMember` records added in the last 7 days. Useful for onboarding follow-up.
2. **Unassigned virtual/hybrid programs in the next 30 days** — reuse the existing cron query (there's already a job that computes this for the `UNASSIGNED_SESSION` alerts). Don't duplicate the logic.
3. **Unclaimed sub requests** — `SubRequest` where `status = OPEN`.
4. **New conversation threads since coordinator's last visit** — use `HubMember.lastVisitedAt` as the watermark. Count threads created after that timestamp.

Keep this Host Hub-specific for now. When a second hub needs an attention view, refactor shared pieces (watermark, section empty-state rendering). Don't generalize preemptively.

### Suggested sub-step order

1. **Role detection + view split** — figure out from the viewer's `HubMember` + roles whether to render coordinator or host view. Get the skeleton of both views rendering before filling in sections. Verify: a coordinator sees the coordinator shell; a host sees the host shell; an ADMIN defaults to coordinator.
2. **Coordinator view sections** — attention items first (four lists + empty state), then quick links + coordinator notes area.
3. **Host view sections** — welcome content (BlockNote prose), pinned threads, team roster (read from `HubMember` + `User.bio` + `User.avatarUrl`), troubleshooting guidance, quick links.
4. **Toggle** — coordinator-only "Preview as host" button. Session-scoped (URL query param or client state), not persisted. Visual indicator while previewing.
5. **Seed placeholder content** — initial BlockNote JSON for the host-view welcome block and the coordinator-authored team directory. Use the draft role statements from the original spec conversation.

### What sits behind Phase 5

- **Host Hub Phase 3 (session 92)** — hub membership is authoritative for team state. Phase 5 consumes this: coordinator detection comes from `HubMember.isCoordinator`; the team roster reads `HubMember` records; the "pending new hosts" list is a query over `HubMember.createdAt`.
- **Host Hub Phase 4 (session 93)** — no direct dependency. Phase 4's reassign-to-self action and diagnostic panel live on `/tools/schedule`, not Hub Home.

### Things the opening ritual should know

- **Hub membership is authoritative when it exists.** If gating a new surface on hosting or hub notifications, pass the tentative role-based decision as the third arg to `getEffectiveHostingCapability` / `canReceiveHubNotifications`. Do not re-implement the pattern.
- **No-delete is the policy.** Never call `db.hubMember.delete()` outside the ADMIN-only DELETE route. Revoking a role preserves the HubMember record and its coordinator-owned state.
- **Destructive actions get a confirmation flow.** The 409 + `force: true` pattern on `app/api/hub/[slug]/members/[userId]/route.ts` is the template.
- **Team directory is prose, not schema.** Per the Phase 1 revert: role descriptions are BlockNote content the coordinator writes in Hub Home. There is no `RoleProfile` model — do not try to resurrect one.

### Files to keep in mind

- `RIM_System_Architecture.md § Hub Membership as Authority` — the canonical doc for this model
- `lib/hubMemberAuth.ts` — the two permission helpers
- `lib/syncHubMembership.ts` — sync policy (no-delete, field ownership)
- `lib/toolAuth.ts` — notification recipient filter (`getHubNotificationRecipients`)
- `components/HubMembersClient.tsx` — coordinator control surface pattern
- `components/HubScheduleClient.tsx` — `<ProgramDiagnostics>` and reassign flow (Phase 4, for reference when building similar manager-only affordances)
- `app/api/host/assignments/reassign/route.ts` — the pattern for HOST_MANAGER/ADMIN-only mutation endpoints

### Known issues / deferred

- **Manual chapter** for coordinators managing hub members is live (`slug: host-hub-team-management`, from session 93) — verify at `/admin/manual/host-hub-team-management` after the next deploy has run the migration.
- **Feature cards page** was removed from the closing ritual in CLAUDE.md this session — the file `app/admin/features/page.tsx` doesn't exist and isn't planned. If we build a feature inventory page later, add the step back.
- **Schedule display of paused hosts** — `HubScheduleClient` still renders assignments without a visual cue for paused hosts or hosts with capability revoked. Deferred; consider a "hosting revoked" flag on the session card when the assigned user no longer has effective hosting.
- **Editor/block work from session 90's queue** — Stage 2d blocks (Announcement, EarlyArrival, DanaInvitation, etc.) remain open, plus the `TeacherProfile.bio` + `Course.completionNote` schema promotions and the terminal `<EditorField>` code-level gate.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
