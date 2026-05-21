# RIM Feature Interconnection Map

**What this document is:** A dependency map. Before working on any system, find it here and read what it touches. This is not a feature description — that's FEATURES.md. This is the wiring diagram.

**Claude Code: Consult this before every implementation. When Jesse says "we need X," find X here first.**

---

## Programs

Programs are the most interconnected system. Touching a program touches almost everything.

| Connected to | How |
|---|---|
| **Registration system** | Each program can have registrations with capacity, waitlisting, custom fields |
| **Dana / Stripe** | Per-program dana mode (none/voluntary/base_plus_dana/fixed) → Stripe Checkout → webhook → donation records |
| **Email system** | Registration confirmation, waitlist notification, waitlist approval, cancellation notice to registrar, edit request, reminder, dana reminder — all per-program |
| **Email Template Manager** | All program-related email copy lives in the template manager, not in code |
| **Host assignments** | Programs have `HostAssignment` records linking hosts to specific dates. Slug is the join key — changing a slug breaks assignments |
| **LiveKit video** | Virtual/hybrid programs have `livekitRoom` (set to slug). Token API checks host assignment for roomAdmin grants |
| **ProgramTeacher** | Join table linking teacher accounts to programs. Teachers get roomAdmin in LiveKit. Display on public program page links to teacher profiles |
| **Open Access / Guest Join** | `isOpenAccess` + `guestAccessKey` on program. Guest token API. Shareable link pattern |
| **Member dashboard** | Dashboard shows upcoming registered programs with Join button → `/session/{slug}` |
| **Member Program Detail** | `/account/programs/[slug]` — authenticated view with session join, dana callout, calendar links, cancel button |
| **Public program page** | `/programs/[slug]` — Sanity content + Postgres registration data merged. CTA adapts to registration state |
| **Program Manager tool** | `/tools/programs` — where registrars create/edit/manage programs. Linked from Registration Hub |
| **Program categories** | `ProgramCategory` with `sortOrder`. Community programs page groups by category |
| **Sanity CMS** | Program content (description, images, schedule fields) still in Sanity. Registration data in Postgres. Two sources merged on program pages |
| **Host Schedule tool** | `/tools/schedule` — mini-cal + card list of upcoming programs with assignment status |
| **CSS** | `pg-` prefix (public program page), `pe-` prefix (program editor), `mpd-` prefix (member program detail) |

**If you're touching Programs, you must check:** registration flow, email templates, host assignments, LiveKit token logic, dashboard rendering, both program page variants (public + member), and the Program Manager tool.

---

## Hubs

Hubs are team workspaces. All share the same four core sections.

| Connected to | How |
|---|---|
| **Hub sidebar** | `HubSidebar.tsx` — 220px left nav with identity, core sections, tool app links, settings. Appends `?hub=slug` to tool links |
| **Core sections (shared)** | Home, Conversations, Documents, Members — identical across all hubs |
| **Conversations** | Threads with replies, pinned threads (replaced announcements), emoji reactions, reply editing, category filtering, email notifications |
| **Documents** | Native Tiptap documents + link documents. Locking, presence, blob cleanup |
| **Members tab** | Coordinator can add/remove members, toggle coordinator status. Shows hub membership, not registry data |
| **App links** | Hub home screen shows tool links. `HubAppLink` model with `toolSlug` from registry |
| **Tools** | Each hub may link to one or more tools. Tools read `?hub=` for scoped context |
| **Dashboard** | Hub cards on member dashboard show unread badges (threads since `lastVisitedAt`) |
| **Newcomer welcome** | `firstVisitedAt` on HubMember. One-time interstitial with `welcomeBody` |
| **Hub admin** | `/admin/hubs` — create, edit, archive hubs. App link management. Coordinator display |
| **Notifications** | `getHubNotificationRecipients()` — queries hub members for email alerts |
| **CSS** | `hub-` prefix (shell, sidebar, core sections), `hub-sb-` (sidebar), `hub-conv-` (conversations), `hub-doc-` (documents), `hub-mem-` (members) |

**Active hubs with linked tools:**
| Hub | Slug | Primary tool(s) |
|---|---|---|
| Hosting Hub | `host-team` | Host Schedule (`/tools/schedule`) |
| Registration Hub | `registrar` | Program Manager (`/tools/programs`) |
| Course Hub | `courses` | Course Manager (`/tools/learning`) |

