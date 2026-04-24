# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Program Detail live in Webflow — CTA and cleanup pending (2026-04-24)

Jesse rebuilt the Program Detail page in Webflow between sessions and wired the `data-rim-*` bindings per [RIM_Webflow_Fields.md](RIM_Webflow_Fields.md). The page is live and fetching from `/api/public/programs/[slug]`. The Webflow-primary architecture is **committed** (session 94) — no more porting Webflow designs into the Next.js `/programs/[slug]` route.

### What's wired (audited from published HTML 2026-04-24)

- **Hero:** `programImage` (bg), `category.name`, `name`, `tagline` (+ show)
- **Pull quote:** `pullQuote` (+ show), `pullQuoteSource`
- **Description:** `descriptionHtml` (Div Block + `data-rim-html`, no show wrapper)
- **Program notes:** `programNotesHtml` (+ show) — wired, rich-text
- **Details:** `scheduleLabel`, `timeLabel`, `locationLabel` (+ show), `danaText` (+ show)
- **CTA:** `ctaHtml` (+ show) — one-element drop-in, covers all guest states (register / closed / "simply arrive" / members access)

Full attribute list and field inventory in [RIM_Webflow_Fields.md](RIM_Webflow_Fields.md).

### Fields the API returns but aren't placed on the page yet

Optional additions for a future pass:

- **`locationLink`** — map link href for in-person venues (currently no map link on page)
- **`formatLabel`** — explicit "In-Person" / "Zoom Only" / "In-Person & Zoom" row (format is implied by `locationLabel` today)
- **`teacherNames`** — facilitators section (comma-separated string)
- **`specialAnnouncement`** — one-off announcement banner

### What's unresolved — the auth-aware CTA

The current `/api/public/programs/[slug]` endpoint returns guest-only CTA logic. For a signed-in viewer, the CTA should reflect "You're registered →", "Pending dana →", "Join session →", "Waitlisted", etc. Options:

1. **Second endpoint — `/api/member/programs/[slug]`** — reads the NextAuth cookie, returns member-specific CTA HTML. `rim-connect.js` merges it client-side over the public CTA. Requires cookie scoping (`.rootedinmindfulness.org`) to work cross-domain.
2. **Next.js-hosted CTA embed** — a tiny iframe or `<script>` from RIM Next that renders just the CTA block. Works today, no cross-domain cookie work, but feels heavier.

Pick one before building.

### Starting point for the next Program Detail session

1. Confirm the CTA approach (option 1 vs option 2 above).
2. Implement chosen approach and wire it into the Webflow page.
3. Test with at least three programs of different types (drop-in, registration-required, hybrid, virtual) to catch CTA branching.
4. Once verified across auth states, delete `app/programs/[slug]/page.tsx` — the cutover moment for that surface.

### Small open threads from session 93 (still pickable, still not required)

- **Schedule display of paused hosts** — `HubScheduleClient` still renders assignments without a visual cue when the assigned host is paused or has `hostingCapability = false`. Consider a marker on the session card.
- **Coordinator notes area (dedicated editor)** — Phase 5 placeholder points at Documents. Real implementation would need a `Hub.coordinatorNotes Json?` field + coordinator-only editor surface.
- **Editor/block work from session 90's queue** — Stage 2d blocks (Announcement, EarlyArrival, DanaInvitation, etc.), `TeacherProfile.bio` + `Course.completionNote` schema promotions, terminal `<EditorField>` code-level gate.
- **Duplicate-Aside backlog item** — Editor allows inserting an Aside immediately after another Aside; product question whether that's ever intended.

### Permanent reminders (still true)

- **Webflow-primary for public/member-facing surfaces.** Do not tune `app/programs/[slug]/page.tsx` or other Webflow-destined pages in the Next.js CSS. Changes go to the API + `rim-connect.js` + Webflow.
- **API cache policy.** `/api/public/*` endpoints default to `s-maxage=300, stale-while-revalidate=86400` plus explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` headers. Copy from the programs routes if adding a new one.
- **`[data-rim-page]` is invisible until `.rim-ready`.** If building a new Webflow detail page, the wrapper element must carry `data-rim-page="collection"`. The fade-in is automatic.
- **Hub membership is authoritative when it exists.** (from session 93)
- **No-delete policy.** Never call `db.hubMember.delete()` outside the ADMIN-only route. (from session 93)

### Files worth keeping in mind

- `RIM_Architecture_Directive.md` — the policy.
- `RIM_Webflow_Fields.md` — attribute + payload reference.
- `public/rim-connect.js` — the bridge (v3).
- `app/api/public/programs/[slug]/route.ts` — the endpoint + cache template.
- `app/api/public/programs/route.ts` — list endpoint + grouped `?grouped=1` variant.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
