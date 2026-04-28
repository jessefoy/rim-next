# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

Nothing actively in flight. The Tiptap editor migration (Phases 1–4) closed at the end of session 97 (2026-04-28). Every editor surface in the platform now runs on `RimTiptapEditor` (one component, three variants: `minimal` / `message` / `document`, HTML storage, selection bubble menu). `RimBlockEditor`, `RimProseEditor`, and the `@blocknote/*` deps are deleted.

Pick from the open threads below.

---

## Next deliverable candidates

### Webflow weekly schedule (parked from session 95)

Still real work, still designed but not built. The Programs listing in Webflow works; the next public-facing page Jesse wants to design is the weekly schedule. Concrete shape:

- New endpoint `/api/public/programs/weekly` returning the next 7 days grouped by weekday. Reuse `lib/scheduleUtils.ts::isOccurrenceOnDate()`. Copy cache headers from the existing programs endpoints (`s-maxage=300, stale-while-revalidate=86400` plus explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control`).
- Default to grouped-list (`data-rim-group-list="weekly"`) over a new `data-rim-weekly-list` primitive. Only add a primitive if grouped-list can't express the design.
- Jesse designs the Webflow page. Recommended path: duplicate `/rim-next/Programs` as `/rim-next/weekly-schedule`, point grouped-list at the new endpoint.
- Programs listing page slug is still `Programs` (capital P) → publishes to `/rim-next/Programs`. Lowercase before it bites.

This is self-contained work that doesn't depend on anything else. Good standalone session.

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

### Auth-aware Program Detail CTA

Tracked in backlog (`2026-04-24-001`). The Program Detail page in Webflow needs an authenticated CTA — different states for: not registered, registered, waitlisted, pending dana, ready to join session. Currently uses a static "Register" button.

Approach: extend `rim-connect.js` with a `data-rim-member-cta` element + `/api/member/programs/[slug]/cta` endpoint that returns the right CTA shape for the signed-in member. Or embed the existing `RegisterButton` Next.js component via iframe.

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

- **Webflow-primary for public/member-facing surfaces.** Do not tune `app/programs/[slug]/page.tsx` or other Webflow-destined pages in the Next.js CSS. Changes go to the API + `rim-connect.js` + Webflow.
- **API cache policy.** `/api/public/*` endpoints default to `s-maxage=300, stale-while-revalidate=86400` plus explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` headers.
- **`[data-rim-page]` is invisible until `.rim-ready`.** Wrapper element must carry `data-rim-page="collection"` or similar.
- **Audit Webflow by reading the shipped HTML.** `curl -sL <url> | grep -oE 'data-rim-[a-z]+="[^"]*"' | sort -u` is authoritative.
- **Webflow MCP does not expose navigator labels.** Element renames are a manual double-click in the Webflow Designer.
- **Browser cache on Webflow pages is sticky.** Stale 404s persist through hard refresh — incognito or DevTools clear-site-data fixes it.
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
