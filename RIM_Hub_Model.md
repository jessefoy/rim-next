# The RIM Hub and Tools Model

**The definitive architecture guide for the hub/tools platform.**

This document is complete enough that a new developer (or a new Claude Code session) can understand the entire hub/tools system without reading any code. It covers the conceptual model, database lifecycle, tool creation patterns, data scoping, access control, mobile patterns, and extension points.

**Claude Code: Read this before working on any hub, tool, app link, sidebar, or scoped data feature.**

---

## 1. The Two Layers

Everything in the volunteer platform lives in one of two layers:

**Hubs are team homes.** A hub is where a team exists — where they communicate, coordinate, manage tasks, share documents, and know who's on their team. Every hub has the same core structure regardless of what team it serves.

**Tools are work applications.** A tool is where specific work gets done — processing registrations, managing a session schedule, handling support emails. Tools are focused, full-screen, and designed for the workflow they serve.

The relationship is intentional: the hub is where you belong, the tool is where you work.

---

## 2. Hub Lifecycle

This section walks through what happens at the database level when an admin creates a hub, populates it, and connects tools.

### Step 1: Admin creates a hub

An admin visits `/admin/hubs` and submits the create form. The `POST /api/admin/hubs` endpoint creates:

| Record | Table | Key fields |
|--------|-------|------------|
| `Hub` | `hubs` | `slug` (unique), `name`, `type` (OPERATIONAL / GOVERNANCE / COMMUNITY_GROUP), `status` (ACTIVE), `description` |

At this point the hub exists but has no members, no tools, and no content. The five core sections (Home, Conversations, Tasks, Documents, Members) are available immediately — they require no configuration because they read from hub-scoped tables that start empty.

**Database defaults on creation:**
- `status` → `ACTIVE`
- `hasSchedule` → `false`
- `welcomeHeadline` → `null` (no newcomer welcome)
- `welcomeBody` → `null`
- `homeContent` → `null`
- `documentCategories` → `[]`
- `conversationCategories` → `["General"]`

### Step 2: Admin adds members

The admin adds members to the hub. Each addition creates:

| Record | Table | Key fields |
|--------|-------|------------|
| `HubMember` | `hub_members` | `hubId` + `userId` (unique pair), `position`, `isCoordinator` (false by default), `joinedAt` |

A `HubMember` record is the access gate. The hub layout (`app/account/hub/[slug]/layout.tsx`) checks:
```
isMember = hub.members.some(m => m.userId === session.user.id)
```
No member record → no access (unless ADMIN, who bypasses all hub membership checks).

**Special case — Course Hub:** The Course Hub also accepts `UserHubAccess` records (`user_hub_access` table, `userId + hubSlug` unique pair) as an alternative access grant. This lets students access the Course Hub without being formal hub members. All other hubs use `HubMember` exclusively.

### Step 3: Admin assigns a coordinator

The admin edits a member's record and sets `isCoordinator: true`. This grants:
- Visibility of the "Hub settings" link in the sidebar
- Access to the hub admin edit page at `/admin/hubs/[slug]/edit`
- Coordinator-level permissions on hub content (editing home content, pinning threads, managing documents)

The `requireCoordinator()` helper in `lib/hubAuth.ts` enforces this:
```
if (!isCoordinator && !roles.includes("ADMIN")) throw new Error("coordinator_required")
```

### Step 4: Admin connects tools via app links

In the hub edit form, the admin adds app links. Each one creates:

| Record | Table | Key fields |
|--------|-------|------------|
| `HubAppLink` | `hub_app_links` | `hubId`, `label`, `href`, `order`, `isEnabled` (true) |

Example app links seeded for existing hubs:

| Hub | App Link Label | href |
|-----|---------------|------|
| Host Team | Host Schedule | `/tools/schedule` |
| Registrar Hub | Program Manager | `/tools/programs` |
| Support Hub | Support Inbox | `/tools/inbox` |
| Support Hub | Inbox Settings | `/tools/inbox/settings` |

**Update strategy:** The PATCH endpoint for hubs uses delete-all + recreate for app links. This is safe because app links have no foreign keys pointing to them.

### Step 5: Coordinator configures hub content

