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

The April directive committed to a Webflow + RIM Next hybrid. That decision has reversed: everything is in RIM Next. Items below were built specifically for the bridge.

| # | Item | Where | Action |
|---|---|---|---|
| 1 | `rim-connect.js` | `public/rim-connect.js` | Remove |
| 2 | Public-bridge API endpoints | `app/api/public/programs/route.ts`, `app/api/public/programs/[slug]/route.ts` | Remove |
| 3 | Public-API cache header pattern | The `s-maxage=300` + explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` block in those routes | Remove with the routes |
| 4 | Examples directory | `public/examples/rim-connect/` | Remove |
| 5 | Webflow Site Settings head code | Webflow Designer → Site Settings → Custom Code → Head Code (preconnect + hide-style + script tag) | Manual: remove in Webflow |
| 6 | Webflow staged pages | `/rim-next/Programs` and `/untitled/program-detail` on the live Webflow site | Manual: remove in Webflow |
| 7 | `RIM_Architecture_Directive.md` | Repo root | Mark superseded with a clear header, or delete entirely |
| 8 | `RIM_Webflow_Fields.md` | Repo root | Delete |
| 9 | `/atlas/` companion HTML files | `rim-atlas-v2.html`, `rim-layers.html`, `rim-stack.html` | Remove |
| 10 | `UP_NEXT.md` "Webflow weekly schedule" parked item | `UP_NEXT.md` "Next deliverable candidates" | Remove from list |
| 11 | `UP_NEXT.md` "Permanent reminders" Webflow lines | `UP_NEXT.md` bottom — "Webflow-primary for public/member-facing surfaces", audit-Webflow command, etc. | Remove |
| 12 | `CLAUDE.md` references to the directive | "Required reading" table and "Read `RIM_Architecture_Directive.md` first" instructions | Update or remove |

---

## Theme B — Google Meet removal

LiveKit replaced Google Meet in session 86. The Meet integration was never fully cleaned up.

| # | Item | Where | Action |
|---|---|---|---|
| 13 | `CreateMeetButton` component | `components/registrar/CreateMeetButton.tsx` | Remove + remove its render call sites |
| 14 | Google Meet API route | `app/api/programs-pg/google-meet/` | Remove |
| 15 | Google Meet env vars | Vercel env: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_ROOM_EMAILS`, `GOOGLE_CALENDAR_ID` | Remove from Vercel |
| 16 | Google service account in Google Cloud | Google Cloud Console — DWD-configured service account | Manual: revoke or delete in Google Cloud |
| 17 | Four shared room accounts | `meet1@`–`meet4@` Google Workspace accounts | Manual: archive or delete in Google Workspace |
| 18 | Google Meet code in `lib/` | Wherever Meet booking + calendar conflict logic lives (`lib/googleMeet*` likely) | Remove |
| 19 | Stack Reference Google Meet rows | `RIM_Stack_Reference.md` "Tech Stack" + "Environment Variables" + "Key External Integrations" Google entries | Update |

---

## Theme C — Verification of removed features

Things claimed-removed; verify nothing was missed before considering them closed.

| # | Item | Where | Action |
|---|---|---|---|
| 20 | `task-reminders` cron | `vercel.json` | Verify gone |
| 21 | `check-unassigned-hosts` cron | `vercel.json` | Verify gone |
| 22 | Gmail 5-min sync cron | `vercel.json` | Verify gone (removed s88) |
| 23 | `Task`, `TaskList`, `Subtask` models + `TaskStatus` enum | `prisma/schema.prisma` | Verify fully removed |
| 24 | `Alert` model + `AlertType` enum | `prisma/schema.prisma` | Verify fully removed |
| 25 | `/api/account/alerts` route | `app/api/account/alerts/` | Verify gone |
| 26 | `AlertStrip` component | `components/AlertStrip.tsx` and its render in `app/account/dashboard/page.tsx` | Verify gone (FEATURES section 6a still describes it as live) |
| 27 | `HubAnnouncement` model | `prisma/schema.prisma` | Verify gone (s72) |
| 28 | `HostThread`, `HostReply` models + routes + components | Schema, `/api/host/threads/*`, `/api/host/replies/*`, `HubThreadDetailClient.tsx` | Verify gone (s76) |
| 29 | `HubNavStrip`, `HubHeader` components | `components/` | Verify gone (s74) |

---

## Theme D — Direct code residue

Items definitively present and definitively unused.

| # | Item | Where | Action |
|---|---|---|---|
| 30 | `missing-reports` cron | `vercel.json` | Remove (UP_NEXT loose-end) |
| 31 | Four broken redirects | `vercel.json` — `/volunteer*`, `/account/registrar*` → `/account/hub/registrar/programs` (404s) | Remove or redirect to `/tools/programs` (UP_NEXT loose-end) |
| 32 | Legacy `/api/programs/` directory | `app/api/programs/` — should only contain iCal feed; anything else is pre-Postgres residue | Audit + remove non-iCal handlers |
| 33 | Host Schedule sub-nav residue | Removed Live Session and Journal tab routes from `app/tools/schedule/` | Verify removed; clean up any orphaned components |
| 34 | `legacyMemberstackId` field | `User` model, `prisma/schema.prisma` | Remove (never populated per FEATURES) |
| 35 | `/admin/manual/editor` vs per-section `/admin/manual/[slug]/edit` | `app/admin/manual/` | Pick one — likely the per-section edit; remove the other |

---

## Theme E — Decision-needed items (built, unclear if used)

Each is built infrastructure that may be active or may be dormant. A "are we using this?" decision determines whether it stays or joins the removal list.

