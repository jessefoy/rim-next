# RIM Next — Stack Reference

_Generated 2026-03-11. Last updated 2026-05-24 (session 121 — three-tier session-room permission model via new `lib/livekitAuth.ts::resolveSessionRole`, new `components/session/sessionRole.tsx` React context, tile hover-mute, chrome always visible, host/teacher 10-minute early-open on the dashboard)._

---

## What's been built

Rooted In Mindfulness (RIM) is a community Insight Meditation center in Brookfield, WI. This Next.js application is the headless backend of the RIM digital presence — programs, member accounts, registrations, online courses, hubs, and volunteer tools. The public/member-facing surface is moving to Webflow per `RIM_Architecture_Directive.md` (April 2026 pivot); RIM Next continues to host the API, the database, business logic, scheduled jobs, and the small set of stateful interactive surfaces (the Tiptap editor surfaces, the LiveKit session room, the staff tools).

**Currently active (operational):**
- Program registration system (waitlisting, dana/Stripe payments, calendar links, automated emails)
- Member dashboard and profile system
- Admin Member Registry (`/admin/members`) — households, status, tags, role assignment, course access, teacher profile
- Programs and registrations management at `/tools/programs` (the Program Manager)
- Postgres-backed course and lesson library (`/tools/learning` — the Course Manager)
- Host Community Hub workspace + Host Schedule at `/tools/schedule` with Schedule and Rotations tabs (Standing Host Assignments — session 98)
- LiveKit Cloud video conferencing (replaced Google Meet in session 86; Zoom-aligned redesign session 117; Greenroom + Recovery permission-safe join flow session 119; platform-aware permission instructions session 120; three-tier permission model + tile hover-mute + chrome always visible session 121) — bottom Zoom-style control bar with mic/cam device pickers, Speaker/Gallery view toggle, custom persistent chat with DMs, H.264 video at 2.5 Mbps / 30 fps, three-way audio profile (teacher/speaker/listener) with explicit per-profile bitrates, initials-circle avatar fallback. Three-tier permission model gates every action: Session Host (HostAssignment for this exact session or ADMIN) gets End-for-All + Share Screen; Co-host (ProgramTeacher or HOST_MANAGER, hub-gated) gets mute-others / Mute All; Participant gets mic + camera only (no screen share at the token level). Pre-prompt Greenroom primes the user before the browser camera/microphone prompt; Recovery screen for users who clicked "Never for this Website" with steps matched to their actual browser+OS (Safari macOS/iOS/iPadOS, Chrome+Edge desktop, Chrome Android, Firefox, generic fallback) via `lib/detectPlatform.ts`.
- Email Template Manager at `/admin/emails` — database-backed
- Database-driven staff manual (ManualSection records) with audience-grouped index, hub-scoped projection, contextual help icons
- **Hub Documents** with per-document Basecamp-style notifications, PDF file uploads, three-stage Archive → Trash lifecycle (session 113)
- **Hub Conversations** with thread subscription model (subscribers receive every reply automatically), `Follow` / `Unfollow` toggle, additive "Notify someone new" picker on replies, three-stage Archive → Trash lifecycle (session 113). Archive marker is `archivedAt DateTime?` as of session 115 (mirrors `HubDocument`); legacy `status: "CLOSED"` column kept in sync for backward compat, removable in a future cleanup.
- **Hub Trash** (`/account/hub/[slug]/trash`) — per-hub trash bin for soft-deleted documents and threads; gated to Admin / Guiding Teacher / hub coordinator (session 113)
- **Host assignment confirmation emails** — every path that makes someone a host (sub-claim, self-claim, manager assignment, PATCH claim, reassign) sends a confirmation; reassign also sends a removal email to the displaced host (session 113)

**Parked or removed:**
- **Google Meet integration** — replaced by LiveKit in session 86; all Meet UI, room accounts, and calendar booking removed
- **Support Inbox** (`/tools/inbox`) — fully removed in session 100 (Theme E). All schema models (GmailCredential, SupportThread, SupportMessage, SupportAttachment, SupportNote, SupportSignature, SupportTemplate), routes, and lib files deleted. `support@rootedinmindfulness.org` is read directly via Gmail.
- **Tasks per hub** — schema and UI removed entirely in session 96; never adopted in practice
- **Alerts module** — schema, API, UI all removed in session 96; bell UI never shipped
- **Sanity Studio access for staff** — removed in session 54 when programs migrated to Postgres
- **Virtual Host Hub Attendance + Session Tracking** — built sessions 43–45, deleted session 89; never reached operational use

