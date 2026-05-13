# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

**Session 110 (2026-05-13)** was member-area cleanup: rename Dashboard → Home, sweep dead links, strip Support Inbox tool residue. Pushed as `8d81ce3` on `main`. Vercel deploy in flight at session close.

- **Dashboard → Home rename** — Member sidebar, top nav (desktop + mobile + public-site Member Area dropdown), page title, tool back-link labels (`ToolsContext`, all three tool layouts), hub workspace footer link, public program-detail CTAs all updated. Admin vocabulary tracked: ProgramEditor's "Dashboard" tab → "Home Card" plus help-text rewrites; RolesSection hint reworded. URL `/account/dashboard` is unchanged — only the label moved.
- **Dead admin links gone** — Sidebar STAFF section lost `Roadmap` / `Banner` / `Editor Lab` (none of those pages ever existed in active code). Member-area top nav lost the entire Admin dropdown (the only two items inside, `/admin/sitemap` and `/admin/features`, were both already gone per `CLEANUP.md` §F). `Courses` and `Teachers` came out of the member-area top nav too — sidebar is now the authoritative member rail.
- **Support Inbox tool residue gone, hub itself stays** — `lib/toolRegistry.ts` (no more `inbox` entry), `lib/hubContext.ts` (no more `case "support":` primary-tool branch), `lib/manualGroups.ts` (no more support-team group), `HubHomeClient` orientation map, `RolesSection` + `CourseEditor` role pickers, `api/upload/route.ts` SUPPORT branch — all cleaned. Deleted `components/SupportInboxClient.tsx` (1,736 lines, no importers). `seed-hubs.ts` no longer seeds the two dead app-link rows; `seed-manual-chapters.ts` no longer creates the `support-inbox` ManualSection. One-time `migrate.mjs` migration `remove_support_inbox_residue` (idempotent via `_migration_flags`) cleans existing DB rows on next deploy. The Support Hub stays as a core-only workspace (Home, Conversations, Documents, Members) — same shape as any other tool-less hub.
- **Sanity status memorialized** — Wrote `memory/sanity-status.md` documenting that Sanity is effectively retired (per the post-Webflow-reversal state + `CLEANUP.md` #56) and listing every code-level residue point (`lib/sanity.ts`, `lib/queries.ts`, two public routes, `@sanity/client` package dep). Don't propose Sanity for new work.

**Next concrete step:** Maria training session per `TRAINING_PLAN.md` — still the primary milestone. Jesse confirms session 110 cleanup landed cleanly on production (sidebar shows "Home," hub workspace footer says "Back to Home," Support Hub renders without dead inbox card), then sets [TBD] training dates.

**Two cleanup follow-ons surfaced this session, parked for now:**

1. **Email template wording in DB** — `registrar-role-assigned` and reminder templates still contain "Your session link and full details are on your dashboard." / "**[Go to my dashboard →]({{dashboardUrl}})**". The `dashboardUrl` variable name is a contract between `lib/email.ts:434` and the DB template body — renaming requires coordinated edits. Safe path: edit each affected template at `/admin/emails` (UI), keep the binding name `dashboardUrl` for now or coordinate a rename in a dedicated pass.
2. **`SUPPORT` enum value in `prisma/schema.prisma:135`** — Still present. Removing a Prisma enum value while any user row references it in `roles[]` will crash. Needs a user-records audit (`SELECT id FROM users WHERE 'SUPPORT' = ANY(roles)`) before removal. Out of scope this session.

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
- **Storage paradigm for editor content is plain HTML strings.** `RimTiptapEditor` produces HTML directly via `editor.getHTML()`. Renderers accept both HTML and legacy BlockNote JSON via format detection — unmigrated rows still display correctly.
- **The selection bubble menu is the primary formatting surface in editors.** Top toolbar is for insertion-only actions (image, table, hr, callouts, dharma blocks). Don't put inline marks in both — duplicates discovery paths.
- **`useEditor` returns null on first render with `immediatelyRender: false`.** Any `useEffect` that touches refs INSIDE the rendered tree must include `editor` in deps so it re-runs after editor initialization (the early `if (!editor) return null` means refs are null on the first run).
- **`Array.isArray(body)` filters at page level will silently drop HTML.** Pre-Phase-2 code had patterns like `initialBody={Array.isArray(doc.body) ? doc.body : null}` — these reject HTML strings and pass null, causing content-appearing-missing bugs. Trust the editor component's own `isHtmlString` / `renderBlockNoteHtml` normalization; don't filter at the page.
- **Tiptap's empty-document HTML is `"<p></p>"`, not `""`.** `!draft` truthiness checks fall through. Use `html.replace(/<[^>]+>/g, "").trim().length > 0` to detect meaningful content.
- **`html { overflow-x: clip }`, not `hidden`.** `overflow-x: hidden` creates a scroll container that breaks `position: sticky` for descendants in Safari/Chromium. `clip` clips overflow without making the element scrollable.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