The coordinator (or admin) can now:
- Edit the Home screen content via `RimProseEditor` (stored as `homeContent` JSON on the Hub)
- Set a welcome headline and body for newcomer interstitials (stored as `welcomeHeadline` / `welcomeBody`)
- Create conversation categories, document categories
- Pin important conversation threads

### Step 6: Members use the hub

When a member navigates to `/account/hub/[slug]`:

1. **Auth check** — redirect to `/login` if not authenticated
2. **Hub fetch** — query `hubs` by slug, include `members` and `appLinks`
3. **Membership check** — verify user has a `HubMember` record (or is ADMIN, or has `UserHubAccess` for Course Hub)
4. **Sidebar render** — `HubSidebar` receives hub data, nav items, coordinator status
5. **First visit tracking** — if `firstVisitedAt` is null, show the welcome interstitial and set the timestamp
6. **`lastVisitedAt` update** — updated on each visit for unread badge calculation

---

## 3. The Hub Sidebar

Every hub has a left sidebar (220px, sticky on desktop) that serves as its navigation environment. The sidebar has four parts:

**Identity** — hub type label (e.g. "Operational Hub"), hub name, member count, coordinator name(s). Always visible so you always know where you are.

**Core sections** — Home, Conversations, Tasks, Documents, Members. These are the same in every hub. Improving any one of them improves every hub simultaneously because they're all powered by the same shared code.

**Tools** — a curated list of applications this team uses, rendered from `HubAppLink` records. Each tool link navigates away from the hub to the tool's full-screen experience. An arrow indicator (↗) signals that it's leaving the hub. The `?hub=<slug>` param is automatically appended.

**Hub settings** — visible only to coordinators and admins. Links to `/admin/hubs/[slug]/edit`.

**No hub-specific sections.** As of session 76, all hubs have the same five core sections. Hub-specific functionality (course management, program management) lives in tools linked via app links. No hub injects custom nav items.

### Sidebar nav item construction (in layout.tsx)

```
const navItems = [
  { label: "Home",          href: base },
  { label: "Conversations", href: `${base}/conversations` },
  { label: "Tasks",         href: `${base}/tasks` },
  { label: "Documents",     href: `${base}/documents` },
  { label: "Members",       href: `${base}/members` },
];
```

### Active state logic

- Home (the root nav item): exact match only (`pathname === href`)
- All other sections: prefix match (`pathname === href || pathname.startsWith(href + "/")`)

---

## 4. Connecting Tools to a Hub

An admin connects a tool to a hub by adding an app link in the hub's settings at `/admin/hubs/[slug]/edit`. An app link has a label ("Program Manager"), a path (`/tools/programs`), and an enabled toggle. Links can be reordered.

Once added, the tool link appears in the hub sidebar under Tools and as a card on the hub's Home screen. The Home screen card will eventually surface live context — "3 new registrations" or "2 sessions need hosts" — so the team sees what needs attention before they even open the tool. (See §10 for the planned evolution.)

Any tool can be linked from any hub. A single tool can be linked from multiple hubs.

---

## 5. Navigating to a Tool

When a hub member clicks a tool link from the sidebar, two things happen:

**First**, the `?hub=registrar` query parameter is appended to the URL. This tells the tool which hub launched it. The sidebar appends it like this:
```
const toolHref = link.href.includes("?")
  ? `${link.href}&hub=${hub.slug}`
  : `${link.href}?hub=${hub.slug}`;
```

**Second**, the tool opens in its own full-screen environment with a `ToolsNav` bar at the top — not the hub's sidebar. The ToolsNav shows the tool name on the left and a back link on the right ("← Registrar Hub") so the member can return to their hub without using the browser back button.

The tool works the same regardless of how you reached it. If a member navigates directly to `/tools/programs` without coming from a hub, the back link shows "← Dashboard" instead.

### Back link resolution

Each tool layout resolves its back link by checking if the user belongs to the tool's primary hub:

```
// Example from programs/layout.tsx
const hub = await db.hub.findUnique({ where: { slug: "registrar" } });
const member = await db.hubMember.findUnique({ where: { hubId_userId: ... } });
if (member || isAdmin) {
  backHref = "/account/hub/registrar";
  backLabel = hub.name;
} else {
  backHref = "/account/dashboard";
  backLabel = "Dashboard";
}
```

