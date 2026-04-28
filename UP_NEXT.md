# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Phase 2 of the Tiptap editor migration (2026-04-27)

Phase 1 closed at the end of session 96. The canonical `RimTiptapEditor` is built and live in the Editor Lab in three variants. Production surfaces are still on `RimBlockEditor` / `RimProseEditor` (BlockNote). Phase 2 starts the migration of real surfaces and the one-time conversion of existing data.

### Status at session end

- `components/rim-tiptap/RimTiptapEditor.tsx` — three variants (`minimal` / `message` / `document`), one pinned top toolbar, three dropdowns (Heading, Callout, Dharma block), Bear-style selection bubble for `minimal`. Storage = plain HTML strings.
- Five custom block extensions in `components/rim-tiptap/extensions/` — Callout (note + decision), PullQuote, VerseQuote, PracticeSuggestion, Reflection. Output classes are shared between editor and rendered HTML.
- Editor Lab `/admin/editor-lab` — three tabs, sample content, live render pane, raw HTML output pane. The review surface for editor-side feedback before any migration.
- `RimBlockEditor` and `RimProseEditor` still in production. Untouched.

### Next concrete steps for Phase 2

1. **Render path.** Build `lib/renderRichContentTiptap.ts`. HTML pass-through with sanitization (existing content is trusted but the renderer sets the contract for Phase 5 imports). Allow the same set of elements + classes the editor produces; strip everything else.
2. **Format detection at the boundary.** In `lib/renderRichContent.ts` and `lib/renderRichContentServer.ts`, add a `isHtmlString(value)` check before the existing `isBlockNoteJSON(value)` branch. HTML strings route to the Tiptap renderer; JSON arrays continue through the BlockNote pipeline. Single switch — both formats coexist during migration.
3. **First migration target: `Hub.welcomeBody`.** Smallest blast radius — used in two places (`HostHubHomeClient` inline edit, `HubAdminForm` admin form). Swap both to `RimTiptapEditor variant="message"`. Walk existing `Hub` rows, server-render the BlockNote JSON to HTML, write back. Idempotent migration with a flag.
4. **Then `Hub.homeContent`** — same pattern, different field. Used only in `HubAdminForm`.
5. **Then `HubConversationThread.body` + `HubConversationReply.body`** — higher row count (~hundreds) but same shape. `HubConvClient.tsx` and `HubConvThreadClient.tsx` swap to `RimTiptapEditor variant="message"`.

After step 5, Hub Message surfaces are fully migrated. That's the Phase 2 done line. Phase 3 (hub documents + manual sections, `variant="document"`) follows.

### Decisions still open going into Phase 2

- **Sanitization library.** `sanitize-html` is the obvious choice; we're trusting current writers but not external paste content (Tiptap's HTML serializer + the schema do most of the work, but a paste of arbitrary HTML can carry attribute payloads we don't want). Decide before building the renderer.
- **`renderFormattedTextAsync` signature.** It currently dispatches by content shape. The Phase 2 detection adds an `htmlString` branch. Verify call sites still work without explicit format flags — they should, since the value is the only input.
- **`extractTextAsync`** (used for plain-text excerpts and email message bodies) needs an HTML-strip path. `marked` isn't relevant; either `node-html-parser` or a small regex-based stripper. Plain text out, no styling.

### Files to know going into Phase 2

- `components/rim-tiptap/RimTiptapEditor.tsx` — the new editor.
- `components/rim-tiptap/extensions/*.ts` — the custom blocks.
- `lib/renderRichContent.ts` + `lib/renderRichContentServer.ts` — current renderers; Phase 2 adds the HTML branch here.
- `lib/email.ts` — uses `renderFormattedTextAsync` for some fields; will read the new format transparently once Phase 2 dispatch is wired.
- `app/admin/editor-lab/page.tsx` — review surface for the editor itself.
- `prisma/migrate.mjs` — host the row-conversion migration alongside the existing flagged migrations.

---

## Other open threads (pickable, not blocking)

### Webflow weekly schedule (deferred from session 95)

Still real work, still designed but not built. Carries forward unchanged from session 95:

- New endpoint `/api/public/programs/weekly` returning the next 7 days grouped by weekday. Reuse `lib/scheduleUtils.ts::isOccurrenceOnDate()`. Copy cache headers from the existing programs endpoints.
- Default to grouped-list (`data-rim-group-list="weekly"`) over a new `data-rim-weekly-list` primitive. Only add a primitive if grouped-list can't express the design.
- Jesse designs the Webflow page. Recommended path: duplicate `/rim-next/Programs` as `/rim-next/weekly-schedule`, point grouped-list at the new endpoint.
- Programs listing page slug is still `Programs` (capital P) → publishes to `/rim-next/Programs`. Lowercase before it bites.
- Auth-aware CTA on Program Detail (member states: registered / waitlisted / pending dana / join session) is still tracked in backlog item `2026-04-24-001`. Not urgent for the weekly view.

### Vercel `NEXTAUTH_URL` env var has a trailing space

Confirmed root cause of the broken sub-request link. The code is now defensive (every `BASE_URL` is `.trim().replace(/\/$/, "")`), but the env var itself should still be cleaned at the source so future surfaces that don't go through the trimmed constants don't pick up the same bug. One-time edit in Vercel project settings.

### Smaller items still parked

- **Schedule display of paused hosts** — `HubScheduleClient` doesn't visually mark assignments where the host is paused or `hostingCapability = false`.
- **Stage 2d editor blocks** — Announcement, EarlyArrival, DanaInvitation. Not blocked by the Tiptap migration; in fact they'd be cleaner to build on Tiptap. Wait for Phase 4 (Page Designer surfaces) so they land natively in the new editor.
- **Coordinator notes area** — `Hub.coordinatorNotes Json?` (or HTML, post-Phase-2) + coordinator-only editor surface.
- **Duplicate-Aside backlog item** — Editor allows inserting an Aside immediately after another Aside. May not apply post-Tiptap-migration; revisit in Phase 4.

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
- **Storage paradigm for new editor surfaces is plain HTML strings**, not BlockNote JSON. The new `RimTiptapEditor` produces HTML directly. Existing BlockNote JSON columns remain valid until Phase 2/3/4 migrate them.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
