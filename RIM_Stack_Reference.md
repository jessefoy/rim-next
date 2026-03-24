# RIM Next — Stack Reference

_Generated 2026-03-11. Last updated 2026-03-24 (session 74)._

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
| Database | Neon (Postgres) | project `ep-super-pine-ai6ujd7t`, db `neondb` |
| CMS | Sanity v3 | project `xxgvfpjf`, dataset `production` |
| Email | Resend | transactional + magic links |
| Payments | Stripe | test mode (sk_test_* / pk_test_*) |
| Newsletter | Flodesk | segment `6340e5b00170f97cbdfc4b87` |
| Donations | GiveButter | account `GcnXeYilkL4lWnr3` |
| Video | Google Meet | 4 shared room accounts via DWD + Google Calendar API |
| Hosting | Vercel | auto-deploy on push to `main` |
| CSS | Custom design system | `public/css/custom.css` only — never touch webflow CSS files |
| Rich text editor | BlockNote v0.47.1 | `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine`, `@blocknote/server-util` — replaced Tiptap entirely in session 69. Two components: `RimBlockEditor` (full — Bear-inspired toolbar, image upload, advanced tables, heading hierarchy, document locking, blob cleanup) and `RimProseEditor` (prose). Custom Dharma blocks: VerseQuote, PracticeSuggestion, Callout. Heading CSS injected via `<style>` tag on mount (must target `<h1>`/`<h2>`/`<h3>` tags, not `data-level`). Color token rendering via `BN_TEXT_COLORS`/`BN_BG_COLORS` maps in `renderRichContent.ts`. **Exception:** `MarkdownEditor` (Tiptap + tiptap-markdown, renamed from `RimEditor.tsx` in session 70) is used exclusively by `EmailTemplateEditor` — email template pipeline is markdown → marked() → juice() → Resend. |
| Footer suppression | `components/FooterWrapper.tsx` | Newsletter footer suppressed on `/admin/*`, `/account/*`, `/tools/*`, `/lessons/*`, `/course/*` |
| Hub navigation | `components/HubSidebar.tsx` | Left sidebar (220px, sticky) replaces horizontal tab strip. Identity block + core sections + Tools (app links) + settings. Mobile: slide-in drawer via hamburger. `HubNavStrip.tsx` and `HubHeader.tsx` deleted. |
| Tools context | `components/ToolsContext.tsx` | React context providing `toolName`, `backHref`, `backLabel`, `subNav`, `hubSlug`. `hubSlug` read from `?hub=` URL param client-side via `useSearchParams()`. Wrapped in Suspense. |
| Hub/Tools model | `RIM_Hub_Model.md` | Complete hub/tools architecture: lifecycle, tool creation pattern, data scoping, decision tree, core sections, app links, access control matrix, mobile patterns, DB schema reference |
| File storage | Vercel Blob | `@vercel/blob` + `@vercel/blob/client` — client-side upload pattern (browser → Blob direct, bypasses 4.5 MB serverless limit); max 500 MB; `BLOB_READ_WRITE_TOKEN` env var |

---

## Workflow

- **Never run a local dev server.** Push to `main` → Vercel auto-deploys in ~1–2 min.
- `npm run build` = `prisma generate && next build` — run locally to catch TypeScript errors before pushing.
- To pull env vars: `npx vercel env pull .env.local`
- To run DB migration: `set -a && source .env.local && set +a && npx prisma db push`
- Route protection: `proxy.ts` (not `middleware.ts` — Next.js 16 naming)
- `params` is `Promise<{slug}>` in App Router — must `await params` before destructuring.

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

**Editor standard (updated session 71):** All multi-line rich text fields use **BlockNote JSON** (via `RimBlockEditor` or `RimProseEditor`). `FormattedEditor` and `ContentEditor` removed in session 69. `RimEditor.tsx` renamed to `MarkdownEditor.tsx` — used exclusively for email templates (markdown string pipeline). Full context registry in `RIM_Editor_Design.md`. Pattern: `Json?` DB field → `Prisma.JsonNull` for null writes → `renderFormattedTextAsync()` (server) or `renderBlockNoteHtml()` (client) for display → `extractTextAsync()` for email. **Session 71 additions:** `RimBlockEditor` gained Bear-inspired toolbar, image upload (all users), advanced tables, heading hierarchy (injected CSS), block type selector, document locking, blob cleanup (`lib/blobCleanup.ts`). Renderer (`renderRichContent.ts`) now groups list items into `<ul>`/`<ol>`, renders images as `<figure>`, maps BlockNote color tokens to CSS hex values.

