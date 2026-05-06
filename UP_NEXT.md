# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

Nothing actively in flight. Session 99 (2026-05-06) closed with a major regroup focused on documentation sync. Three threads landed:

- **Hub Documents and manual chapters** — six new Host Hub Documents (Practice of Hosting, Running a Session, When Things Go Wrong, For Coordinators); manual chapters rewritten in plain language for the average host volunteer (`host-hub`, `host-hub-team-management`, `host-schedule`); new chapters added (`host-rotations`, `host-session-room`, `conversations`); option-B rewrites of `programs` and `registration` from careful UI walkthroughs.
- **Manual surfacing inside hubs** — new `/account/hub/[slug]/manual` route; "Manual" item in the hub sidebar; `?` icons on hub homes; hub-aware back-link from chapter pages; audience-grouped manual index.
- **Drift catch-up** — corrected stale claims across the manual (Tasks documented as live but removed in session 96; Support Inbox documented as live but parked since session 88; Google Meet documented but replaced by LiveKit in session 86; "Remove participant" and "Disable video" listed as host controls but neither exists). Section 19 marked REPLACED, Section 29 marked PARKED. Reference docs (`FEATURES.md`, `RIM_System_Architecture.md`, `RIM_Stack_Reference.md`) caught up — 11 session log entries added, intro paragraph rewritten to distinguish active vs parked/removed features.

The session also surfaced a real concern: the closing ritual hasn't been done thoroughly across recent sessions, producing compounding documentation drift. The mechanism is documented in `CLAUDE.md`; the fix is the practice, not new tooling.

### Loose ends from session 99

- **Broken redirects in `vercel.json`** — four redirects (`/volunteer*`, `/account/registrar*`) point to `/account/hub/registrar/programs` which no longer exists. They 404. Should be redirected to `/tools/programs` or removed.
- **`missing-reports` cron** in `vercel.json` — leftover from the deleted Virtual Host Hub Attendance system (session 89). Cleanup pending.
- **Future option-B depth on remaining chapters.** `course-hub` and `support-inbox` are now short and accurate from option-C; could be expanded with field-by-field detail later if there's a real audience.

Pick from the open threads below.

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
- **Schedule display of paused hosts** — `HubScheduleClient` doesn't visually mark assignments where the host is paused or `hostingCapability = false`.
- **Coordinator notes area** — `Hub.coordinatorNotes Json?` (or HTML, post-migration) + coordinator-only editor surface. Was discussed during the team-management work; never built.
- **Duplicate-Aside backlog item** — Editor allows inserting an Aside immediately after another Aside. Was true with BlockNote's structure; may not apply post-Tiptap-migration. Revisit if it's still observable.
- **Hub document export** — `app/api/hub/[slug]/documents/[id]/export/route.ts` still uses a BlockNote-JSON-only markdown converter. Should grow an HTML-string path for documents saved post-migration. Otherwise an HTML-stored document exports as `(No content)`.

---

## Permanent reminders (still true)

- **Hub membership is authoritative when it exists.**
- **No-delete policy for HubMember.** Never call `db.hubMember.delete()` outside the ADMIN-only route.
- **Use `after()` from `next/server` for fire-and-forget email sends in route handlers.** `void (async () => {})()` is silently killed by Vercel's serverless teardown.
- **Trim `NEXTAUTH_URL`-derived constants.** Every `BASE_URL` does `.trim().replace(/\/$/, "")` because env vars can carry whitespace.
- **Storage paradigm for editor content is plain HTML strings.** `RimTiptapEditor` produces HTML directly via `editor.getHTML()`. Renderers accept both HTML and legacy BlockNote JSON via format detection — unmigrated rows still display correctly.
- **The selection bubble menu is the primary formatting surface in editors.** Top toolbar is for insertion-only actions (image, table, hr, callouts, dharma blocks). Don't put inline marks in both — duplicates discovery paths.
- **`useEditor` returns null on first render with `immediatelyRender: false`.** Any `useEffect` that touches refs INSIDE the rendered tree must include `editor` in deps so it re-runs after editor initialization (the early `if (!editor) return null` means refs are null on the first run).
- **`Array.isArray(body)` filters at page level will silently drop HTML.** Pre-Phase-2 code had patterns like `initialBody={Array.isArray(doc.body) ? doc.body : null}` — these reject HTML strings and pass null, causing content-appearing-missing bugs. Trust the editor component's own `isHtmlString` / `renderBlockNoteHtml` normalization; don't filter at the page.
- **Tiptap's empty-document HTML is `"<p></p>"`, not `""`.** `!draft` truthiness checks fall through. Use `html.replace(/<[^>]+>/g, "").trim().length > 0` to detect meaningful content.
- **`html { overflow-x: clip }`, not `hidden`.** `overflow-x: hidden` creates a scroll container that breaks `position: sticky` for descendants in Safari/Chromium. `clip` clips overflow without making the element scrollable.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