The Webflow-built site at `rootedinmindfulness.org` is the live public-facing domain; this app currently runs at `rim-next.vercel.app`. Cutover happens once the new Webflow site is ready to replace the legacy public pages.

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
| Auth | NextAuth v5 | `^5.0.0-beta.30` — **6-digit sign-in code** via Resend, no passwords. Switched from magic link in session 119 to support multi-browser and future PWA. Override `generateVerificationToken` returns `crypto.randomInt(100000, 1000000).toString()`; `maxAge: 30 * 60`. Code-entry form on `/login/check-email` GETs the standard NextAuth callback. |
| Database ORM | Prisma | `^5.22.0` |
| Database | Neon (Postgres) | project `ep-super-pine-ai6ujd7t`, db `neondb`. **Plan: Launch** (via Vercel Marketplace, metered $0.106/CU-hr + $0.35/GB-mo). Upgraded from Free on 2026-04-19 (session 88) after the 5-min Gmail sync cron blew the 100 CU-hr/mo Free cap and took the site offline. |
| CMS | Sanity v3 | project `xxgvfpjf`, dataset `production` |
| Email | Resend | transactional + sign-in codes |
| Payments | Stripe | test mode (sk_test_* / pk_test_*) |
| Newsletter | Flodesk | segment `6340e5b00170f97cbdfc4b87` |
| Donations | GiveButter | account `GcnXeYilkL4lWnr3` |
| Video | LiveKit Cloud | Ship tier ($50/month); `livekit-server-sdk`, `@livekit/components-react`, `@livekit/components-styles`, `livekit-client` |
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
| PDF generation | `@react-pdf/renderer` `^4.5.1` | React-based PDF library — server-side rendering via `renderToBuffer()`, no headless Chromium required. Runs on Vercel serverless out of the box. First use: schedule export at `app/api/host/schedule/pdf/route.ts` + `ScheduleDocument.tsx` (session 109). Layout uses `<Document>`/`<Page>`/`<Text>`/`<View>` with `StyleSheet.create()`. |

---

## Workflow