**If you're touching Hubs, you must check:** sidebar rendering, the specific core section you're modifying across all four hubs (they share code), dashboard hub cards, and any connected tools.

---

## Tools

Tools are standalone work applications extracted from hubs. They share `ToolsContext` and `ToolsNav`.

| Connected to | How |
|---|---|
| **ToolsContext** | `components/ToolsContext.tsx` — provides `toolName`, `backHref`, `backLabel`, `subNav`, `hubSlug` |
| **ToolsNav** | Rendered inside each tool's `ToolsProvider`. Shows back link + sub-nav pills |
| **Tool auth** | `lib/toolAuth.ts` — `hasToolAccess()` (role + UserToolAccess grants), `getToolHubContext()` |
| **Tool registry** | `lib/toolRegistry.ts` — centralized definitions. Hub admin uses tool picker dropdown |
| **UserToolAccess** | Individual tool access grants without assigning a role. Managed via Neon console |
| **Hub app links** | Hubs link to tools via `HubAppLink` with `toolSlug`. `?hub=` param flows context |

**If you're building a new tool:** Read `RIM_Hub_Model.md` for the complete creation checklist.

---

## Member Registry

The canonical record of every person. ADMIN and REGISTRAR only.

| Connected to | How |
|---|---|
| **Section registry** | `lib/memberSectionRegistry.tsx` — declarative sections with role-based visibility |
| **sectionGrants** | Per-viewer grants for specific sections (e.g., care notes) without role assignment |
| **Roles** | Assigned via member profile. Role changes trigger notifications (REGISTRAR gets email) |
| **Households** | `Household` + `HouseholdMember` models. Displayed on member profile |
| **Hub access** | Hub membership managed via member profile (ADMIN) and hub Members tab (coordinators) |
| **Teacher profiles** | `isTeacher` + `TeacherProfile` managed via member profile, separate API endpoint |
| **Course access** | `CourseAccess` records managed from member profile |
| **Registration history** | All registrations for a member shown on their profile |
| **Tags / Status** | Member status (ACTIVE/INACTIVE/etc.) and tags for segmentation |
| **Admin notes** | ADMIN-only rich text notes on member records |

**The boundary:** Volunteers never access the registry. They see member data through hub projections and tool-specific views. This is architectural, not a filtering problem.

---

## Authentication & Sessions

| Connected to | How |
|---|---|
| **Sign-in codes** | Resend sends 6-digit code → member enters it on `/login/check-email` → NextAuth v5 verifies → session created (switched from magic links session 119) |
| **Session enrichment** | `auth.ts` callback adds `firstName`, `roles`, `archivedAt`, `agreedToTerms` to session |
| **Route protection** | `proxy.ts` gates `/account/*` (any session) and checks `agreedToTerms` → `/account/welcome` |
| **Welcome gate** | `/account/welcome` — terms acceptance flow, required before dashboard access |
| **Role checks** | Every hub, tool, and admin page checks `session.user.roles` |
| **Registration form** | Non-logged-in users: email lookup creates/finds User record. Logged-in: `sessionUserId` passed through |

---

## Email System

| Connected to | How |
|---|---|
| **Email Template Manager** | `/admin/email-templates` — all managed email copy lives here, editable without deploys |
| **Template pipeline** | Markdown → `marked()` → `juice()` (inline CSS) → Resend. Tiptap/MarkdownEditor for editing |
| **Resend** | All transactional email. `EMAIL_FROM` env var. Fire-and-forget pattern |
| **Registration emails** | Confirmation, waitlist, approval, cancellation, edit request, reminder, dana reminder |
| **Role assignment** | REGISTRAR role added → automatic notification email |
| **Hub member added** | `sendHubMemberAddedEmail` — when added to a hub |
| **Host alerts** | Sub requests, claims, unassigned session warnings — all via email |

**One email pipeline:** Resend handles all outbound transactional email (templates rendered server-side). All templates are managed at `/admin/email-templates`.

---

## Editor System

