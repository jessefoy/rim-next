# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Weekly Schedule page in Webflow (2026-04-24)

Next session is the weekly view. Program Detail is live in Webflow at `/rim-next/program-detail`, the Programs listing is live at `/rim-next/Programs` (see naming note below), and Jesse is ready to design the weekly schedule page. The `rim-connect.js` v3 bridge, API cache policy, and Webflow site-wide head code all carry over unchanged — this is a data + template pass, not an architecture change.

### What needs to exist before the Webflow design pass

1. **New API endpoint: `/api/public/programs/weekly`** — returns the next 7 days (or `?week=next` for the following Monday–Sunday block) grouped by weekday. Per-day array contains one row per program occurrence with: `slug`, `name`, `scheduleLabel`, `timeLabel`, `formatLabel`, `locationLabel`, `category.name`, `programImage` (optional), and `ctaHtml` (if we want a detail-link CTA inline — otherwise just link via `data-rim-href="/rim-next/program-detail?slug=[slug]"`).

   Reuse `lib/scheduleUtils.ts::isOccurrenceOnDate()` — it already handles weekly / daily / bi-weekly / monthly / one-time recurrence and is the same function `/this-week` and `/tools/schedule` use.

   Copy cache headers from `app/api/public/programs/route.ts`: `s-maxage=300, stale-while-revalidate=86400` plus the explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` headers.

2. **`rim-connect.js` extension: grouped-by-day list support** — two options:
   - **Simpler:** reuse the existing `data-rim-group-list` pattern (already implemented for programs-by-category). The endpoint returns `{ grouped: [{ day: "Monday", date: "2026-04-27", programs: [...] }, ...] }` and Webflow uses `data-rim-group-list="weekly"` + `data-rim-group-field="day"` / `"date"`. No bridge changes needed.
   - **New:** add a `data-rim-weekly-list` primitive if the group pattern doesn't fit the design Jesse wants. Only do this if grouped-list can't express it.

   Default to option 1 until it breaks.

3. **Webflow page** — Jesse creates it. Recommended path: duplicate the Programs listing page (`/rim-next/Programs`) as `/rim-next/weekly-schedule`, swap `data-rim-list="programs"` for the grouped variant, and restyle per weekly-view intent. Hero + card styling copies over.

### Starting point for the weekly-view session

1. Decide on grouped-list vs new primitive (almost certainly grouped-list).
2. Write `app/api/public/programs/weekly/route.ts`. Test directly: `curl https://rim-next.vercel.app/api/public/programs/weekly` should return grouped data.
3. Confirm `rim-connect.js` renders it correctly against a sandbox Webflow page (or test from the listing page by pointing `data-rim-group-list` at the new endpoint).
4. Hand off to Jesse for Webflow design.

### Naming lint on the listing page (pickable any time)

- Webflow folder slug is now `rim-next` (fixed this session — was `untitled`).
- Programs listing page slug is `Programs` with a capital P → publishes to `/rim-next/Programs`. URLs are case-sensitive on most clients. Change the page slug to lowercase `programs` so the URL is `/rim-next/programs`, then re-point any `data-rim-href` that references the listing.
- Program Detail page slug is lowercase `program-detail` already — good.

### Program Detail — still open from session 95

- **Auth-aware CTA.** Guest states are covered by `ctaHtml`. Member states (registered / waitlisted / pending dana / join session) still need a mechanism. Tracked in backlog item `2026-04-24-001`. Decision is deferred until the broader Webflow-auth bridge is designed — this is not urgent for the weekly view.
- **Optional fields Webflow isn't using yet.** `locationLink`, `formatLabel`, `teacherNames`, `specialAnnouncement` — data ships, placements are up to Jesse.

### Small open threads from session 93 (still pickable, still not required)

- **Schedule display of paused hosts** — `HubScheduleClient` still renders assignments without a visual cue when the assigned host is paused or has `hostingCapability = false`. Consider a marker on the session card.
- **Coordinator notes area (dedicated editor)** — Phase 5 placeholder points at Documents. Real implementation would need a `Hub.coordinatorNotes Json?` field + coordinator-only editor surface.
- **Editor/block work from session 90's queue** — Stage 2d blocks (Announcement, EarlyArrival, DanaInvitation, etc.), `TeacherProfile.bio` + `Course.completionNote` schema promotions, terminal `<EditorField>` code-level gate.
- **Duplicate-Aside backlog item** — Editor allows inserting an Aside immediately after another Aside; product question whether that's ever intended.

### Permanent reminders (still true)

- **Webflow-primary for public/member-facing surfaces.** Do not tune `app/programs/[slug]/page.tsx` or other Webflow-destined pages in the Next.js CSS. Changes go to the API + `rim-connect.js` + Webflow.
- **API cache policy.** `/api/public/*` endpoints default to `s-maxage=300, stale-while-revalidate=86400` plus explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` headers. Copy from the programs routes if adding a new one.
- **`[data-rim-page]` is invisible until `.rim-ready`.** If building a new Webflow detail page, the wrapper element must carry `data-rim-page="collection"`. The fade-in is automatic.
- **Audit Webflow by reading the shipped HTML.** `curl -sL <url> | grep -oE 'data-rim-[a-z]+="[^"]*"' | sort -u` is authoritative. Don't ask Jesse to recall attribute-level details.
- **Webflow MCP does not expose navigator labels.** Element renames (e.g. "Section" → "Programs Hero") are a manual double-click in the Webflow Designer. Don't promise MCP can do it.
- **Browser cache on Webflow pages is sticky.** If a URL used to 404 and the folder slug was later renamed, Cloudflare + disk cache will keep serving the stale 404. Fix is incognito or DevTools → Application → Clear site data. This is not a `rim-connect.js` issue — the bridge caches JSON at Vercel's edge, not the HTML.
- **Hub membership is authoritative when it exists.** (from session 93)
- **No-delete policy.** Never call `db.hubMember.delete()` outside the ADMIN-only route. (from session 93)

### Files worth keeping in mind

- `RIM_Architecture_Directive.md` — the policy.
- `RIM_Webflow_Fields.md` — attribute + payload reference.
- `public/rim-connect.js` — the bridge (v3, grouped-list support already present).
- `app/api/public/programs/[slug]/route.ts` — detail endpoint + cache template.
- `app/api/public/programs/route.ts` — list endpoint + grouped `?grouped=1` variant (reference for the weekly endpoint).
- `lib/scheduleUtils.ts` — shared `isOccurrenceOnDate()`; use it, don't reimplement.
- `app/this-week/page.tsx` — existing Next.js weekly view; data-shape reference for the new endpoint.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