- **Never run a local dev server.** Push to `main` → Vercel auto-deploys in ~1–2 min.
- `npm run build` = `prisma generate && node prisma/migrate.mjs && next build` — run locally to catch TypeScript errors before pushing. Note: locally the full build will fail at `migrate.mjs` unless `.env.local` is loaded, because it needs `POSTGRES_PRISMA_URL`. To type-check without DB: `npx tsc --noEmit`.
- **`prisma/migrate.mjs` skips cleanly when DB env is missing.** Top-of-`main()` guard: if `POSTGRES_PRISMA_URL` is absent, log a friendly note and return. Production deploys always set the env and run migrations. Vercel preview deploys (which don't inherit production env vars by default) complete `next build` without DB access. Established session 116 after the first non-main branch push surfaced the pre-existing fragility.
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

**`BASE_URL` is whitespace-trimmed.** Every place that derives a base URL from `process.env.NEXTAUTH_URL` does `.trim().replace(/\/$/, "")` — trailing whitespace in env vars on Vercel has historically broken email links by inserting a literal space inside the URL. Pattern lives in `lib/email.ts`, `lib/calendarLinks.ts`, `app/api/stripe/checkout/route.ts`. Establishment session: 96.

### Gmail (Support Inbox — removed session 100)
The Gmail OAuth env vars (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`) are still in Vercel but no longer used. Remove them from Vercel project settings.

### LiveKit (Video Conferencing)
| Variable | Purpose |
|---|---|
| `LIVEKIT_API_KEY` | LiveKit Cloud API key |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API secret |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit Cloud WebSocket URL (public, used by client SDK) |

**Session room three-tier permission model (session 121):** The previous overloaded `isHost` flag was split into Session Host + Co-host + Participant. One helper — `lib/livekitAuth.ts::resolveSessionRole(userId, programSlug, sessionDate, roles)` — returns `{ isSessionHost, isCoHost, isHostTeam, isProgramTeacher }` and is used by every server route that gates a session-room action (token, step-in, mute-participant, mute-all, end-session). Tier definitions:

- **Session Host** (singular) = `HostAssignment` match for this exact session OR `ADMIN`. Token grant: `roomAdmin: true` + `canPublishSources` includes `SCREEN_SHARE`. Gates End-for-All and Share Screen. Only person whose tile carries the "Host" badge (`seedMeta.host = true` keyed on `isSessionHost`, not `isCoHost`).
- **Co-host** = `ProgramTeacher` OR `HOST_MANAGER` OR Session Host, hub-gated via `getEffectiveHostingCapability(userId, "host-team", tentative)`. Token grant: `roomAdmin: true`, no screen-share source. Gates mute-others / Mute All / per-tile hover mute / Participants management. No End-for-All. No badge.
- **Participant** = everyone else. Token grant: `canPublishSources: [MICROPHONE, CAMERA]` only. UI hides Share / Mute-others / End-for-All buttons.

`createRoomToken(userId, userName, roomName, permissions: { roomAdmin, canShareScreen }, metadata?)` — the previous `(isHost: boolean)` signature was removed. `canPublish: true` was replaced everywhere with `canPublishSources` so the participant tier physically cannot publish a screen-share track regardless of what their UI tries to do.

Client-side, `components/session/sessionRole.tsx` provides `SessionRoleContext` with `{ isSessionHost, isCoHost, programSlug, localIdentity: string | null }` — descendants of `RIMConference` (the tile in particular) read it without prop-drilling through LiveKit's GridLayout. `localIdentity` is nullable because LiveKit's `localParticipant.identity` is briefly undefined on first render; consumers must check truthiness before comparing to prevent a one-frame race where a Co-host could self-mute via the server path.

**Auto-hide chrome removed (session 121):** the `.vs-page--idle` class, the 3-second idle JS timer in `app/session/[slug]/page.tsx`, and the `:has()` override matrix in `custom.css` were all deleted after a volunteer test surfaced the disappearing UI as confusing. Chrome stays visible at all times. The bottom bar is shallow enough that always-visible costs no usable real estate.

**Tile hover-mute (session 121):** `RIMParticipantTile` shows a red "Mute" button top-right on hover when `isCoHost && !isLocal && localIdentity` is truthy. "Muted" pill replaces the button when the participant is already muted. Uses the existing `/api/livekit/mute-participant` endpoint. Desktop affordance; mobile / touch hosts continue to use the Participants panel.

**Session room Zoom-aligned redesign (session 117):** The session room UX was reshaped end-to-end to match Zoom's information architecture so Sangha members transitioning from Zoom carry their muscle memory cleanly. Detailed inventory in FEATURES.md §38 ("Zoom-aligned redesign") and `SESSION_ROOM_FOR_VOLUNTEERS.md`. Key components and patterns:

- **Audio profile axis:** `audioProfile: "teacher" | "speaker" | "listener"` derived in `/api/livekit/token` from `ProgramTeacher` + `isHost`. Drives `audioCaptureDefaults` (teacher: noise-suppression off, AGC off, EC on, preserves bells/music) and `publishDefaults.audioPreset.maxBitrate` (teacher 128 kbps / speaker 96 / listener 64). DTX off everywhere. Default LiveKit audio is ~20 kbps; explicit per-profile bitrate is the source of the "voices sound full now, not phone-call thin" improvement.
- **Video:** H.264 codec (was VP8 — H.264 matches Zoom and decodes on universal hardware), explicit `videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }`. Simulcast layers `[h180, h360, h720]`.
- **Control bar (`components/session/RIMControlBar.tsx`):** Zoom-style bottom bar, icon-stacked-over-label, ~64×52 px buttons. Mic and Camera are two-part clusters (main toggle + thin divider + chevron). Chevron opens `DevicePickerMenu` (upward popover). Icons are inline Lucide-style SVGs at 20×20 (`components/session/ControlBarIcons.tsx`); off-state tint red via `currentColor`. Order: Mute · Start Video → Participants · Chat → Share Screen · Reactions · Settings → spacer → red End. End button opens `EndMenu` (host: End-for-All + Leave; non-host: just Leave).
- **Device pickers (`DevicePickerMenu.tsx`):** Enumerate `MediaDeviceInfo` for `audioinput`/`videoinput`/`audiooutput`. Live-swap via `room.switchActiveDevice(kind, deviceId)`. Persist in `localStorage` under `rim-livekit-prefs`. Settings panel (`VideoSettingsPanel.tsx`) has matching Audio + Video device sections sharing the same prefs.
- **Reactions (`ReactionsMenu.tsx`):** Replaces the deleted `NonverbalToolbar`. Upward popover from Reactions button. Five RIM signals (✋ ❤️ 🙏 ✓ ✗) with same metadata-broadcast behavior; "Lower hand" appears when hand is raised.
- **Speaker / Gallery view (`ViewToggle.tsx`):** Segmented control in page header right. Speaker view auto-pins active speaker via `useSpeakingParticipants` with ref-gated effect (the per-render thrash was caught by the reviewer sub-agent — the ref short-circuits before any filter work). Persists in `localStorage` under `rim-livekit-view`.
- **Participants panel:** Sticky local Me row with "(you)" tag + `Host` pill when applicable. Host pill on remote rows whose token metadata has `host: true`. Per-row Mute (host) or "Muted" pill. Footer Mute All for hosts. Search box at >10 participants. Driven by `useRemoteParticipants` with TrackMuted/Unmuted/Published/Unpublished updateOnlyOn config.
- **Custom chat (`RIMChat.tsx` + `app/api/livekit/chat/route.ts` + `SessionChatMessage` Prisma model):** Replaces stock `<Chat />`. New `session_chat_messages` table (`roomName`, `programSlug`, `sessionDate?`, `fromUserId?`, `fromIdentity`, `fromName`, `body`, `toIdentities String[]`, `sentAt`). Live via `room.localParticipant.publishData(..., { destinationIdentities, reliable: true, topic: "rim-chat" })`. History via GET (last 100, server-filtered so DMs only return to sender + listed recipients). Guest path: `guestKey + guestIdentity` in query/body. Migration entry in `prisma/migrate.mjs::create_session_chat_messages_table`.
- **Tile (`RIMParticipantTile.tsx`):** Custom Zoom-style nameplate (white text bottom-left with text-shadow; small red mic-off SVG only when muted; small Host pill if applicable). Active-speaker 3px yellow outline via `useIsSpeaking`. 8px rounded corners. **Initials avatar fallback** (`getInitials()` + `colorForIdentity()` palette) when video off and no presence photo — LiveKit's gray silhouette is hidden unconditionally. Initials sized via `min(40cqh, 240px)` + font `min(18cqh, 96px)` so the circle stays circular at any aspect ratio.
- **Auto-hide chrome:** Page (`app/session/[slug]/page.tsx`) tracks idle via 3s timer reset by mousemove / keydown / touchstart / focus. CSS `.vs-page--idle` fades top header + bottom control bar. `:has()` overrides re-show chrome when any panel or popover is open. `:hover` restores. Touch devices (`hover: none`) never fade.
- **Host-tag trust note:** `host: true` in participant metadata is a UI cue only. `canUpdateOwnMetadata: true` on token grant means a client could fake the tag. Real host actions are server-gated via `auth() + role + HostAssignment + ProgramTeacher`. Documented at token-route metadata seeding. Hardening path (if needed): proxy avatar/signal updates through `RoomServiceClient.updateParticipant` and drop `canUpdateOwnMetadata`.
- **Build hardening:** `lib/stripe.ts` wrapped in a lazy-init Proxy so `next build`'s page-data collection doesn't throw on preview deploys without `STRIPE_SECRET_KEY`. Pairs with the `prisma/migrate.mjs` env-guard added in session 116. Production unaffected.
- **CSS box-shadow exception** documented in `CLAUDE.md`: `.rim-cb-popover` uses a soft shadow as a Zoom-fidelity choice. Only place in the codebase where shadows are permitted.

**Editor standard (Tiptap migration complete, session 97 — canonical reference is `RIM_Editor_Types.md`):** All multi-line rich text fields now use `RimTiptapEditor` and store **plain HTML strings**. `MarkdownEditor.tsx` is used exclusively for email templates (acknowledged outlier — markdown pipeline). **Four editor types** (Document, Page Designer, Message, Form Field) — chosen by author purpose, not by tier — map to three Tiptap variants (`minimal` / `message` / `document`; document serves both Document and Page Designer types). **Template data** (structured fields queried for features) stays as DB fields; **authored content** lives in an editor. Full type definitions and placement registry in `RIM_Editor_Types.md`. Pattern: `Json?` DB field accepts HTML strings as JSON values → `Prisma.JsonNull` for explicit null writes → `renderFormattedTextAsync()` / `renderContentBodyAsync()` (server) or `renderBlockNoteHtml()` (client) for display, all of which detect content shape and route correctly → `extractTextAsync()` strips tags for email. `RimTiptapEditor` has selection bubble menu (primary formatting), top toolbar (insertion: image, table, hr, callouts, dharma blocks), image upload via Vercel Blob, and dropdown clip-detection for narrow viewports. The five custom block extensions (`Callout`, `PullQuote`, `VerseQuote`, `PracticeSuggestion`, `Reflection`) live in `components/rim-tiptap/extensions/`. Document locking (`HubDocument.isLocked`, `editingById`, presence heartbeat) and blob cleanup (`lib/blobCleanup.ts`) are unchanged from the old editor.

**SlugField component (session 66):** `components/SlugField.tsx` — shared locked-by-default slug input with Unlock/Lock toggle + amber warning. Use for any URL slug field in any editor. Props: `value`, `onChange`, `isEditing`, `warnText?`, `hintText?`. In use: CourseEditor, LessonEditor, MemberDetail (Teacher Profile slug). ProgramEditor uses the same pattern on its own `pe-` classes.

**Open Access + ProgramTeacher (session 79):** `Program` gains `isOpenAccess Boolean @default(false)` + `guestAccessKey String?`. `ProgramTeacher` model (`program_teachers`, `programId + userId @@unique`, `order Int`) links teachers to programs via user accounts. Guest token route: `POST /api/livekit/guest-token` (no auth, key-gated). Guest key reset: `POST /api/programs-pg/[slug]/guest-key` (REGISTRAR/ADMIN). LiveKit token route now checks ProgramTeacher for host grant. `/api/members/search` access extended to REGISTRAR role. Public program pages link teacher names to `/teachers/[slug]` profiles.

**Learning System (sessions 60–61, updated session 67):** Prisma models — `LessonProgress` (`lesson_progress`, `userId + lessonId @@unique`), `SeriesEnrollment` (`series_enrollments`, `userId + courseId @@unique`, `enrollmentSource`, `completedAt DateTime?`), `LessonNote` (`lesson_notes`, `userId + lessonId @@unique`, `body Json?`), `ReflectionQuestion` (`reflection_questions`, `lessonId`, `body Json?` — Tiptap, `sortOrder`), `ReflectionOption` (`reflection_options`, `questionId`, `text`, `isCorrect Boolean`, `sortOrder`), `ReflectionResponse` (`reflection_responses`, `userId + questionId @@unique`, `optionId`), `LessonTeacher` (`lesson_teachers`, `id @id`, `lessonId`, `userId` → User direct join, `order Int`, `@@unique([lessonId, userId])`), `TeacherProfile` (`teacher_profiles`, `userId @unique`, `bio String?`, `photoUrl String?`, `slug String? @unique`, `isPublic Boolean`). User gains `isTeacher Boolean @default(false)`. `Lesson` gains `durationMinutes Int?`, `reflectionPrompt String?`, `questionsRequired Boolean @default(false)`. Key API routes: `POST /api/courses/[slug]/enroll`, `POST /api/lessons/[slug]/complete` (toggle; enrollment-gated), `GET + PATCH /api/lessons/[slug]/note`, `GET + PUT /api/lessons/[slug]/questions`, `POST /api/lessons/[slug]/questions/[questionId]/respond`, `DELETE /api/lessons/[slug]/questions/responses` (clears all responses for retake), `GET /api/members/search?q=` (TEACHER/ADMIN; filters `isTeacher: true` — returns `{id, firstName, lastName}`), `PATCH /api/admin/members/[id]/teacher-profile` (ADMIN; upserts TeacherProfile). Key components: `EnrollButton.tsx`, `MarkCompleteButton.tsx` (locked prop), `LessonNoteEditor.tsx`, `ReflectionQuestionsClient.tsx` (group submit; plain-string body fallback), `LessonFooterClient.tsx` (allCorrect state). Lesson page links teacher name to `/teachers/[slug]` only if `TeacherProfile.isPublic`. `isCorrect` never sent to client in GET questions route. **Teacher attribution:** managed in MemberDetail admin — `isTeacher` checkbox + "Public Teacher Profile" section (bio/photoUrl/slug/isPublic, saved separately). Slug auto-generates from `firstName + lastName` on first render when empty; uses `SlugField` (locked + Unlock). Public pages `/teachers` and `/teachers/[slug]` show profiles where `isPublic: true`. Old standalone Teacher model removed (session 67).

**Course drip system (session 63–64, removed session 100):** Schema fields and `lib/drip.ts` fully removed in Theme E cleanup. Never entered operational use.

**Hub Notifications + Subscriptions + Trash (session 113):** Three connected systems. Schema additions:

- `HubDocumentNotification` (`hub_document_notifications`, `documentId × userId × eventType` event log; no unique constraint — same person can be notified once per event type). Cascade-deletes with the document. Indexes `documentId`, `(documentId, userId)`.
- `HubThreadSubscription` (`hub_thread_subscriptions`, `@@unique([threadId, userId])`, `source ∈ {AUTHOR, COORDINATOR_AUTO, ADDED, SELF}`). Replaces implicit per-reply notification logic. Backfilled for every existing thread at deploy: author + all prior repliers + all current coordinators.
- `HubDocument` gains `archivedAt`/`archivedById`/`deletedAt`/`deletedById` (+ index `(hubId, deletedAt)`).
- `HubConversationThread` gains `deletedAt`/`deletedById` (+ index `(hubId, deletedAt)`). `status: "CLOSED"` continues to serve as the archive state for threads — UI labels relabeled to "Archived".
- `Role` enum gains `GUIDING_TEACHER`. New helper `canManageTrash(roles, isCoordinator)` in `lib/hubAuth.ts` returns true for `ADMIN`, `GUIDING_TEACHER`, or hub coordinator. Trash page (`/account/hub/[slug]/trash`) and all restore/permanent-delete endpoints gate on this. `HubDocumentFileType` enum gains `PDF` for Vercel Blob uploads.

Shared UI: `components/HubDocNotifyPanel.tsx` — Basecamp-style picker used across document add/edit/standalone-notify, conversation compose, and conversation reply surfaces. Already-notified members render as disabled `✓ Notified [date]` rows.

Email templates seeded via `prisma/migrate.mjs`: `hub-document-created`, `hub-document-updated` (group `05-hubs`); `host-assignment-confirmation`, `host-assignment-removed` (group `04-hosts`). Plus four backfilled templates that had been referenced but never seeded: `session-reminder`, `host-role-assigned`, `sub-request-claimed`, `drip-lesson-available`. `CLAUDE.md` "Email Template Gate" requires future `sendTemplatedEmail` slugs to ship with matching seed entries.

API routes added: `/api/hub/[slug]/documents/[id]/{notify,archive,restore,permanent-delete}`, `/api/hub/[slug]/conversations/[id]/{subscribe,restore,permanent-delete}`, page route `/account/hub/[slug]/trash`. Three-stage delete enforced both in UI (Delete button hidden when item not archived) and at the API (DELETE returns 400 with "Archive this … first" unless archived). Trashed items 404 for non-managers even via direct URL.

**Document conversations + Activity stream (session 114):**

- `HubConversationThread` gains `documentId String?` (optional FK → `HubDocument`, ON DELETE CASCADE, `@@index([documentId])`). When set, the thread is a document conversation; when null, it's a hub-level conversation. Both the hub Conversations feed and `countUnreadConversations` filter `documentId: null`.
- New API routes: `GET/POST /api/hub/[slug]/documents/[id]/conversations`, `GET /api/hub/[slug]/activity`.
- New page route: `/account/hub/[slug]/activity` — computed union stream (no model), `HubActivityClient` with four filter pills.
- New components: `HubDocConversationsClient.tsx` (`doc-conv-` CSS prefix), `HubActivityClient.tsx` (`hub-act-` CSS prefix).
- DB migration: `add_document_id_to_hub_conversation_threads` (adds nullable column + index to Neon via `migrate.mjs`).


**Modular Manual System (session 62–63):** `ManualSection` model — `slug @unique`, `title`, `description String?`, `hubSlug String?`, `body Json?`, `relations String[]`, `order Int`. Sections seeded (introduction, registration, programs, member-accounts, course-hub, host-* family, volunteer-roles, manual-system, conversations). The `support-inbox` section was deleted in session 110 via the `remove_support_inbox_residue` migrate.mjs entry — the Support Inbox tool was removed in session 100 but its manual chapter persisted as a dead row until session 110. Routes: `/admin/manual` (index, any logged-in user), `/admin/manual/[slug]` (section page, any logged-in user; ADMIN sees Edit link), `/admin/manual/editor` (DB editor, ADMIN only), `/manual` (public index). `body` stored as Tiptap JSON; migrated sections were initially stored as `{ type: "rawHtml", html: "..." }` — `renderContentBody()` handles both formats. `ManualSectionEditor` auto-converts rawHtml → Tiptap JSON via `generateJSON()` on mount. `ManualHelpIcon` wired into 10 locations. `ManualContent.tsx` hollowed out (content now in DB). Migration script: `prisma/seed-manual-chapters.ts`.

**Closing ritual — required after every session that changes features:**
1. Update `FEATURES.md` — add session entry, update relevant feature sections
2. Update `RIM_Stack_Reference.md` — update stack, routes, or env vars if changed
3. Update `RIM_System_Architecture.md` — if hubs, roles, or member data architecture changed
4. **Upsert ManualSection DB records** — touch only affected section(s); upsert on slug; write for the person doing the work. Edit at `/admin/manual/[slug]/edit` or re-run `prisma/seed-manual-chapters.ts` for large rewrites.

**Site-Wide Banner (session 72, removed session 100):** Models, API routes, admin page, and component all deleted in Theme E cleanup. Never entered operational use.

**Hub notification redesign (session 72):** Announcements merged into pinned conversation threads (`isPinned Boolean`, `pinnedAt DateTime?` on `HubConversationThread`). `HubAnnouncement` model removed. Announcements tab removed; hub root → `/conversations`. Dashboard hub cards show teal unread-count badge (threads since `lastVisitedAt`). `AlertStrip` removed.

> **Note on alerts:** the broader Alerts module (`Alert` model + `AlertType` enum + `/api/account/alerts` + `check-unassigned-hosts` cron) was removed entirely in session 96. The unread badge on hub cards now counts conversation thread updates only.

**Support Inbox security posture (hardened 2026-03-16, system removed 2026-05-06):** Historical reference only. All code removed in session 100 Theme E.

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
    hub/[slug]/       Multi-hub volunteer workspaces (home, conversations, documents, manual, members)
    hub/[slug]/programs/  Registrar Hub stakeholder view (read-only headcount)
    welcome/          onboarding
    reactivate/       self-service reactivation
  tools/
    learning/         Course Manager — Series + Lessons (TEACHER | ADMIN) — extracted from hub
    programs/         Program Manager (REGISTRAR | ADMIN) — extracted from hub
    programs/categories/  Category ordering (standalone view; also in ProgramEditor Categories tab)
    *(inbox/ removed session 100 — Support Inbox deleted)*
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
    account/          member-facing APIs (registrations, reactivate, profile, bio)
    courses/          course CRUD (TEACHER/ADMIN)
    lessons/          lesson CRUD + search (TEACHER/ADMIN)
    upload/           file upload via Vercel Blob (TEACHER/ADMIN)
    programs-pg/      program CRUD + send-reminder
    programs/         legacy (ical only)
    registrations/    registration CRUD + email
    host/             hub APIs (assignments, assignments/reassign, sub-requests, threads, replies)
    stripe/           checkout + webhook
    cron/             scheduled jobs (reminders, unassigned-host check)
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
| `HOST_MANAGER` | All HOST access + assignment management + Standing Rotations editor |
| `TEACHER` | Teacher Hub — course and lesson management |
| ~~`SUPPORT`~~ | Removed session 100 — Support Inbox deleted |
| `REGISTRAR` | Registrar Hub (auto-synced, coordinator), registrations, member profiles, Program Editor |
| `GUIDING_TEACHER` | Sangha-wide dharma authority. Acts as **implicit coordinator on every hub** for content + moderation (scope expanded session 115). Distinct from `ADMIN`: no technical-admin scope (no hub config, no hard-remove member, no hub create/delete). Currently held only by Jesse; preserved in the enum for future teachers without technical-admin scope. Full role design: `RIM_Role_Design.md`. |
| `ADMIN` | Everything |

Hub access check: `roles.some(r => ["HOST","HOST_MANAGER","ADMIN"].includes(r))`
Manager check: `roles.some(r => ["HOST_MANAGER","ADMIN"].includes(r))`
Teacher check: `roles.some(r => ["TEACHER","ADMIN"].includes(r))`
*(SUPPORT role removed session 100)*
Registrar check: `roles.some(r => ["REGISTRAR","ADMIN"].includes(r))`
Trash-manager check: `canManageTrash(roles, isCoordinator)` in `lib/hubAuth.ts` — returns true for ADMIN, GUIDING_TEACHER, or hub coordinator. Used by the Trash page, the sidebar Trash link, and every restore/permanent-delete endpoint.

Coordinator-level check: `effectiveCoordinator(member, roles)` in `lib/hubAuth.ts` (session 115) — returns true for `HubMember.isCoordinator || ADMIN || GUIDING_TEACHER`. Use this everywhere previously inlined as `(member?.isCoordinator ?? false) || isAdmin`. The pre-session-115 inline pattern silently omitted GT. `requireCoordinator(isCoordinator, roles)` also bypasses for ADMIN + GT.

Hub thread filter: `activeHubThreadWhere(hubId)` in `lib/hubQueries.ts` (session 115) — returns the canonical filter shape `{ hubId, documentId: null, deletedAt: null, archivedAt: null }`. Use for any hub-level thread findMany / count: unread badges, conversations page server load, hub Home pinned + recent. Don't inline the filter; the three previous drift bugs (`status: { not: "ARCHIVED" }`, missing `documentId: null`, missing `deletedAt: null`) all happened by inlining.

**Hub membership as authority (session 92 Phase 3):** for hosting and hub communications, a HubMember record is authoritative when it exists — coordinator-owned `status`, `hostingCapability`, and `communicationsEnabled` fields override the legacy role check. Use `getEffectiveHostingCapability(userId, hubSlug, fallback)` and `canReceiveHubNotifications(userId, hubSlug, fallback)` in `lib/hubMemberAuth.ts` when gating host/LiveKit/notification surfaces. ADMIN bypasses. If no HubMember record exists, the helpers fall through to the passed role-based fallback. `syncHubMembership` no longer deletes records on role revoke; hard removal is ADMIN-only via `DELETE /api/hub/[slug]/members/[userId]`.

---

## Key External Integrations

| Service | What it does | Notes |
|---|---|---|
| Resend | Magic links + all transactional email | Domain `rootedinmindfulness.org` verified |
| Stripe | Dana/fee collection via Checkout | Test mode — switch to live before launch |
| Sanity | Non-program content (teams, glossary, magazine, volunteers) | Programs, courses, lessons migrated to Postgres |
| LiveKit Cloud | Video conferencing | Ship tier ($50/month); token auth via HostAssignment |
| ~~Gmail API~~ | Removed session 100 — Support Inbox deleted | OAuth env vars remain in Vercel; remove manually |
| Flodesk | Newsletter signup | Segment ID in env vars |
| Neon | Postgres database | ⚠️ Rotate password before go-live |
| Vercel (Pro) | Hosting + cron jobs | Auto-deploy from `main`; Pro plan for 5-min cron interval |

---

## Current Phase

**Active development — not yet live on the real domain.**

The Webflow site at `rootedinmindfulness.org` is the live public site. This app is running in parallel at `rim-next.vercel.app` with real data and real members. The goal is a full cutover once CSS migration is complete and all member-facing flows are tested. Stripe is in test mode — switch to live keys before going public.

**CSS migration status:** All three Webflow CSS files removed from `app/layout.tsx` (session 84). Quincy CF fonts self-hosted. A legacy shim at the bottom of `custom.css` preserves ~25 essential Webflow classes for ~15 unredesigned pages. Redesigned pages (homepage, community programs, program detail, lessons, dashboard, etc.) use the design system exclusively. Each remaining page will shed legacy classes during its individual design pass — then the shim gets deleted.