| Connected to | How |
|---|---|
| **RimTiptapEditor** | Primary editor — one component, three variants: `minimal`, `message`, `document`. Replaced BlockNote (session 97) |
| **Storage format** | Plain HTML strings everywhere — not JSON. Written on save, read on render |
| **Custom Dharma blocks** | VerseQuote, PracticeSuggestion, Callout, PullQuote, Reflection — Tiptap extensions |
| **Rendering** | `lib/renderRichContentServer.ts` / `lib/renderRichContent.ts` — HTML passthrough with format detection for any unmigrated rows |
| **MarkdownEditor** | Used ONLY for email templates. Markdown → juice() → Resend pipeline |
| **Vercel Blob** | Image uploads in RimTiptapEditor → Vercel Blob. Cleanup on document edit/delete |
| **Document locking** | Author lock + ADMIN override + presence heartbeat for hub documents |
| **Bubble menu** | Inline formatting (B/I/U/S/Code/Link/Highlight) in a selection-based bubble menu. Toolbar for insertion-only (image, table, hr, callout, dharma blocks) |

**If you're touching any editor or content display:** Read `RIM_Editor_Types.md` first.

---

## LiveKit Video

| Connected to | How |
|---|---|
| **Programs** | `livekitRoom` field on Program (set to slug). Virtual/hybrid programs only |
| **Token API** | `/api/livekit/token` — mints JWT. Checks: ADMIN → HostAssignment → HOST_MANAGER → ProgramTeacher for roomAdmin |
| **Guest token API** | `/api/livekit/guest-token` — validates `guestAccessKey`, mints participant JWT |
| **Session page** | `/session/[slug]` — full-page video room. Host controls (end session, mute, remove). Disconnect screen |
| **Dashboard** | "Join" button on registered programs links to `/session/{slug}` |
| **Member Program Detail** | Join button also available on `/account/programs/[slug]` |
| **Host assignments** | Token API checks `HostAssignment` for the specific program + date to determine roomAdmin |
| **ProgramTeacher** | Teachers linked via ProgramTeacher also get roomAdmin |
| **End session API** | `/api/livekit/end-session` — uses `RoomServiceClient.deleteRoom()`. Auth-gated |

**If you're touching LiveKit:** The token API is the critical auth boundary. Any change to who gets roomAdmin must trace through the full cascade: ADMIN → HostAssignment → HOST_MANAGER → ProgramTeacher.

---

## Learning System

| Connected to | How |
|---|---|
| **Course Manager tool** | `/tools/learning` — Series + Lessons management |
| **Course Hub** | Team workspace for teachers. Links to Course Manager via app link |
| **Series / Lessons** | Postgres models. Enrollment gating, progress tracking, reflection questions |
| **Course access** | `CourseAccess` records on member profiles gate lesson visibility |
| **RimTiptapEditor** | Lesson content authored in RimTiptapEditor (document variant). Stored as HTML. |
| **Teacher profiles** | Teachers must be members with accounts. `isTeacher` + `TeacherProfile` |

---

## CSS Architecture

| Connected to | How |
|---|---|
| **Design tokens** | `:root` variables — `--rim-bg`, `--rim-text`, `--rim-mid`, `--rim-blue`, `--font-serif` (quincy-cf), `--font-sans` (Open Sans) |
| **Prefix system** | Every page/component has a CSS prefix. See CLAUDE.md for the full list |
| **Legacy shim** | Bottom of `custom.css` — ~25 Webflow classes for ~15 unredesigned pages. Delete when all pages are migrated |
| **custom.css** | `public/css/custom.css` is the ONLY file to edit. Webflow CSS files are fully removed |
| **Mobile standards** | 360px min viewport, 390px primary target, 44px touch targets, 16px input fonts, 17px body text |

---

## Dana / Donations

| Connected to | How |
|---|---|
| **Stripe** | Test mode. Checkout sessions. Webhook for completion |
| **Programs** | Per-program dana mode and amounts configured in Sanity |
| **Registration** | Dana step appears after registration confirmation. `donationStatus` tracks state |
| **Member Program Detail** | Pending dana callout shown on member's program page |
| **Email** | Dana reminder email for PENDING donations |
| **QuickBooks** | Future sync. Stripe metadata structured for reconciliation |
| **GiveButter** | Legacy donation platform. Native Stripe-based system planned to replace it |

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · May 2026 (updated session 101 — Tasks removed, Support Inbox removed, Tiptap migration complete)*
*Companion to: FEATURES.md, RIM_System_Architecture.md*