| # | Item | Where | Decision |
|---|---|---|---|
| 36 | Support Inbox + supporting infrastructure | `/tools/inbox`, `/api/support/*`, Gmail OAuth env vars (`GMAIL_CLIENT_ID/CLIENT_SECRET/REDIRECT_URI`), `GmailCredential` model, Support Hub's two app links | Park indefinitely (status quo), simplify (e.g., remove sync entirely, keep schema), or remove the whole tool + hub link |
| 37 | Course drip system | `Course.dripEnabled`, `dripIntervalDays`, `Lesson.releaseDelayDays`, `Lesson.releaseDate`, `Course.hideLockedLessons`, `lib/drip.ts`, `drip-release` cron | Confirm any course actually uses drip. If not, remove. |
| 38 | `/admin/banner` + dashboard `SiteBannerStrip` | `app/admin/banner/`, `SiteBanner` + `SiteBannerDismissal` models, `components/SiteBannerStrip.tsx`, `/api/admin/site-banner`, `/api/site-banner/dismiss` | Confirm actual use. If banners are rare, the dismissal-tracking infrastructure may not earn its keep — could simplify to a single broadcast field on a config table. |
| 39 | `UserToolAccess` model + enforcement | Prisma schema, `lib/toolAuth.ts:hasToolAccess()` | Has no UI; managed only via Neon console. If never used in practice, remove. |
| 40 | `UserHubAccess` model | Prisma schema, Course Hub access logic | Confirm any actual usage. If not used, remove. |
| 41 | `sectionGrants String[]` field on User | Prisma schema, `lib/memberSectionRegistry.tsx` | Has no UI; designed for future per-viewer grants. If no current need, remove. |
| 42 | `/admin/editor-lab` | `app/admin/editor-lab/` | Tiptap migration complete. If never opened post-migration, remove. |
| 43 | Memberstack CSV import | `app/admin/members/MemberImport.tsx`, `/api/admin/members/import/route.ts` | Given the membership philosophy ("members appear naturally"), unlikely to be used again. Keep for one-time historical import or remove. |
| 44 | Phase 2 scaffolding models | `MembershipType`, `UserMembership`, `AttendanceRecord` + enums in `prisma/schema.prisma` | Schema present, no UI, no app code. If not on the near-term roadmap, remove. |
| 45 | `Donation` table without read UI | Prisma schema; receives Stripe writes from registration dana | Either commit to building the donation management UI (separate decision) or accept it as a write-only ledger. |

---

## Theme F — Documentation cleanup

| # | Item | Where | Action |
|---|---|---|---|
| 46 | `RIM_Hub_Model.md` | Repo root | Significant rewrite: hub count (4, not 14+2), remove Tasks references, add Manual section, update §13 inventory, update §10 core sections, update §12 mobile patterns, update §15 schema reference |
| 47 | `RIM_Feature_Interconnections.md` | Repo root | Remove BlockNote primary-editor description, remove Tasks from hubs, remove `AlertStrip` reference |
| 48 | `RIM_System_Architecture.md` | Repo root | Resolve s73-vs-s76 inconsistency on Registrar Hub stakeholder tab |
| 49 | `FEATURES.md` | Repo root | Comb for Webflow-pivot framing throughout (multiple sections still describe pages "moving to Webflow"); remove or update each. Verify section 6a (`AlertStrip`) matches actual code state. |
| 50 | `/admin/sitemap` content | `app/admin/sitemap/page.tsx` (data is in-file constants) | Either commit to ongoing maintenance, or retire — overlapping with `/admin/manual` and `/admin/features` |
| 51 | `/admin/features` content | `app/admin/features/page.tsx` | Same: maintain or retire (built s30, no maintenance pattern, almost certainly stale on Tasks/Alerts/BlockNote/Meet/Webflow) |
| 52 | Inter vs. Open Sans drift | `RIM_Stack_Reference.md` says Open Sans; `RIM_Feature_Interconnections.md` says Inter | Resolve against code |

---

## Theme G — Future-removable (tracked, not for now)

Items that will be removable later, after a precondition is met. Tracked here so they don't get forgotten.

| # | Item | Where | Precondition |
|---|---|---|---|
| 53 | Multi-format editor renderer | `lib/renderRichContent.ts`, `lib/renderRichContentServer.ts` | All content rows are HTML (no remaining BlockNote JSON) |
| 54 | BlockNote-JSON-only export converter | `app/api/hub/[slug]/documents/[id]/export/route.ts` | Either fix to handle HTML or wait until #53's precondition |
| 55 | Legacy CSS shim | Bottom of `public/css/custom.css` (~25 Webflow classes for ~15 unredesigned pages) | All ~15 pages have had their design pass |
| 56 | Sanity programs/courses/lessons schemas | Sanity studio | After old documents in the dataset are confirmed unused; programs/courses/lessons all migrated to Postgres, but Sanity schemas remain |
| 57 | `BASE_URL` whitespace-trim defensive code | 5 places in `lib/` and `app/api/` | After `NEXTAUTH_URL` env var itself is cleaned at the source in Vercel project settings (UP_NEXT loose-end) |

---

## Theme H — Meta-finding (closing ritual)

| # | Item | Where | Action |
|---|---|---|---|
| 58 | Closing ritual has no hook for strategic-policy-level documents | `CLAUDE.md` "Closing Ritual" section | Add a step: when an architectural/strategic decision is made or reversed, identify the authoritative doc(s) and update or supersede. The current ritual catches feature-level changes via `FEATURES.md` / `RIM_Stack_Reference.md` / `RIM_System_Architecture.md`, but a directive going stale wasn't anyone's job. |

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
