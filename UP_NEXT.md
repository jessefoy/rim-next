# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

**Session 117 (2026-05-19)** — Session room: six-issue fix → Zoom-aligned redesign → A/V quality + auto-hide. Thirteen commits on `main`. Branch `claude/auto-hide-chrome` is the final stop (locally; merged to main and deleted on origin). See session-log entry for full chronology; the volunteer-facing changelog is at `SESSION_ROOM_FOR_VOLUNTEERS.md`.

**What's now live in the LiveKit session room:**

- **Bottom Zoom-style control bar** — icon-stacked-over-label, Lucide SVG icons, two-part Mic + Camera clusters with device-picker chevrons, Reactions popover, red End button with End-for-All + Leave popover. Page header trimmed to Step-In / program name / View toggle + Fullscreen + Help.
- **Three-way audio profile** (teacher / speaker / listener) driving capture flags and publish bitrate (128 / 96 / 64 kbps). H.264 video at 2.5 Mbps / 30 fps. DTX off. Default ~20 kbps was the source of "thin voice" complaints.
- **Custom persistent chat** with direct messages. New `SessionChatMessage` model + `/api/livekit/chat` (GET history, POST persist + dedup). Live via LiveKit data channel. Recipient picker → server-filtered DMs.
- **Custom tile** — Zoom-style nameplate (no pill, white text + text-shadow, mic-off only when muted), active-speaker yellow outline, initials-circle avatar fallback (deterministic muted color hashed from identity), pure-black room background.
- **Speaker / Gallery view toggle** with `useSpeakingParticipants` auto-pin (ref-gated to avoid per-render thrash).
- **Participants panel** sticky Me row, Host pills from token metadata, raised hands floated, per-row mute (host), Mute All footer, search at >10.
- **Device pickers** on mic/cam chevrons + matching Settings sections. Persist to `localStorage` under `rim-livekit-prefs`.
- **Auto-hide chrome** — 3s idle timer, `:has()` overrides for panels/popovers, `:hover` restores, touch never fades.

**Build hardening:** `lib/stripe.ts` lazy-init Proxy so preview builds don't throw on import. Pairs with the session-116 `prisma/migrate.mjs` env-guard.

**Collaboration experiments — promoted from probation:**
- **Plan mode** used twice (six-issue fix, Zoom redesign). Worth keeping for non-trivial work.
- **Reviewer sub-agent before commit** used twice. First run caught the participants count/row mismatch + a false-positive on `onLeave`. Second run caught the auto-pin re-render thrash + `as never` casts. Promote to default-before-non-trivial-commit pattern.
- **Merge to main by default** held all session. No "want me to merge?" gates.

**Next concrete step:** hold for Jesse's testing on the deployed room. Possible follow-up if a Sangha member tests and reports specifics. Maria training session per `TRAINING_PLAN.md` remains the queued downstream item from session 115/116.

**Deferred from session 117 (in backlog):**

