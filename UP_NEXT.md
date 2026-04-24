# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Program Detail in Webflow — next session's first task (session 94 closing, 2026-04-24)

The Webflow-primary architecture is **committed** as of session 94, not tentative. No more porting Webflow designs into the Next.js `/programs/[slug]` route. The next session starts with Jesse designing Program Detail directly in Webflow, using `data-rim-*` bindings to the existing `/api/public/programs/[slug]` endpoint.

### What's already in place

- **API:** `/api/public/programs/[slug]` returns every field needed for the public detail page. Cache policy: `s-maxage=300, stale-while-revalidate=86400`, explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` headers, ~115ms cached response times.
- **`rim-connect.js` v3:** detail-page support via `data-rim-page="programs"` + field/html/href/bg/src/show/hide bindings. Hide-until-populated: `[data-rim-page]` containers fade in when data arrives (120ms transition), with a 1500ms safety timeout.
- **Webflow site-wide head code:** preconnect + inline hide-style + `rim-connect.js` script tag. Placed once in Site Settings → Custom Code → Head Code; no page-level custom code needed for data bindings.
- **Webflow field reference:** `RIM_Webflow_Fields.md` at project root documents every `data-rim-*` attribute and the payload shape. Keep that updated when the API adds fields.

### What's unresolved — decide before building the CTA

The one genuinely hard piece on the Program Detail page is the **auth-aware CTA**. The current `/api/public/programs/[slug]` endpoint returns a `ctaHtml` string for guests only (Register / Members access Zoom / Simply arrive). For a signed-in viewer, it should reflect: "You're registered →", "Pending dana →", "Join session →", "Waitlisted", etc. Options:

1. **Second endpoint — `/api/member/programs/[slug]`** — reads the NextAuth cookie, returns member-specific CTA HTML. `rim-connect.js` merges it client-side over the public CTA. Requires cookie scoping to work cross-domain (`.rootedinmindfulness.org` once domains are settled; during transition on `rim-next.vercel.app`, cross-origin cookies are the tricky part).
2. **Next.js-hosted CTA embed** — a tiny iframe or `<script>` from RIM Next that renders just the CTA block, using the existing session flow. Works today, no cross-domain cookie work, but feels heavier.

Jesse and Claude should pick one before the next Program Detail session starts.

### Starting point for the next Program Detail session

1. Confirm the CTA approach (option 1 vs option 2 above).
2. Jesse begins designing the Webflow Program Detail from scratch. No visual reference to the Next.js version — the Next.js page exists only as a data preview until the Webflow version ships.
3. For each field Jesse wires up, verify it exists in the API payload. If not, extend the API + this file's field reference together.
4. Test with at least three programs of different types (drop-in, registration-required, hybrid, virtual) to catch CTA branching.
5. Once shipped, delete `app/programs/[slug]/page.tsx` — this is the cutover moment for that one surface.

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

### Files worth keeping in mind for the next task

- `RIM_Architecture_Directive.md` — the policy.
- `RIM_Webflow_Fields.md` — attribute + payload reference.
- `public/rim-connect.js` — the bridge (v3).
- `app/api/public/programs/[slug]/route.ts` — the endpoint + cache template.
- `app/api/public/programs/route.ts` — list endpoint + grouped `?grouped=1` variant.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
