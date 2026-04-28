# RIM Next — Stack Reference

_Generated 2026-03-11. Last updated 2026-04-20 (session 89)._

---

## What's been built

Rooted In Mindfulness (RIM) is a community Insight Meditation center in Brookfield, WI. This Next.js application is the future home of the entire RIM digital presence — programs, member accounts, registrations, online courses, and volunteer tooling. As of this writing, the application includes a full program registration system (with waitlisting, dana/Stripe payments, calendar links, and automated emails), a member dashboard and profile system, a Registrar Hub for managing participants (migrated into the multi-hub system with stakeholder visibility), an admin area for member management (with households, status, tags, and role assignment), a Postgres-backed course and lesson library (migrated from Sanity, managed via Teacher Hub with a rich Markdown editor), a staff reference manual, a site architecture/feature inventory for admins, a Google Meet integration for virtual programs, a Host Community Hub — a full team workspace for the volunteer host team with a calendar schedule, sub board, conversations, and alerts, a Support Inbox — a Gmail-integrated shared email client for the support team with thread management, reply composer, internal notes, templates, and member matching, and an Email Template Manager — a database-backed system for editing all managed transactional email copy without code deploys. The Webflow-built site at `rootedinmindfulness.org` remains live as the public-facing domain while this app is in active development at `rim-next.vercel.app`.

---

## Live URLs

| Environment | URL |
|---|---|
| Production (Vercel) | https://rim-next.vercel.app |
| Webflow (public live site) | https://rootedinmindfulness.org |
| Sanity Studio | https://rooted-in-mindfulness.sanity.studio |
| GitHub repo | https://github.com/jessefoy/rim-next |
| Neon (database) | https://console.neon.tech |
| Vercel dashboard | https://vercel.com/jessefoy/rim-next |
| Stripe (test mode) | https://dashboard.stripe.com |
| Resend | https://resend.com |
| Flodesk | https://app.flodesk.com |

---

## Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | strict |
| Auth | NextAuth v5 | `^5.0.0-beta.30` — magic link via Resend, no passwords |
| Database ORM | Prisma | `^5.22.0` |
| Database | Neon (Postgres) | project `ep-super-pine-ai6ujd7t`, db `neondb`. **Plan: Launch** (via Vercel Marketplace, metered $0.106/CU-hr + $0.35/GB-mo). Upgraded from Free on 2026-04-19 (session 88) after the 5-min Gmail sync cron blew the 100 CU-hr/mo Free cap and took the site offline. |
| CMS | Sanity v3 | project `xxgvfpjf`, dataset `production` |
| Email | Resend | transactional + magic links |
| Payments | Stripe | test mode (sk_test_* / pk_test_*) |
| Newsletter | Flodesk | segment `6340e5b00170f97cbdfc4b87` |
| Donations | GiveButter | account `GcnXeYilkL4lWnr3` |
| Video (legacy) | Google Meet | 4 shared room accounts via DWD + Google Calendar API |
| Video (new) | LiveKit Cloud | Ship tier ($50/month); `livekit-server-sdk`, `@livekit/components-react`, `@livekit/components-styles`, `livekit-client` |
| Hosting | Vercel | auto-deploy on push to `main` |
| CSS | Custom design system | `public/css/custom.css` only. Webflow CSS removed (session 84). Quincy CF self-hosted via `@font-face`. Legacy shim at bottom of custom.css for ~15 unredesigned pages. |
| Rich text editor | **`RimTiptapEditor`** (Tiptap 3) — migration complete session 97, 2026-04-28 | One component at `components/rim-tiptap/RimTiptapEditor.tsx`, three variants: `minimal` (Form Field), `message` (Hub welcome / conversations / replies / member bios / notes / drafts), `document` (Hub documents / lessons / manual sections / program descriptions / Page Designer surfaces). **Storage:** plain HTML strings produced by `editor.getHTML()`. **Selection bubble menu** is the primary formatting surface (Tiptap `BubbleMenu`); top toolbar is for insertion-only actions. **Sanitization:** `lib/renderRichContentTiptap.ts` uses `sanitize-html` (allowlists per variant) on every render. **Format detection:** `lib/renderRichContent.ts` (`isHtmlString` / `isBlockNoteJSON` / `isRawHtml` / legacy Tiptap doc shape) routes content by shape — unmigrated rows still display correctly via the legacy walker. Five custom block extensions (`Callout`, `PullQuote`, `VerseQuote`, `PracticeSuggestion`, `Reflection`) in `components/rim-tiptap/extensions/`. Tiptap deps: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-{link,underline,highlight,typography,image,table,table-row,table-header,table-cell,task-list,task-item,placeholder,bubble-menu,floating-menu,character-count,text-align,text-style,color}`, plus `sanitize-html` for output sanitization. **Editor Lab** at `/admin/editor-lab` validates all three variants. **Exception (unchanged):** `MarkdownEditor` (Tiptap + tiptap-markdown) is used exclusively by `EmailTemplateEditor` — email template pipeline is markdown → marked() → juice() → Resend. **Removed session 97:** `RimBlockEditor`, `RimProseEditor`, all `@blocknote/*` deps, `lib/blockNoteCustomBlocks.tsx`, `lib/blockNoteTheme.ts`, `components/editor/FormatPill.tsx`. |
| Footer suppression | `components/FooterWrapper.tsx` | Newsletter footer suppressed on `/admin/*`, `/account/*`, `/tools/*`, `/lessons/*`, `/course/*` |
| Hub navigation | `components/HubSidebar.tsx` | Left sidebar (220px, sticky) replaces horizontal tab strip. Identity block + core sections + Tools (app links) + settings. Mobile: slide-in drawer via hamburger. `HubNavStrip.tsx` and `HubHeader.tsx` deleted. |
| Tools context | `components/ToolsContext.tsx` | React context providing `toolName`, `backHref`, `backLabel`, `subNav`, `hubSlug`. `hubSlug` read from `?hub=` URL param client-side via `useSearchParams()`. Wrapped in Suspense. Server-side: `getToolHubContext()` in `lib/toolAuth.ts` resolves hub + members. ToolsNav rendered INSIDE each tool's ToolsProvider (not in outer layout). |
| Tool auth | `lib/toolAuth.ts` | `hasToolAccess()` (role + UserToolAccess grants), `getToolHubContext()` (hub + members for page data), `getHubNotificationRecipients()` (hub members for alerts/emails). |
| Tool registry | `lib/toolRegistry.ts` | Centralized tool definitions (slug, label, path, description). Hub admin form uses tool picker dropdown. |
| Hub/Tools model | `RIM_Hub_Model.md` | Complete hub/tools architecture: lifecycle, tool creation pattern, data scoping, decision tree, core sections, app links, access control matrix, mobile patterns, DB schema reference |
| File storage | Vercel Blob | `@vercel/blob` + `@vercel/blob/client` — client-side upload pattern (browser → Blob direct, bypasses 4.5 MB serverless limit); max 500 MB; `BLOB_READ_WRITE_TOKEN` env var |
| Webflow bridge | `public/rim-connect.js` (v3) | Populates `data-rim-*` attributes on Webflow pages from `/api/public/*` endpoints. Served from `https://rim-next.vercel.app/rim-connect.js`. Site-wide head code lives in Webflow Site Settings → Custom Code → Head Code (preconnect + hide-style + script tag). `[data-rim-page]` containers fade in when populated (opacity 0 → 1, 120ms) to eliminate placeholder flash. See `RIM_Webflow_Fields.md` for attribute + payload reference. |
| Public API cache policy | `/api/public/*` route handlers | Default headers: `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`, plus explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` copies of the same value. The explicit CDN headers are required — Vercel sanitizes the browser `Cache-Control` and drops `s-maxage` by default. Template: `app/api/public/programs/[slug]/route.ts`. |

---

## Workflow

- **Never run a local dev server.** Push to `main` → Vercel auto-deploys in ~1–2 min.
- `npm run build` = `prisma generate && next build` — run locally to catch TypeScript errors before pushing.
- To pull env vars: `npx vercel env pull .env.local`
- To run DB migration: `set -a && source .env.local && set +a && npx prisma db push`
- Route protection: `proxy.ts` (not `middleware.ts` — Next.js 16 naming)
- `params` is `Promise<{slug}>` in App Router — must `await params` before destructuring.
- **Mobile viewport:** `app/layout.tsx` exports `viewport: Viewport` with `width: "device-width", initialScale: 1`. Required — without it mobile browsers render every route at ~980px desktop width and silently ignore every `@media (max-width: 768px)` rule. Do not remove. (Added session 88 after the whole platform was discovered to be rendering as desktop-scaled on phones since inception.)
- **Cron rules-of-thumb:** Neon Free-tier compute = 100 CU-hrs/mo ≈ 24/7 active time of a `.25 CU` compute. A cron firing more than hourly will keep the endpoint continuously active and exhaust the cap. Use hourly (or less frequent) for DB-hitting crons; if real-time syncing is required, upgrade the plan or use a manual-sync UI pattern.

---

## Environment Variables

All set in Vercel. Pull locally with `npx vercel env pull .env.local`.

### Auth & Session
| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth session signing key |
| `NEXTAUTH_URL` | `https://rim-next.vercel.app` |

### Database (Neon)
| Variable | Purpose |
|---|---|
| `POSTGRES_PRISMA_URL` | Pooled connection (Prisma default); includes `pgbouncer=true` to prevent cached-plan invalidation after schema changes |
| `POSTGRES_URL_NON_POOLING` | Direct connection (migrations) |
| `POSTGRES_URL` | Raw URL |
| `POSTGRES_URL_NO_SSL` | SSL-disabled variant |
| `POSTGRES_HOST` | Host string |
| `POSTGRES_DATABASE` | `neondb` |
| `POSTGRES_USER` | DB user |
| `POSTGRES_PASSWORD` | ⚠️ Rotate before go-live |
| `NEON_PROJECT_ID` | Neon project ref |

### Sanity CMS
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | `xxgvfpjf` |
| `NEXT_PUBLIC_SANITY_DATASET` | `production` |
| `SANITY_API_TOKEN` | Editor-level read token (non-program content: teams, glossary, etc.) |

### Email (Resend)
| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | All transactional emails |
| `EMAIL_FROM` | `hello@rootedinmindfulness.org` (domain verified 2026-03-03) |
| `REGISTRAR_EMAIL` | Receives cancellation and edit notifications |

**Email Template Manager:** 7 managed templates live in `email_templates` DB table, editable at `/admin/emails`. `EmailTemplate` model fields: `slug` (permanent), `name`, `description`, `subject`, `body` (markdown), `enabled`, `variables String[]`, `group`, `groupLabel`, `minRole`, `helpText?`, `sanityNote?`. See FEATURES.md §26 for the complete 18-function inventory and migration status of all email functions.

**Background email sends from route handlers — use `after()` from `next/server`.** The `void (async () => { ... })()` pattern after `Response.json()` does not work on Vercel — the function tears down once the response goes out, killing in-flight Resend calls (intermittent or no delivery). Wrap fire-and-forget email batches in `after(async () => { ... })` so the work runs after the response is committed but before the function is torn down. Currently used in `app/api/host/sub-requests/route.ts`, `app/api/host/sub-requests/[id]/claim/route.ts`, `app/api/programs-pg/route.ts`. Establishment session: 96.

**`BASE_URL` is whitespace-trimmed.** Every place that derives a base URL from `process.env.NEXTAUTH_URL` does `.trim().replace(/\/$/, "")` — trailing whitespace in env vars on Vercel has historically broken email links by inserting a literal space inside the URL. Pattern lives in `lib/email.ts`, `lib/calendarLinks.ts`, `lib/supportNotify.ts`, `app/api/cron/drip-release/route.ts`, `app/api/stripe/checkout/route.ts`. Establishment session: 96.

### Google Meet
| Variable | Purpose |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account for DWD |
| `GOOGLE_PRIVATE_KEY` | Service account private key |
| `GOOGLE_ROOM_EMAILS` | Comma-separated list of meet1–meet4 room accounts |
| `GOOGLE_CALENDAR_ID` | Legacy — currently unused |

### Gmail (Support Inbox)
| Variable | Purpose |
|---|---|
| `GMAIL_CLIENT_ID` | OAuth2 client ID for Gmail API |
| `GMAIL_CLIENT_SECRET` | OAuth2 client secret |
| `GMAIL_REDIRECT_URI` | OAuth2 callback URL (`https://rim-next.vercel.app/api/support/auth/callback`) |

### LiveKit (Video Conferencing)
| Variable | Purpose |
|---|---|
| `LIVEKIT_API_KEY` | LiveKit Cloud API key |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API secret |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit Cloud WebSocket URL (public, used by client SDK) |

**Editor standard (Tiptap migration complete, session 97 — canonical reference is `RIM_Editor_Types.md`):** All multi-line rich text fields now use `RimTiptapEditor` and store **plain HTML strings**. `MarkdownEditor.tsx` is used exclusively for email templates (acknowledged outlier — markdown pipeline). **Four editor types** (Document, Page Designer, Message, Form Field) — chosen by author purpose, not by tier — map to three Tiptap variants (`minimal` / `message` / `document`; document serves both Document and Page Designer types). **Template data** (structured fields queried for features) stays as DB fields; **authored content** lives in an editor. Full type definitions and placement registry in `RIM_Editor_Types.md`. Pattern: `Json?` DB field accepts HTML strings as JSON values → `Prisma.JsonNull` for explicit null writes → `renderFormattedTextAsync()` / `renderContentBodyAsync()` (server) or `renderBlockNoteHtml()` (client) for display, all of which detect content shape and route correctly → `extractTextAsync()` strips tags for email. `RimTiptapEditor` has selection bubble menu (primary formatting), top toolbar (insertion: image, table, hr, callouts, dharma blocks), image upload via Vercel Blob, and dropdown clip-detection for narrow viewports. The five custom block extensions (`Callout`, `PullQuote`, `VerseQuote`, `PracticeSuggestion`, `Reflection`) live in `components/rim-tiptap/extensions/`. Document locking (`HubDocument.isLocked`, `editingById`, presence heartbeat) and blob cleanup (`lib/blobCleanup.ts`) are unchanged from the old editor.

**SlugField component (session 66):** `components/SlugField.tsx` — shared locked-by-default slug input with Unlock/Lock toggle + amber warning. Use for any URL slug field in any editor. Props: `value`, `onChange`, `isEditing`, `warnText?`, `hintText?`. In use: CourseEditor, LessonEditor, MemberDetail (Teacher Profile slug). ProgramEditor uses the same pattern on its own `pe-` classes.

**Open Access + ProgramTeacher (session 79):** `Program` gains `isOpenAccess Boolean @default(false)` + `guestAccessKey String?`. `ProgramTeacher` model (`program_teachers`, `programId + userId @@unique`, `order Int`) links teachers to programs via user accounts. Guest token route: `POST /api/livekit/guest-token` (no auth, key-gated). Guest key reset: `POST /api/programs-pg/[slug]/guest-key` (REGISTRAR/ADMIN). LiveKit token route now checks ProgramTeacher for host grant. `/api/members/search` access extended to REGISTRAR role. Public program pages link teacher names to `/teachers/[slug]` profiles.

**Learning System (sessions 60–61, updated session 67):** Prisma models — `LessonProgress` (`lesson_progress`, `userId + lessonId @@unique`), `SeriesEnrollment` (`series_enrollments`, `userId + courseId @@unique`, `enrollmentSource`, `completedAt DateTime?`), `LessonNote` (`lesson_notes`, `userId + lessonId @@unique`, `body Json?`), `ReflectionQuestion` (`reflection_questions`, `lessonId`, `body Json?` — Tiptap, `sortOrder`), `ReflectionOption` (`reflection_options`, `questionId`, `text`, `isCorrect Boolean`, `sortOrder`), `ReflectionResponse` (`reflection_responses`, `userId + questionId @@unique`, `optionId`), `LessonTeacher` (`lesson_teachers`, `id @id`, `lessonId`, `userId` → User direct join, `order Int`, `@@unique([lessonId, userId])`), `TeacherProfile` (`teacher_profiles`, `userId @unique`, `bio String?`, `photoUrl String?`, `slug String? @unique`, `isPublic Boolean`). User gains `isTeacher Boolean @default(false)`. `Lesson` gains `durationMinutes Int?`, `reflectionPrompt String?`, `questionsRequired Boolean @default(false)`. Key API routes: `POST /api/courses/[slug]/enroll`, `POST /api/lessons/[slug]/complete` (toggle; enrollment-gated), `GET + PATCH /api/lessons/[slug]/note`, `GET + PUT /api/lessons/[slug]/questions`, `POST /api/lessons/[slug]/questions/[questionId]/respond`, `DELETE /api/lessons/[slug]/questions/responses` (clears all responses for retake), `GET /api/members/search?q=` (TEACHER/ADMIN; filters `isTeacher: true` — returns `{id, firstName, lastName}`), `PATCH /api/admin/members/[id]/teacher-profile` (ADMIN; upserts TeacherProfile). Key components: `EnrollButton.tsx`, `MarkCompleteButton.tsx` (locked prop), `LessonNoteEditor.tsx`, `ReflectionQuestionsClient.tsx` (group submit; plain-string body fallback), `LessonFooterClient.tsx` (allCorrect state). Lesson page links teacher name to `/teachers/[slug]` only if `TeacherProfile.isPublic`. `isCorrect` never sent to client in GET questions route. **Teacher attribution:** managed in MemberDetail admin — `isTeacher` checkbox + "Public Teacher Profile" section (bio/photoUrl/slug/isPublic, saved separately). Slug auto-generates from `firstName + lastName` on first render when empty; uses `SlugField` (locked + Unlock). Public pages `/teachers` and `/teachers/[slug]` show profiles where `isPublic: true`. Old standalone Teacher model removed (session 67).

**Course drip system (session 63–64):** `Course.dripEnabled` + `dripIntervalDays` (global) + `Lesson.releaseDelayDays` (per-lesson override) + `Lesson.releaseDate` (fixed date). `Course.hideLockedLessons Boolean @default(false)` — when true, locked lessons are hidden from member view entirely; section dividers re-attach to first available lesson per section. `lib/drip.ts` — `isLessonAvailable()`, `computeAvailableDate()`, `formatAvailableDate()`.

**Modular Manual System (session 62–63):** `ManualSection` model — `slug @unique`, `title`, `description String?`, `hubSlug String?`, `body Json?`, `relations String[]`, `order Int`. 9 sections seeded (introduction, registration, programs, member-accounts, course-hub, host-hub, support-inbox, volunteer-roles, manual-system). Routes: `/admin/manual` (index, any logged-in user), `/admin/manual/[slug]` (section page, any logged-in user; ADMIN sees Edit link), `/admin/manual/editor` (DB editor, ADMIN only), `/manual` (public index). `body` stored as Tiptap JSON; migrated sections were initially stored as `{ type: "rawHtml", html: "..." }` — `renderContentBody()` handles both formats. `ManualSectionEditor` auto-converts rawHtml → Tiptap JSON via `generateJSON()` on mount. `ManualHelpIcon` wired into 10 locations. `ManualContent.tsx` hollowed out (content now in DB). Migration script: `prisma/seed-manual-chapters.ts`.

**Closing ritual — required after every session that changes features:**
1. Update `FEATURES.md` — add session entry, update relevant feature sections
2. Update `RIM_Stack_Reference.md` — update stack, routes, or env vars if changed
3. Update `RIM_System_Architecture.md` — if hubs, roles, or member data architecture changed
4. **Upsert ManualSection DB records** — touch only affected section(s); upsert on slug; write for the person doing the work. Edit at `/admin/manual/[slug]/edit` or re-run `prisma/seed-manual-chapters.ts` for large rewrites.

**Site-Wide Banner (session 72):** `SiteBanner` + `SiteBannerDismissal` models. ADMIN single-slot broadcast; `body Json?` (BlockNote JSON via RimProseEditor compact). APIs: `/api/admin/site-banner` (GET/POST/DELETE), `/api/site-banner/dismiss` (POST). Admin page: `/admin/banner`. Component: `SiteBannerStrip.tsx` on dashboard.

**Hub notification redesign (session 72):** Announcements merged into pinned conversation threads (`isPinned Boolean`, `pinnedAt DateTime?` on `HubConversationThread`). `HubAnnouncement` model removed. Announcements tab removed; hub root → `/conversations`. Dashboard hub cards show teal unread-count badge (threads + alerts since `lastVisitedAt`). `AlertStrip` removed.

**Support Inbox security posture (hardened 2026-03-16):** SSRF guard on attachment fetch (Vercel Blob domain only), attachment proxy ownership check, soft-delete bypass fix in sync engine, deleted-thread 404 on reply/note, 30s rate limit on manual sync, status enum validation, HTML escaping on signature fields, 100-char max on signature fields, audit log on hard delete, `NEXTAUTH_URL` in notification emails.

### Payments (Stripe — test mode)
| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_*` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_*` |
| `STRIPE_WEBHOOK_SECRET` | Registered at `https://rim-next.vercel.app/api/stripe/webhook` (event: `checkout.session.completed`) |

### File Storage (Vercel Blob)
| Variable | Purpose |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob upload/read token — used by `/api/upload` for image and audio files |

### Newsletter & Cron
| Variable | Purpose |
|---|---|
| `FLODESK_API_KEY` | Newsletter subscriber sync |
| `CRON_SECRET` | Vercel passes as `Authorization: Bearer <secret>` to cron routes |

---

## Sanity Studio

- Source: `/Users/jessefoy/Sites/rim-website/sanity/` (shared between both projects)
- Deploy: `cd /Users/jessefoy/Sites/rim-website/sanity && npx sanity deploy`
- ⚠️ **Programs, courses, and lessons have all been migrated to Postgres.** Sanity schemas for these types remain but are no longer the source of truth. Sanity is still used for: teams, glossary, magazine articles, volunteer positions, and `richContent` shared schema type.

### GROQ rules (for remaining Sanity content types)
- Always exclude drafts: `!(_id in path("drafts.**"))`
- `_type` values are **plural** (`"teams"` not `"team"`)
- ⚠️ Program slugs are database join keys for `HostAssignment` — treat as permanent once assignments exist

---

## Key Directories

```
app/
  account/
    dashboard/        member home
    programs/         my registrations list
    programs/[slug]/  member program detail (authenticated — status, join, calendar, dana)
    hub/[slug]/       Multi-hub volunteer workspaces (conversations, tasks, documents, members)
    hub/[slug]/programs/  Registrar Hub stakeholder view (read-only headcount)
    welcome/          onboarding
    reactivate/       self-service reactivation
  tools/
    learning/         Course Manager — Series + Lessons (TEACHER | ADMIN) — extracted from hub
    programs/         Program Manager (REGISTRAR | ADMIN) — extracted from hub
    programs/categories/  Category ordering (standalone view; also in ProgramEditor Categories tab)
    inbox/            Support Inbox + Settings (SUPPORT | ADMIN) — extracted from hub
    schedule/         Host Schedule — mini-cal + card list (HOST | HOST_MANAGER | ADMIN) — extracted from hub
  admin/
    members/          member management (ADMIN | REGISTRAR)
    households/       household grouping (ADMIN | REGISTRAR)
    emails/           Email Template Manager (ADMIN only)
    emails/[slug]/    template editor
    manual/           staff reference manual
    roadmap/          planned work tracker
    sitemap/          site architecture
    ideas/            backlog (data/backlog.json)
  api/
    account/          member-facing APIs (registrations, alerts, reactivate)
    courses/          course CRUD (TEACHER/ADMIN)
    lessons/          lesson CRUD + search (TEACHER/ADMIN)
    upload/           file upload via Vercel Blob (TEACHER/ADMIN)
    programs-pg/      program CRUD + google-meet + send-reminder
    programs/         legacy (ical only)
    registrations/    registration CRUD + email
    host/             hub APIs (assignments, assignments/reassign, sub-requests, threads, replies)
    support/          support inbox APIs (threads, compose, reply, notes, templates, settings, sync, auth)
    stripe/           checkout + webhook
    cron/             scheduled jobs (reminders, unassigned-host check, support-sync)
  programs/[slug]/    public program pages
  course/[slug]/      member-gated course pages
  lessons/[slug]/     lesson pages

components/           shared UI components
lib/                  utilities (queries, email, dateLabel, scheduleUtils, locations, etc.)
prisma/schema.prisma  database schema
proxy.ts              route protection (replaces middleware.ts in Next.js 16)
public/css/custom.css all custom styles (single source of truth — Webflow CSS removed)
data/backlog.json     feature backlog (surfaced at /admin/ideas)
```

---

## Active Roles

| Role | Access |
|---|---|
| `HOST` | Host Community Hub, sub board, conversations |
| `HOST_MANAGER` | All HOST access + assignment management + unassigned alerts |
| `TEACHER` | Teacher Hub — course and lesson management |
| `SUPPORT` | Support Inbox — shared inbox, thread assignment, reply, internal notes |
| `REGISTRAR` | Registrar Hub (auto-synced, coordinator), registrations, member profiles, Program Editor |
| `ADMIN` | Everything |

Hub access check: `roles.some(r => ["HOST","HOST_MANAGER","ADMIN"].includes(r))`
Manager check: `roles.some(r => ["HOST_MANAGER","ADMIN"].includes(r))`
Teacher check: `roles.some(r => ["TEACHER","ADMIN"].includes(r))`
Support check: `roles.some(r => ["SUPPORT","ADMIN"].includes(r))`
Registrar check: `roles.some(r => ["REGISTRAR","ADMIN"].includes(r))`

**Hub membership as authority (session 92 Phase 3):** for hosting and hub communications, a HubMember record is authoritative when it exists — coordinator-owned `status`, `hostingCapability`, and `communicationsEnabled` fields override the legacy role check. Use `getEffectiveHostingCapability(userId, hubSlug, fallback)` and `canReceiveHubNotifications(userId, hubSlug, fallback)` in `lib/hubMemberAuth.ts` when gating host/LiveKit/notification surfaces. ADMIN bypasses. If no HubMember record exists, the helpers fall through to the passed role-based fallback. `syncHubMembership` no longer deletes records on role revoke; hard removal is ADMIN-only via `DELETE /api/hub/[slug]/members/[userId]`.

---

## Key External Integrations

| Service | What it does | Notes |
|---|---|---|
| Resend | Magic links + all transactional email | Domain `rootedinmindfulness.org` verified |
| Stripe | Dana/fee collection via Checkout | Test mode — switch to live before launch |
| Sanity | Non-program content (teams, glossary, magazine, volunteers) | Programs, courses, lessons migrated to Postgres |
| Google Meet | Virtual program hosting (legacy) | DWD via service account; 4 room accounts |
| LiveKit Cloud | Video conferencing (new) | Ship tier ($50/month); token auth via HostAssignment |
| Google Calendar | Room booking for Meet sessions | Conflict checking on create |
| Gmail API | Support Inbox — sync threads, send replies | OAuth2 via GmailCredential; support@rootedinmindfulness.org |
| Flodesk | Newsletter signup | Segment ID in env vars |
| Neon | Postgres database | ⚠️ Rotate password before go-live |
| Vercel (Pro) | Hosting + cron jobs | Auto-deploy from `main`; Pro plan for 5-min cron interval |

---

## Current Phase

**Active development — not yet live on the real domain.**

The Webflow site at `rootedinmindfulness.org` is the live public site. This app is running in parallel at `rim-next.vercel.app` with real data and real members. The goal is a full cutover once CSS migration is complete and all member-facing flows are tested. Stripe is in test mode — switch to live keys before going public.

**CSS migration status:** All three Webflow CSS files removed from `app/layout.tsx` (session 84). Quincy CF fonts self-hosted. A legacy shim at the bottom of `custom.css` preserves ~25 essential Webflow classes for ~15 unredesigned pages. Redesigned pages (homepage, community programs, program detail, lessons, dashboard, etc.) use the design system exclusively. Each remaining page will shed legacy classes during its individual design pass — then the shim gets deleted.