1. **Spotlight** — host-driven global pin everyone sees (we have local pin in Speaker view, but not Zoom's spotlight).
2. **Mirror video toggle** in Settings → Video.
3. **Test Microphone / Test Speakers** affordances in Settings → Audio.
4. **Host-tag spoofability hardening** — `canUpdateOwnMetadata: true` lets a client claim Host in their own metadata; UI cue only, real actions server-gated. If we want a non-spoofable tag, proxy avatar/signal updates via `RoomServiceClient.updateParticipant` and drop the grant. Risk-accepted for now.
5. **Settings scroll-to-section** — chevron popovers' "Audio Settings…" / "Camera Settings…" link opens the panel but doesn't scroll to the relevant section. Sections are short; minor.

**Deferred from session 113 (still open):**

1. **`volunteer-roles` chapter** — `prisma/seed-manual.ts` updated in-file (SUPPORT removed, GUIDING_TEACHER added), but the DB record at `/admin/manual/volunteer-roles` was not refreshed. Edit manually at `/admin/manual/volunteer-roles/edit`, or write a small `update-manual-volunteer-roles-v2.mjs` script gated by a migration flag.
2. **`host-hub` chapter** — Should mention the Documents notification picker and Archive → Trash flow, and point coordinators to the Trash page.
3. **New `hub-trash` chapter (optional)** — Short chapter explaining the manager-facing Trash page (admins/coordinators/guiding teachers).

**Parked follow-ons from earlier sessions:**

1. **Email template wording in DB** — `registrar-role-assigned` and reminder templates still contain "dashboard" language. Safe path: edit at `/admin/emails`; keep the `dashboardUrl` binding name for now.
2. **`SUPPORT` enum value in `prisma/schema.prisma:135`** — Still present. Removing a Prisma enum value while any user row references it in `roles[]` will crash. Needs a user-records audit (`SELECT id FROM users WHERE 'SUPPORT' = ANY(roles)`) before removal. Out of scope.

**From session 115 (still in backlog):**

1. **Drop legacy `HubConversationThread.status` column** — A couple of UI checks (`HubConvThreadClient.isClosed`, archive toggle buttons in `HubConvClient`) still read `status`. Migrate them to `archivedAt`, then drop the column. Mechanical, low-risk, no rush.
2. **Coordinator-friendly hub content editing for non-host hubs** — Currently welcome / home content on the three non-host hubs (`courses`, `registrar`, `support`) is editable only via the ADMIN form at `/admin/hubs/[slug]/edit`. Either extend `HostHubHomeClient`'s inline edit affordance to all hubs, or build a coordinator-scoped settings page. Decision: which surface?

**New from session 116 (in backlog):**

1. **Functional Vercel preview deploys** — migrate.mjs now skips gracefully on preview builds, but the app itself still has no DB at runtime in preview. Two options: (a) add a staging/preview Postgres and wire its URL to Vercel's Preview env scope, (b) accept that previews are build-only checks (won't run end-to-end). Worth a decision before regular branch work resumes.

**Theme B (Google Meet) remains.** Items #15–17 are still manual steps Jesse will do when ready:
- #15 — Remove four Google Meet env vars from Vercel project settings
- #16 — Revoke/delete the service account in Google Cloud Console
- #17 — Archive or delete `meet1@`–`meet4@` Google Workspace accounts

---

## Next deliverable candidates

### Editor toolbar polish

Jesse said "I'll address the menu items later" early in session 97. The current toolbar dropdowns (Heading, Callouts, Dharma blocks) and bubble menu contents are reasonable defaults but he may want refinements:

- Specific button choices and order
- Iconography
- Mobile-specific layout changes
- Whether the floating "+" on empty lines should be wired up (Tiptap extension is installed but not used; Notion-style block insertion menu)

Lighter than Webflow weekly schedule but worth a focused pass before the toolbar set in stone.

### Stage 2d editor blocks (Page Designer expansion)

Three blocks in the original Page Designer plan that were never built: Announcement, EarlyArrival, DanaInvitation. They'd replace top-level Program fields (`specialAnnouncement`, `earlyArrivalMessage`, the page-rendering of `danaMessage`) with inline blocks the author places where they want.

Now that the Tiptap migration is complete, these blocks can be added as Tiptap extensions (mirror existing `Callout`, `PullQuote`, etc. in `components/rim-tiptap/extensions/`). Plus a data migration that reads the legacy fields and inserts matching blocks at the end of the description.

Not blocked by anything. Each block is a small, contained piece of work.

### BlockNote walker eventual removal

Once every row in the database has been edited and saved as HTML, the BlockNote-JSON walker in `lib/renderRichContent.ts` and `lib/renderRichContentServer.ts` can be removed. Until then it's the safety net for unmigrated content. No deadline; depends on user activity. Worth checking the database periodically (`SELECT COUNT(*) FROM ... WHERE jsonb_typeof(field) = 'array'`) to know when it's safe.

---

## Smaller items still parked

- **Vercel `NEXTAUTH_URL` trailing space** — code is defensively trimmed in five places (`lib/email.ts`, `lib/calendarLinks.ts`, `lib/supportNotify.ts`, `app/api/cron/drip-release`, `app/api/stripe/checkout`); the env var itself should still be cleaned at the source so future surfaces don't pick up the same bug. One-time edit in Vercel project settings.
- **Coordinator notes area** — `Hub.coordinatorNotes Json?` (or HTML, post-migration) + coordinator-only editor surface. Was discussed during the team-management work; never built.
- **Duplicate-Aside backlog item** — Editor allows inserting an Aside immediately after another Aside. Was true with BlockNote's structure; may not apply post-Tiptap-migration. Revisit if it's still observable.
- **Hub document export** — fixed session 102. HTML documents export as `.html`; legacy BlockNote JSON documents still export as `.md`. Both paths tested via TypeScript.

