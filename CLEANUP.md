# RIM Cleanup Queue

**What this file is.** A static reference of items in the RIM Next system — code, schema, config, integrations, documentation — that exist as residue and are candidates for removal. Every item is decision-ready: confirm or override, then execute.

**What this file is not.** Not a backlog of new work. Not a list of features to build. Items that were *planned but never built* are tracked at the bottom of this file under **"Not on this list"** and should not be treated as residue.

**When to read this.** At the start of any session whose purpose is cleanup, refactor, or schema/config maintenance. Skip when the session is feature work — cleanup belongs in its own dedicated session, not interleaved with feature development.

**How to use it.**

- Items are stable-numbered. Sessions can be scoped by item number (*"this session is items 1–4 and 7"*) or by theme (*"Theme A this session"*).
- When an item is fully resolved, remove it from this file in the same commit that resolves it. Don't leave struck-through residue in the residue file.
- If a "decision-needed" item resolves to *keep*, remove it from the file. If it resolves to *remove*, do the work and then remove it from the file.
- If new residue is identified during ongoing work, add it here as a new item (continue numbering — don't reuse retired numbers).

**Origin.** This list was generated in a single inventory pass on May 6, 2026, after the architectural reversal of the April Webflow + RIM Next hybrid. It is intended to be a working tool for the cleanup that pivot left behind, plus drift accumulated during the months the directive was in effect.

---

## Theme A — Webflow-bridge removal

All items resolved in session 102. Notes:

- **#1** `rim-connect.js` — already removed before session 102 (part of the pivot reversal)
- **#2** Public-bridge API endpoints — already removed before session 102
- **#3** Public-API cache header pattern — removed with the routes
- **#5** Webflow Site Settings head code — removed manually in Webflow Designer (session 102)
- **#6** Webflow staged pages `/rim-next/Programs` and `/untitled/program-detail` — removed manually in Webflow (session 102)

---

## Theme B — Google Meet removal

LiveKit replaced Google Meet in session 86. Code-level removal is complete (items #13, #14, #18 were already gone; #19 doc update done session 100). Manual items remain:

| # | Item | Where | Action |
|---|---|---|---|
| 15 | Google Meet env vars | Vercel env: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_ROOM_EMAILS`, `GOOGLE_CALENDAR_ID` | Remove from Vercel |
| 16 | Google service account in Google Cloud | Google Cloud Console — DWD-configured service account | Manual: revoke or delete in Google Cloud |
| 17 | Four shared room accounts | `meet1@`–`meet4@` Google Workspace accounts | Manual: archive or delete in Google Workspace |

---

## Theme D — Direct code residue

All items resolved in session 100. Notes:

- **#31** Four broken redirects — updated to `/tools/programs` and `/tools/programs/:slug`
- **#32** `/api/programs/` audit — all three routes active (iCal, registrations CSV, manual reminder trigger); kept
- **#33** Host Schedule residue — already clean; no orphaned components
- **#34** `legacyMemberstackId` — blocked on #43 (Memberstack CSV import); field is referenced in the import route; resolve together with #43
- **#35** `/admin/manual/editor` — removed; per-section edit (`/admin/manual/[slug]/edit`) is the current approach; new sections created via seed script

---

## Theme E — Decision-needed items (built, unclear if used)

All items resolved in session 100. Notes:

- **#36** Support Inbox — removed entirely. Routes, lib files, schema models, and Support Hub app links all deleted. Gmail OAuth env vars (`GMAIL_CLIENT_ID/CLIENT_SECRET/REDIRECT_URI`) remain in Vercel and need manual removal.
- **#37** Course drip system — removed. No courses were using it. Schema columns, `lib/drip.ts`, `drip-release` cron, and all UI in CourseEditor/LessonEditor deleted.
- **#38** Site Banner — removed. `/admin/banner/`, `SiteBannerStrip`, schema models, and API routes all deleted.
- **#39** `UserToolAccess` — kept. Intended for future use; managed via Neon console.
- **#40** `UserHubAccess` — removed. HubMember is the authoritative model; UserHubAccess was unenforced and unused.
- **#41** `sectionGrants String[]` — kept. Has no UI yet but is a deliberate future hook; field is cheap to keep.
- **#42** `/admin/editor-lab` — removed.
- **#43** Memberstack CSV import — removed. `MemberImport.tsx` and import route deleted. `legacyMemberstackId` field also removed from schema.
- **#44** Phase 2 scaffolding — removed. `MembershipType`, `UserMembership`, `AttendanceRecord` and their enums all dropped.
- **#45** `Donation` table — kept as write-only ledger. Receives Stripe writes from registration dana flow. A read UI is "Not on this list" for now.

---

## Theme F — Documentation cleanup

All items resolved in session 101. Notes:

- **#46** `RIM_Hub_Model.md` — rewritten: hub count corrected (14 operational + 2 governance), Tasks removed from all sections, Support Inbox removed, core sections updated to 4 (not 5), RimProseEditor → RimTiptapEditor, BlockNote JSON → HTML, UserHubAccess removed, §13 Support Hub tools cleared, §15 schema rows for UserHubAccess/TaskList/Task/Subtask removed
- **#47** `RIM_Feature_Interconnections.md` — Tasks removed from Hubs, Support Inbox section deleted, Editor System rewritten (Tiptap primary), Email System Gmail reference removed, Learning System BlockNote → Tiptap, CSS Architecture Inter → Open Sans, Webflow migration reference replaced with legacy shim note
- **#48** `RIM_System_Architecture.md` — s73-vs-s76 inconsistency resolved in "What's Next"; hub count updated; /tools/inbox removed from tools list; hub-access removed from member profile section registry; Tasks removed from Hub Model section list
- **#49** `FEATURES.md` — Phase 2 scaffolding models (MembershipType, UserMembership, AttendanceRecord) removed from §7; Memberstack import removed from §11; MemberImport.tsx references removed; legacyMemberstackId removed; Support Inbox §29 updated from PARKED → REMOVED; Site-Wide Banner §36 marked as removed; Tools table updated (Support Inbox row removed); AlertStrip §35 Alert-model note corrected
- **#50** `/admin/sitemap` — already removed (page does not exist in codebase)
- **#51** `/admin/features` — already removed (page does not exist in codebase)
- **#52** Inter vs. Open Sans — fixed in `RIM_Feature_Interconnections.md` (was Inter, now correctly Open Sans)

---

## Theme G — Future-removable (tracked, not for now)

Items that will be removable later, after a precondition is met. Tracked here so they don't get forgotten.

| # | Item | Where | Precondition |
|---|---|---|---|
| 53 | Multi-format editor renderer | `lib/renderRichContent.ts`, `lib/renderRichContentServer.ts` | All content rows are HTML (no remaining BlockNote JSON) |
| 55 | Legacy CSS shim | Bottom of `public/css/custom.css` (~25 Webflow classes for ~15 unredesigned pages) | All ~15 pages have had their design pass |
| 56 | Sanity programs/courses/lessons schemas | Sanity studio | After old documents in the dataset are confirmed unused; programs/courses/lessons all migrated to Postgres, but Sanity schemas remain |
| 57 | `BASE_URL` whitespace-trim defensive code | 5 places in `lib/` and `app/api/` | After `NEXTAUTH_URL` env var itself is cleaned at the source in Vercel project settings (UP_NEXT loose-end) |

---

## Not on this list

For reference: items flagged during inventory that are *absences* (planned or discussed, never built) rather than residue. Each is a "still wanted?" question for a strategy conversation, not a cleanup session.

- Self-service email change (`FEATURES.md` 11b)
- Donation Management UI (`FEATURES.md` 13)
- Volunteer Interest Form backend (`FEATURES.md` 15a — form exists, has no API)
- Kalyana Mitta Group Detail Form (`FEATURES.md` 15a)
- Access Denied / 401 page (`FEATURES.md` 15a)
- My Library rebuild (`FEATURES.md` 15a — `/account/dashboard-my-library` is currently a hardcoded stub)
- Tool home context cards (`RIM_Hub_Model.md` §11 — proposed `/api/tools/<tool>/context` endpoints)
- `UserToolAccess` admin grant UI (related to item #39 above — if #39 resolves to "remove the model," this absence resolves automatically)
- Hub `coordinatorNotes` field + editor (`UP_NEXT.md` smaller items)
- Schedule display marking paused hosts (`UP_NEXT.md` smaller items)
- Auth-aware Program Detail CTA `data-rim-member-cta` (`UP_NEXT.md` — was for Webflow; if a member CTA is still wanted on `/programs/[slug]`, that's a fresh design)
- Stage 2d editor blocks: Announcement, EarlyArrival, DanaInvitation (`UP_NEXT.md`)
- Editor toolbar polish (`UP_NEXT.md`)

---

*Working document · Started May 6, 2026.*
*Companion to: `UP_NEXT.md`, `FEATURES.md`, `session-log.md`.*