This means the back link is always contextually correct — hub members go back to their hub, others go to the dashboard.

---

## 6. Access Control

### The two access systems

**Hub access** is controlled by membership. You see a hub if you have a `HubMember` record for it (or you're ADMIN). This is about belonging to a team.

**Tool access** is controlled by role. You can use a tool if your `User.roles` array includes the required role. This is about being authorized to do specific work.

These are separate. Being a member of a hub that links to a tool does not grant access to that tool. A hub member without the right role will see the tool link in their sidebar but will be blocked when they try to open it.

### Tool access matrix

| Tool | Route | Required Role | Primary Hub |
|------|-------|--------------|-------------|
| Course Manager | `/tools/learning` | TEACHER or ADMIN | courses |
| Program Manager | `/tools/programs` | REGISTRAR or ADMIN | registrar |
| Support Inbox | `/tools/inbox` | SUPPORT or ADMIN | support |
| Host Schedule | `/tools/schedule` | HOST, HOST_MANAGER, or ADMIN | host-team |

All tools also support individual access grants via `UserToolAccess` — admins can grant a specific user access to any tool without assigning them the full role. See `lib/toolAuth.ts`.

### Role gate pattern

Each tool's `layout.tsx` performs the check:
```
const roles = session.user.roles ?? [];
const isAdmin = roles.includes("ADMIN");
const hasAccess = isAdmin || roles.includes("REQUIRED_ROLE");
if (!hasAccess) return <div>You don't have permission...</div>;
```

There is no shared `roleGate()` utility — each tool handles it inline in its layout. This is intentional: it keeps each tool self-contained and the pattern is only three lines.

### Hub section access

All core sections (Home, Conversations, Tasks, Documents, Members) are visible to every hub member. There is no per-section gating within a hub — if you're a member, you see everything.

Hub-specific sections follow the same rule: if you're a member of Course Hub, you see Series and Lessons. If you're a member of Registrar Hub, you see the Programs stakeholder view.

Coordinator actions (editing home content, managing settings) are gated by `isCoordinator` on the `HubMember` record.

### Complete access control matrix

| Role | Hubs (membership required) | Tools (role required) | Hub Sections |
|------|---------------------------|----------------------|--------------|
| HOST | Host Team | Host Schedule | All core + schedule |
| HOST_MANAGER | Host Team | Host Schedule | All core + schedule + assignment management |
| REGISTRAR | Registrar Hub | Program Manager | All core + Programs stakeholder view |
| SUPPORT | Support Hub | Support Inbox | All core |
| TEACHER | Course Hub | — | All core + Series + Lessons |
| ADMIN | All hubs (bypass) | All tools (bypass) | All sections + Hub settings |
| VOLUNTEER_COORDINATOR | Volunteer Coordination | — | All core |
| NEWSLETTER | Newsletter | — | All core |
| GREETER | Greeter Team | — | All core |
| Other operational roles | Their respective hub | — | All core |

**Coordinator permissions** (any hub, requires `isCoordinator: true`):
- Edit hub home content
- Pin/unpin conversation threads
- Lock/unlock documents
- Access `/admin/hubs/[slug]/edit`
- Manage hub members (add/remove/change coordinator status)

**ADMIN bypass:** ADMIN users access all hubs without needing a `HubMember` record and all tools without needing the specific role. The `isCoordinator` computation uses `(member?.isCoordinator ?? false) || isAdmin`.

---

## 7. Shared Hub Context and Data Scoping

### How hub context flows

```
Sidebar click → URL (?hub=slug) → server page (searchParams) → getToolHubContext() → hub + members
                                → ToolsContext (client) → useToolsContext().hubSlug
```

1. **HubSidebar** appends `?hub=<slug>` to every tool link href
2. **Server-side:** Page components receive `searchParams` prop with `hub` param. Call `getToolHubContext(hubSlug)` from `lib/toolAuth.ts` to get the full hub record with members. This is the primary hub awareness mechanism.
3. **Client-side:** `ToolsContext` reads `?hub=` from `useSearchParams()` for any client components that need the hub slug.

### Hub awareness in tools (implemented)

**Host Schedule** — reads `?hub=` and calls `getToolHubContext()` to get coordinator names and hub membership for access control. Falls back to `"host-team"` if no hub param.

**Support Inbox** — reads `?hub=` and calls `getToolHubContext()` to get team members for the assignment dropdown. Falls back to `"support"` if no hub param.

**Program Manager and Course Manager** — not yet hub-aware (no hub member queries needed currently). When a tool serves multiple hubs, it will add `getToolHubContext()` to scope its data.

### Data scoping pattern

Tools query data globally by default. When hub context is available, they can scope:

**Program Manager** — fetches all programs regardless of hub context:
```
db.program.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
```
This is correct for now — the Registrar Hub is the only hub that links to Program Manager, and registrars need the complete view.

**Support Inbox** — fetches the shared Gmail credential and displays all threads:
```
db.hubMember.findMany({ where: { hub: { slug: "support" } } })
```
The inbox is a single shared resource (one Gmail account), so hub scoping doesn't apply.

**Host Schedule** — fetches all program assignments globally. The Host Team is the only hub that links to this tool.

### When scoping will matter

Hub-scoped data becomes important when the same tool serves multiple hubs. For example, if a "Discussion Board" tool were linked from three Community Group hubs, each group should see only their own discussions.

**Scoped query pattern (future):**

```typescript
// Unscoped — shows everything the user's role permits
const threads = await db.discussionThread.findMany({
  where: { status: "OPEN" },
});

// Scoped — filtered to the hub that launched the tool
const threads = await db.discussionThread.findMany({
  where: {
    status: "OPEN",
    hubId: hubSlug ? (await db.hub.findUnique({ where: { slug: hubSlug } }))?.id : undefined,
  },
});
```

**Without hub context** (direct navigation, no `?hub=` param), the tool shows everything the user's role permits — the full unfiltered view. This is appropriate for admins and power users.

### Hub sub-page scoping (already implemented)

Hub sections already scope their data by `hubId`. Each hub sub-page calls `getHubMembership()` from `lib/hubAuth.ts`, then queries with `where: { hubId: hub.id }`:

```typescript
// Conversations page
const threads = await db.hubConversationThread.findMany({
  where: { hubId: hub.id },
  orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
});

// Tasks page
const taskLists = await db.taskList.findMany({
  where: { hubId: hub.id, isArchived: false },
});

// Documents page
const documents = await db.hubDocument.findMany({
  where: { hubId: hub.id },
});
```

This is the model for how tool scoping should work when implemented.

---

## 8. Tool Creation Pattern

Step-by-step guide for building a new tool from scratch.

### Checklist

- [ ] **1. Create the route directory:** `app/tools/<tool-name>/`
- [ ] **2. Create `layout.tsx`** — the tool shell:
  - Import `auth`, `redirect`, `db`, `ToolsProvider`
  - Auth check: `if (!session) redirect("/login")`
  - Role gate: check `session.user.roles` for required role(s) or ADMIN
  - Resolve back link: look up the tool's primary hub, check if user is a member
  - Wrap children in `<ToolsProvider value={{ toolName, backHref, backLabel, subNav? }}>`
- [ ] **3. Create `page.tsx`** — the main tool page:
  - Fetch data (scoped or global depending on use case)
  - Render the tool UI
- [ ] **4. Create sub-pages** (if needed): `app/tools/<tool-name>/<sub>/page.tsx`
  - Add sub-nav items to the `ToolsProvider` value in layout.tsx
- [ ] **5. Add the role** to `prisma/schema.prisma` `Role` enum (if new role needed)
  - Run `prisma db push` and `prisma generate`
- [ ] **6. Register the app link** — add a `HubAppLink` record connecting the tool to its primary hub:
  - Via the hub admin edit form at `/admin/hubs/[slug]/edit`
  - Or via `seed-hubs.ts` for initial seeding
- [ ] **7. Update documentation:**
  - Add tool to the access control table in this document
  - Add route to `RIM_Stack_Reference.md` Key Directories
  - Add session entry to `FEATURES.md`

### Template: tool layout.tsx

```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";

export default async function MyToolLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const hasAccess = isAdmin || roles.includes("MY_ROLE");

  if (!hasAccess) {
    return (
      <div className="tools-unauthorized">
        You don&rsquo;t have permission to access this tool.
      </div>
    );
  }

  // Resolve back link to primary hub
  let backHref = "/account/dashboard";
  let backLabel = "Dashboard";

  const hub = await db.hub.findUnique({
    where: { slug: "my-hub-slug" },
    select: { id: true, name: true },
  });
  if (hub) {
    const member = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    });
    if (member || isAdmin) {
      backHref = "/account/hub/my-hub-slug";
      backLabel = hub.name;
    }
  }

  return (
    <ToolsProvider value={{ toolName: "My Tool", backHref, backLabel }}>
      {children}
    </ToolsProvider>
  );
}
```

---

## 9. Decision Tree: Hub Section vs. Tool

When should functionality live inside a hub section vs. be extracted to a standalone tool?

### The criteria

| Factor | Hub Section | Standalone Tool |
|--------|------------|-----------------|
| **Complexity** | Simple list/detail views, forms | Multi-page workflows, complex state |
| **Sub-pages** | None or one level deep | Multiple sub-pages with their own navigation |
| **Navigation** | Fits within the hub sidebar | Needs its own nav bar, sub-nav, or breadcrumbs |
| **Role separation** | Same people who use the hub | Different or overlapping role requirements |
| **Multi-hub potential** | Specific to this hub | Could serve multiple hubs |
| **Screen real estate** | Works in the hub's main content area | Needs full-screen, dedicated layout |
| **Update frequency** | Changes with hub, low complexity | Evolves independently, high iteration |

### The three extractions (case studies)

**Program Manager** (from Registrar Hub → `/tools/programs`)
- *Why extracted:* Complex multi-step workflow (create program → configure schedule → manage registrations → send reminders). Needed its own editing UI with many sub-pages. The Registrar Hub kept a read-only "Programs" stakeholder view showing headcounts — the right information for the team context.
- *Pattern:* Hub retains a lightweight stakeholder view. Tool handles the full operational workflow.

**Support Inbox** (from Support Hub → `/tools/inbox`)
- *Why extracted:* Full email client with thread list, compose, reply, internal notes, templates, settings. Gmail OAuth integration. Completely different UX from a hub section — needs full screen, real-time sync, keyboard shortcuts.
- *Pattern:* Tool is the entire workflow. Hub provides team context (who's on support, conversations, shared documents).

**Host Schedule** (from Host Team Hub → `/tools/schedule`)
- *Why extracted:* Calendar-based UI with mini-cal + card list. Session management with sub-board integration. Originally had sub-nav (Schedule / Live Session / Journal) — Live Session and Journal removed in session 76; will rebuild around LiveKit video conferencing.
- *Pattern:* Single-page tool (no sub-nav currently). Hub is where the team coordinates (conversations, tasks, documents).

### The decision rule

> If the feature needs its own sub-pages, its own navigation, or a full-screen workflow — extract it to a tool. If it's a view that fits naturally in the hub's content area — keep it as a hub section.

When in doubt, start as a hub section. Extract to a tool when the hub section starts feeling cramped or when it needs navigation that conflicts with the hub sidebar.

---

## 10. Core Sections Architecture

The five core sections are shared infrastructure. Every hub gets them for free. Improving one improves all hubs.

### Home

**Route:** `/account/hub/[slug]` (page.tsx)

**What it shows:**
- Coordinator-editable rich text content (`homeContent` JSON via `RimProseEditor variant="document"`)
- App link cards (rendered from `HubAppLink` records)
- Pinned conversation threads (from `HubConversationThread` where `isPinned: true`)

**Extension points:**
- `homeContent` is a freeform JSON rich text field — coordinators can put anything here
- App link cards are the connection point to tools (see §10 for planned live context cards)

### Conversations

**Route:** `/account/hub/[slug]/conversations`

**What it shows:**
- Threaded discussions scoped to `hubId`
- Pinned threads appear first
- Category filtering (from `hub.conversationCategories[]`)
- Thread detail with replies at `/conversations/[id]`

**Data model:** `HubConversationThread` (title, body as BlockNote JSON, status, isPinned, pinnedAt) → `HubConversationReply` (body as BlockNote JSON)

### Tasks

**Route:** `/account/hub/[slug]/tasks`

**What it shows:**
- Three-column UI: task list rail (lists + filters) → task list → detail panel
- Lists, tasks, subtasks with assignees, due dates
- Template lists for recurring workflows
- Task status: OPEN → IN_PROGRESS → DONE

**Data model:** `TaskList` (hubId, name, isTemplate, isArchived) → `Task` (title, body as BlockNote JSON, assigneeId, status, dueDate) → `Subtask` (title, status)

**Mobile:** Responsive three-screen flow (see §12).

### Documents

**Route:** `/account/hub/[slug]/documents`

**What it shows:**
- Document library scoped to `hubId`
- Category filtering (from `hub.documentCategories[]`)
- Native documents (created in-app with BlockNote editor) and external links
- Locked documents (coordinator-only editing)

**Data model:** `HubDocument` (hubId, label, url, fileType, category, isNative, isLocked, body as BlockNote JSON)

### Members

**Route:** `/account/hub/[slug]/members`

**What it shows:**
- All hub members with name, position, coordinator badge
- Last visited timestamp
- Member count

**Data model:** `HubMember` (hubId, userId, position, isCoordinator, joinedAt, lastVisitedAt, firstVisitedAt)

### No Hub-Specific Additions

As of session 76, no hub has custom nav items. All hub-specific functionality has been extracted to tools:

- Course/Lesson management → `/tools/learning` (Course Manager tool)
- Program management → `/tools/programs` (Program Manager tool)
- Support email → `/tools/inbox` (Support Inbox tool)
- Host scheduling → `/tools/schedule` (Host Schedule tool)

Hubs connect to their tools via app links in the sidebar. This ensures every hub is structurally identical — the same five core sections, no exceptions.

---

## 11. App Link and Home Screen Pattern

### How app links work today

An app link is a record in the `hub_app_links` table:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | String (cuid) | Primary key |
| `hubId` | String | Foreign key to `hubs` |
| `label` | String | Display text (e.g. "Program Manager") |
| `href` | String | Tool URL path (e.g. "/tools/programs") |
| `order` | Int | Sort order (0-based) |
| `isEnabled` | Boolean | Show/hide toggle |

**In the sidebar:** Rendered under a "Tools" divider with an arrow (↗) indicator. `?hub=<slug>` is appended to the href.

**On the home screen:** `HubHomeClient` renders enabled app links as cards in a tools section.

### Planned evolution: live context cards

Today, app link cards on the hub home screen are static labels. The planned enhancement:

**Goal:** Each card surfaces a live count from its linked tool — "3 new registrations", "2 sessions need hosts", "5 unread threads". The team sees what needs attention without opening the tool.

**Planned API pattern:**

Each tool that wants to provide context to hub home cards would expose a lightweight endpoint:

```
GET /api/tools/<tool-name>/context?hub=<slug>
→ { count: number, label: string }
```

Examples:
- `/api/tools/programs/context?hub=registrar` → `{ count: 3, label: "new registrations" }`
- `/api/tools/schedule/context?hub=host-team` → `{ count: 2, label: "sessions need hosts" }`
- `/api/tools/inbox/context?hub=support` → `{ count: 5, label: "unread threads" }`

The `HubHomeClient` component would fetch these on mount and overlay the count on each app link card. The `hub` param allows scoped counts when the same tool serves multiple hubs.

**Status:** Foundation laid (app links render on home), context endpoints not yet implemented.

---

## 12. Mobile Navigation

### Mobile sidebar drawer

On screens ≤ 767px, the hub sidebar transforms into a slide-in drawer:

**CSS behavior:**
- Sidebar becomes fixed-position overlay (260px wide, full viewport height)
- Default state: `transform: translateX(-100%)` (hidden off-screen left)
- Open state (`.hub-sidebar--open`): `transform: translateX(0)` (slides in)
- Backdrop overlay appears behind sidebar when open (click to close)

**Mobile top bar:**
- A condensed bar (`hub-sb-mobile-bar`) appears at top with hamburger button (☰) and hub name
- Hidden on desktop via `display: none`, shown on mobile via media query

**Interaction:**
- Hamburger button sets `mobileOpen: true` → sidebar slides in
- Clicking any nav link calls `setMobileOpen(false)` → sidebar auto-closes
- Clicking the backdrop also closes the sidebar

### Mobile patterns for tools

Tools should follow these patterns on mobile:

**ToolsNav:** The back link and tool name render in a top bar that works well on mobile without modification.

**Sub-nav tabs:** Tools with sub-navigation render as horizontal scrollable tabs. (Host Schedule currently has no sub-nav — Live Session and Journal were removed; may return with LiveKit integration.)

**Three-column layouts (Tasks):** On mobile, the Tasks section uses a three-screen flow:
1. **Lists screen** — shows all task lists (the rail)
2. **Tasks screen** — shows tasks in the selected list
3. **Detail screen** — shows the full task with subtasks, assignee, due date

Navigation between screens is via click-through (forward) and back button (backward). Each screen takes the full viewport width.

**Guideline for new tools:** Design mobile-first. If the tool has a list → detail pattern, use the full-screen progressive disclosure pattern (list screen → detail screen). Avoid side-by-side panels on mobile.

---

## 13. The Current Hub Inventory

### Active operational hubs

| Hub | Slug | Tools | Hub-Specific Sections |
|-----|------|-------|----------------------|
| Host Team | `host-team` | Host Schedule | — |
| Course Hub | `courses` | Course Manager | — |
| Registrar Hub | `registrar` | Program Manager | — |
| Support Hub | `support` | Support Inbox, Inbox Settings | — |
| People Team | `people-team` | — | — |
| Greeter Team | `greeter` | — | — |
| AV Team | `av-team` | — | — |
| Housekeeping | `housekeeping` | — | — |
| Plant Care | `plant-care` | — | — |
| Newsletter | `newsletter` | — | — |
| Sangha Care | `sangha-care` | — | — |
| KM Support | `km-support` | — | — |
| Silent Meditation | `silent-meditation` | — | — |
| Volunteer Coordination | `volunteer-coordination` | — | — |

### Governance hubs

| Hub | Slug | Tools | Hub-Specific Sections |
|-----|------|-------|----------------------|
| Board | `board` | — | — |
| Teacher Council | `teacher-council` | — | — |

---

## 14. The Mental Model in One Sentence

A hub is your team's home — you belong there, you communicate there, you track your work there. A tool is a focused application your team uses — you launch it from your hub, do the work, and return.

The hub gives you context. The tool gives you capability. Together they form a complete workspace without either one trying to be both things at once.

---

## 15. Database Schema Reference

All hub-related models in `prisma/schema.prisma`:

| Model | Table | Key Fields | Purpose |
|-------|-------|------------|---------|
| `Hub` | `hubs` | `slug` (unique), `name`, `type`, `status`, `hasSchedule`, `welcomeHeadline`, `welcomeBody` (JSON), `homeContent` (JSON), `documentCategories[]`, `conversationCategories[]` | Hub definition |
| `HubType` | enum | `OPERATIONAL`, `GOVERNANCE`, `COMMUNITY_GROUP` | Hub classification |
| `HubStatus` | enum | `ACTIVE`, `ARCHIVED` | Hub lifecycle |
| `HubAppLink` | `hub_app_links` | `hubId`, `label`, `href`, `order`, `isEnabled` | Hub-to-tool connection |
| `HubMember` | `hub_members` | `hubId` + `userId` (unique), `position`, `isCoordinator`, `joinedAt`, `lastVisitedAt`, `firstVisitedAt` | Hub membership |
| `HubDocument` | `hub_documents` | `hubId`, `addedById`, `label`, `url`, `fileType`, `category`, `isNative`, `isLocked`, `body` (JSON) | Hub document library |
| `HubConversationThread` | `hub_conversation_threads` | `hubId`, `authorId`, `title`, `body` (JSON), `status`, `isPinned`, `pinnedAt`, `category` | Hub discussions |
| `HubConversationReply` | `hub_conversation_replies` | `threadId`, `authorId`, `body` (JSON) | Thread replies |
| `UserHubAccess` | `user_hub_access` | `userId` + `hubSlug` (unique) | Alternative access (Course Hub only) |
| `TaskList` | `task_lists` | `hubId`, `name`, `isTemplate`, `isArchived` | Task organization |
| `Task` | `tasks` | `listId`, `title`, `body` (JSON), `assigneeId`, `status` (OPEN/IN_PROGRESS/DONE), `dueDate` | Individual tasks |
| `Subtask` | `subtasks` | `taskId`, `title`, `status` | Task subtasks |

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · March 2026 (updated session 76)*