---

## Permanent reminders (still true)

- **Hub membership is authoritative when it exists.**
- **No-delete policy for HubMember.** Never call `db.hubMember.delete()` outside the ADMIN-only route.
- **Use `after()` from `next/server` for fire-and-forget email sends in route handlers.** `void (async () => {})()` is silently killed by Vercel's serverless teardown.
- **Trim `NEXTAUTH_URL`-derived constants.** Every `BASE_URL` does `.trim().replace(/\/$/, "")` because env vars can carry whitespace.
- **Every `sendTemplatedEmail(slug, …)` must ship with a matching seed entry in `prisma/migrate.mjs` in the same commit** (Email Template Gate, CLAUDE.md). Missing templates silently no-op — recipients get nothing. Use defensive `findUnique → create` so any manual `/admin/emails` edits are preserved.
- **Trash-management authority lives in one place:** `canManageTrash(roles, isCoordinator)` in `lib/hubAuth.ts`. ADMIN, GUIDING_TEACHER, or hub coordinator. Use this helper anywhere trash visibility or restore/permanent-delete gating is needed — don't reimplement the role check inline.
- **Coordinator-level authority lives in one place:** `effectiveCoordinator(member, roles)` in `lib/hubAuth.ts`. Returns true for hub-coordinator flag, ADMIN, or GUIDING_TEACHER (GT acts as soft admin at the content layer on every hub). Use this helper anywhere you'd previously written `(member?.isCoordinator ?? false) || isAdmin`. Don't inline the boolean.
- **Hub-thread filter shape lives in one place:** `activeHubThreadWhere(hubId)` in `lib/hubQueries.ts`. Returns `{ hubId, documentId: null, deletedAt: null, archivedAt: null }`. Use it for any findMany / count surfacing hub-level threads to members. Don't inline the filter; the three previous drift bugs (`status: { not: "ARCHIVED" }`, missing `documentId: null`, missing `deletedAt: null`) all happened by inlining.
- **`archivedAt`, not `status`, is the canonical archive marker for hub threads.** `HubConversationThread` now mirrors `HubDocument` (session 115). The `status` column is kept in sync by the PATCH route for backward compat but will be dropped in a future cleanup. Don't write new code that reads `status` to determine archive state.
- **Three-stage hub delete is enforced at both UI and API layers.** The UI hides the Delete button on non-archived items; the API returns 400 with "Archive this … first" unless the item is archived. Both rules matter — the UI is the friendly path, the API is the hard guard against direct calls.
- **Resolve `Program.name` from the slug before sending any host email.** Slugs are URL-safe but ugly — `essential-dharma-study-2024-07-14` in an email body is a reliability issue, not a cosmetic one. Pattern: `await db.program.findUnique({ where: { slug }, select: { name: true } })` near the top of the email-sending block.
- **Storage paradigm for editor content is plain HTML strings.** `RimTiptapEditor` produces HTML directly via `editor.getHTML()`. Renderers accept both HTML and legacy BlockNote JSON via format detection — unmigrated rows still display correctly.
- **The selection bubble menu is the primary formatting surface in editors.** Top toolbar is for insertion-only actions (image, table, hr, callouts, dharma blocks). Don't put inline marks in both — duplicates discovery paths.
- **`useEditor` returns null on first render with `immediatelyRender: false`.** Any `useEffect` that touches refs INSIDE the rendered tree must include `editor` in deps so it re-runs after editor initialization (the early `if (!editor) return null` means refs are null on the first run).
- **`Array.isArray(body)` filters at page level will silently drop HTML.** Pre-Phase-2 code had patterns like `initialBody={Array.isArray(doc.body) ? doc.body : null}` — these reject HTML strings and pass null, causing content-appearing-missing bugs. Trust the editor component's own `isHtmlString` / `renderBlockNoteHtml` normalization; don't filter at the page.
- **Tiptap's empty-document HTML is `"<p></p>"`, not `""`.** `!draft` truthiness checks fall through. Use `html.replace(/<[^>]+>/g, "").trim().length > 0` to detect meaningful content.
- **`html { overflow-x: clip }`, not `hidden`.** `overflow-x: hidden` creates a scroll container that breaks `position: sticky` for descendants in Safari/Chromium. `clip` clips overflow without making the element scrollable.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
