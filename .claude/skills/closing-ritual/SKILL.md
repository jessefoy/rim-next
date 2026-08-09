---
name: closing-ritual
description: The RIM session closing ritual — the complete documentation pass Jesse requires before a session ends. Use when Jesse says "closing prompt", "let's document everything", "let's close out", or otherwise signals the session is wrapping up. Covers session-log.md, FEATURES.md, RIM_Stack_Reference.md, RIM_System_Architecture.md, RIM_Editor_Types.md, the per-tool engineering docs, the hub routing audit, the email-template audit, the backlog, UP_NEXT.md, the architectural-decision check, and the memory behavior audit.
---

# Closing Ritual — "let's document everything"

When Jesse says **"closing prompt"**, **"let's document everything"**, or similar, complete ALL of the following before ending the session. No exceptions.

1. **Session log** (`session-log.md`) — Add an entry at the top. Include:
   - What was built or changed
   - What design decisions were made and why
   - **What this work connects to** — which existing features, routes, or systems are affected by or related to what was built. This is not optional. The interconnection record is how future sessions stay oriented.
   - What comes next

2. **FEATURES.md** — Add or update the relevant feature section(s). If a new feature was built, it gets its own section. If an existing feature was modified, update that section.

3. **RIM_Stack_Reference.md** — Update if anything changed: new dependency, new env var, new tool, version bump, role change, architectural shift.

4. **RIM_System_Architecture.md** — Update if any hub, tool, role, or permission logic changed.

4a. **RIM_Editor_Types.md** — Update if any editor surface, block, or placement changed. New blocks go into the Block Library section; new placements go into the Placement Registry. If an editor surface changed type or wrapper class, update the registry entry. The doc must match the code at session end — no drift.

4b. **Hub / Email / per-tool engineering docs** — Update the relevant engineering doc(s) if any rule, pattern, helper, or pitfall was added, changed, or invalidated during this session. The docs (`RIM_Hub_Engineering.md`, `RIM_Email_Engineering.md`, `RIM_Scheduler.md`, etc.) are the institutional memory — when a slice produces a new rule or surfaces a new pitfall, that rule lives in the doc, not just in the commit message or session log. The doc must match the code at session end.

4c. **Hub audit (when this slice touched hubs).** If this slice modified anything in `lib/hubAuth.ts`, `lib/hubMemberAuth.ts`, `lib/programHub.ts`, `lib/email.ts`, `/app/api/hub/*`, `/app/api/host/*`, `/app/account/hub/*`, `/admin/hubs`, or any tool that has a HubAppLink, audit all four routing layers per `RIM_Hub_Engineering.md`: (1) capability gates route by program/resource hub, (2) notification recipient pools use `getHubNotificationRecipients(programHubSlug, …)`, (3) UI / list queries filter by hub, (4) every email-template URL variable passes through `hubScopedUrl()` or `hubHomeUrl()`. Slice 1 (session 128) addressed layers 1–3; Slice 2.5 (session 128 follow-up) found and fixed layer 4. Don't skip the audit just because the change felt small — layer 4 was the leak nobody noticed for a full slice.

4d. **Per-tool engineering doc creation.** If this slice touched a tool or component without its own engineering doc (e.g. ProgramEditor, SessionRoom, HubAdmin, CourseEditor), create one as part of closing. The doc is the per-tool reference — its routes, hub-scoping story, common pitfalls, what's deferred. Name pattern: `RIM_<ToolName>.md`. Update the Design Orientation table to reference it. Self-perpetuating: every slice that touches a new surface produces its reference doc.

4e. **Email template audit (when this slice sent or changed any email).** For every `sendTemplatedEmail("slug", …)` call site added or changed this session, confirm the slug has a matching seed in `prisma/migrate.mjs` — so the row exists in the DB and appears in the editor at `/admin/emails`. Without the seed the send silently no-ops and the recipient gets nothing; the compiler can't catch it. Rules: reusing an existing template (no new slug) needs no seed; a brand-new slug MUST ship its seed in the same commit (`findUnique → create`, `enabled: true`); an intentional re-seed of an existing template needs Jesse's consent + a per-template apply log. This is the closing-time backstop for the always-on **Email Template Gate** in `CLAUDE.md` — verified every session, not just trusted. State explicitly which templates were added/changed, or "no email templates touched."

5. **Backlog** (`data/backlog.json`) — If any new items were identified during the session, add them.

6. **UP_NEXT.md** — Rewrite the "Active" section to reflect where this session ended. Capture: what was built and is now live, what is open (being tested, half-built, or waiting on Jesse), the next concrete step, and any queued follow-ons. This file is read at the top of the next session's opening ritual — it is how Jesse picks up where we left off without starting cold. **Keep it lean (session 171):** the archive is `session-log.md`, not this file. When rotating a session out of "Active"/"Prior handoff reference", move its narrative to the session log and at most add a one-line landmark to "Recently completed / reference" — that section is an orientation index, not a second log. It grew to 1,700 duplicate lines (~57k tokens loaded every session) before the 171 trim; don't let it re-accrete.

7. **Architectural decisions.** If a significant architectural or strategic decision was made or reversed during this session, identify the authoritative document for that decision and update or supersede it before closing. This is the step the closing ritual was missing when the Webflow directive went stale — a directive going out of date is nobody's job unless it's explicitly someone's job. Don't let the docs lie.

7b. **Behavior audit — scan the session for memory candidates.** Re-read the session transcript with a single question: *did Jesse correct, validate, or surface anything that future-me should not have to learn again?* Look for three signals: (1) corrections ("don't," "stop doing that," "no, the other way") — these go in `feedback-*` memory files; (2) validated approaches that surprised me or weren't obvious ("yes, exactly," accepting an unusual choice without pushback) — these also go in `feedback-*` files, with a *Why* line capturing what made it the right call; (3) surprises about project state, external systems, or user role — these go in `project-*`, `reference-*`, or `user-*` files. Don't write the memory files silently. List each proposed entry with a one-line summary and ask Jesse to confirm or discard. The five-minute audit is what keeps the memory system from drifting into "only what Claude noticed mid-flight." Most sessions will produce zero memory updates; that's fine — the value is in the scan, not in always finding something.

7c. **Memory backup refresh.** If step 7b produced any memory-file changes (or memory changed earlier in the session), refresh the git-tracked mirror: copy the live memory directory (`~/.claude/projects/-Users-jessefoy-Sites-rim-next/memory/*.md`) into `.claude-memory/`, removing files that no longer exist in the live directory. This is the laptop-loss backup documented in `PROJECT-BACKUP-AND-RESTORE.md` — it only protects Jesse if it's current. Skip silently only when memory was untouched all session.

8. **Commit and push all documentation changes together.**

If any of these files do not need updating for this session, say so explicitly. Do not silently skip them.