**SlugField component (session 66):** `components/SlugField.tsx` — shared locked-by-default slug input with Unlock/Lock toggle + amber warning. Use for any URL slug field in any editor. Props: `value`, `onChange`, `isEditing`, `warnText?`, `hintText?`. In use: CourseEditor, LessonEditor, MemberDetail (Teacher Profile slug). ProgramEditor uses the same pattern on its own `pe-` classes.

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
    programs/         my registrations
    hub/[slug]/       Multi-hub volunteer workspaces (conversations, tasks, documents, members)
    hub/[slug]/programs/  Registrar Hub stakeholder view (read-only headcount)
    welcome/          onboarding
    reactivate/       self-service reactivation
  tools/
    programs/         Program Manager (REGISTRAR | ADMIN) — extracted from hub
    inbox/            Support Inbox + Settings (SUPPORT | ADMIN) — extracted from hub
    schedule/         Host Schedule + Live Session + History (HOST | HOST_MANAGER | ADMIN) — extracted from hub
  admin/
    members/          member management (ADMIN | REGISTRAR)
    households/       household grouping (ADMIN | REGISTRAR)
    emails/           Email Template Manager (ADMIN only)
    emails/[slug]/    template editor
    manual/           staff reference manual
    roadmap/          planned work tracker
    sitemap/          site architecture
    features/         feature inventory
    ideas/            backlog (data/backlog.json)
  api/
    account/          member-facing APIs (registrations, alerts, reactivate)
    courses/          course CRUD (TEACHER/ADMIN)
    lessons/          lesson CRUD + search (TEACHER/ADMIN)
    upload/           file upload via Vercel Blob (TEACHER/ADMIN)
    programs-pg/      program CRUD + google-meet + send-reminder
    programs/         legacy (ical only)
    registrations/    registration CRUD + email
    host/             hub APIs (assignments, sub-requests, threads, replies)
    support/          support inbox APIs (threads, compose, reply, notes, templates, settings, sync, auth)
    stripe/           checkout + webhook
    cron/             scheduled jobs (reminders, unassigned-host check, support-sync)
  programs/[slug]/    public program pages
  course/[slug]/      member-gated course pages
  lessons/[slug]/     lesson pages

components/           shared UI components
lib/                  utilities (queries, email, dateLabel, locations, etc.)
prisma/schema.prisma  database schema
proxy.ts              route protection (replaces middleware.ts in Next.js 16)
public/css/custom.css all custom styles (never edit webflow CSS files)
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

---

## Key External Integrations

| Service | What it does | Notes |
|---|---|---|
| Resend | Magic links + all transactional email | Domain `rootedinmindfulness.org` verified |
| Stripe | Dana/fee collection via Checkout | Test mode — switch to live before launch |
| Sanity | Non-program content (teams, glossary, magazine, volunteers) | Programs, courses, lessons migrated to Postgres |
| Google Meet | Virtual program hosting | DWD via service account; 4 room accounts |
| Google Calendar | Room booking for Meet sessions | Conflict checking on create |
| Gmail API | Support Inbox — sync threads, send replies | OAuth2 via GmailCredential; support@rootedinmindfulness.org |
| Flodesk | Newsletter signup | Segment ID in env vars |
| Neon | Postgres database | ⚠️ Rotate password before go-live |
| Vercel (Pro) | Hosting + cron jobs | Auto-deploy from `main`; Pro plan for 5-min cron interval |

---

## Current Phase

**Active development — not yet live on the real domain.**

The Webflow site at `rootedinmindfulness.org` is the live public site. This app is running in parallel at `rim-next.vercel.app` with real data and real members. The goal is a full cutover once CSS migration is complete and all member-facing flows are tested. Stripe is in test mode — switch to live keys before going public.

**CSS migration status:** Two-layer system in progress. Pages marked 🟢 use the design system (`public/css/custom.css` with prefixed classes + CSS vars). Pages marked 🟠 still use raw Webflow classes from imported CSS files. Goal is to delete all three Webflow CSS imports from `app/layout.tsx` once all pages are migrated. See `memory/pages-inventory.md` for current status.
