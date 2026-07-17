# The RIM Hub and Tools Model

**The definitive architecture guide for the hub/tools platform.**

This document is complete enough that a new developer (or a new Claude Code session) can understand the entire hub/tools system without reading any code. It covers the conceptual model, database lifecycle, tool creation patterns, data scoping, access control, mobile patterns, and extension points.

**Claude Code: Read this before working on any hub, tool, app link, sidebar, or scoped data feature.**

---

## 1. The Two Layers

Everything in the volunteer platform lives in one of two layers:

**Hubs are team homes.** A hub is where a team exists — where they communicate, coordinate, share Google Workspace files, and know who's on their team. Every hub has the same built-in structure regardless of what team it serves.

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

The create route also adds the creating admin as the first active coordinator and best-effort provisions the Space's Google Files folder. The built-in sections (Home, Activity, Conversations, Files when provisioned, and Members) are available without per-hub navigation configuration; coordinator/leadership-gated Trash appears when applicable.

**Database defaults on creation:**
- `status` → `ACTIVE`
- `hasSchedule` → `false`
- `welcomeHeadline` → `null` (no newcomer welcome)
- `welcomeBody` → `null`
- `homeContent` → `null`
- `conversationCategories` → `["General"]`
- `conversationsEnabled` → `true`
- `assignmentGrantsTeacher` → `false` (added session 128 — see below)
- `teacherLabel` → `null`

**Hub-as-source-of-teacher-capability (session 128).** When `assignmentGrantsTeacher: true`, an active `HostAssignment` from this hub confers Teacher capability in `resolveSessionRole` — bell-friendly audio profile + the Teacher pill (label from `Hub.teacherLabel`, falling through to "Teacher"). This is how peer-led hubs work: the act of claiming a session IS the teacher capability for that session. No per-user `ProgramTeacher` row is required. The first hub to set this is `peer-led-silent-meditation` (Slice 2 setup) with `teacherLabel: "Guide"`. The host-team hub keeps `assignmentGrantsTeacher: false` — its assigned hosts get host capability only; Teacher capability for host-team programs comes from `ProgramTeacher` rows.

### Step 2: Admin adds members

The admin adds members to the hub. Each addition creates:

| Record | Table | Key fields |
|--------|-------|------------|
| `HubMember` | `hub_members` | `hubId` + `userId` (unique pair), `position`, `isCoordinator` (false by default), `joinedAt` |

A `HubMember` record is the normal access gate. The hub layout resolves membership and calls `canAccessHub(member, roles)`: a membership row or `GUIDING_TEACHER` pastoral authority opens the hub. (Paused/inactive status governs capabilities and communications, not basic visibility.) ADMIN alone does **not** bypass the content door; administrators configure hubs from `/admin/hubs` and participate inside a hub as members (unless they also hold GUIDING_TEACHER).

All hubs use `HubMember` exclusively. No alternative access grant mechanism exists.

### Step 3: Admin assigns a coordinator

The admin edits a member's record and sets `isCoordinator: true`. This grants coordinator-level permissions on hub content (member tending, home content where supported, pinning threads, lifecycle/share controls). It does not grant the ADMIN-only hub-configuration page at `/admin/hubs/[slug]/edit`; that page controls structural fields such as slug, type, and app links.

The `requireCoordinator()` helper in `lib/hubAuth.ts` enforces this:
```
if (!isCoordinator && !roles.includes("ADMIN")) throw new Error("coordinator_required")
```

### Step 4: Admin connects tools via app links

In the hub edit form, the admin adds app links. Each one creates:

| Record | Table | Key fields |
|--------|-------|------------|
| `HubAppLink` | `hub_app_links` | `hubId`, `toolSlug`, `label`, `href`, `order`, `isEnabled` (true) |

Example app links seeded for existing hubs:

| Hub | App Link Label | href |
|-----|---------------|------|
| Host Team | Host Schedule | `/tools/schedule` |
| Registrar Hub | Program Manager | `/tools/programs` |

**Update strategy:** The PATCH endpoint replaces app links and hub configuration inside one database transaction. Existing rows remain valid until the replacement and hub update can both succeed.

**Registered app contract:** `toolSlug` identifies a registered app in `lib/toolRegistry.ts`. The registry declares whether the app is multi-Space safe or restricted to one primary Space, plus its Home and Activity contribution adapters. Scheduler is multi-Space; Program Manager is restricted to `registrar`; Course Manager is restricted to `courses`. A custom link has `toolSlug: null`: it is navigation only and never grants tool access or contributes app data.

### Step 5: Coordinator configures hub content

The coordinator (or admin) can now:
- Edit the Home welcome and orientation inline via `RimTiptapEditor` (also available in hub admin)
- Set a welcome headline and body for newcomer interstitials (stored as `welcomeHeadline` / `welcomeBody`)
- Create conversation categories, document categories
- Pin important conversation threads

### Step 6: Members use the hub

When a member navigates to `/account/hub/[slug]`:

1. **Auth check** — redirect to `/login` if not authenticated
2. **Hub fetch** — query `hubs` by slug, include `members` and `appLinks`
3. **Access check** — resolve the `HubMember` row and apply `canAccessHub(member, roles)`
4. **Sidebar render** — `HubWorkspaceSidebar` receives hub identity, tools, counts, coordinator/trash authority, and admin state
5. **First visit tracking** — if both `firstVisitedAt` and prior `lastVisitedAt` are null, show the welcome interstitial and set the timestamp (the second check protects established members created before first-visit tracking)
6. **Read tracking** — `lastVisitedAt` remains the Home/conversation boundary; `activitySeenAt` is updated only when Activity opens

---

## 3. The Hub Sidebar

Every hub has one left workspace rail (collapsible/sticky on desktop; drawer on mobile) beneath the shared member header. It stays present when a member opens a hub-linked tool, so team identity is not lost. The rail has four parts:

**Identity** — hub type label (e.g. "Operational Hub"), hub name, member count, coordinator name(s). Always visible so you always know where you are.

**Flat work sequence** — Home, enabled apps/links, then Activity, Conversations (when enabled), Files (when provisioned), and Members. These built-in destinations are the same in every hub; improving one improves every hub because the components are shared.

**Apps and links** — registered apps and custom navigation rendered from `HubAppLink` records immediately below Home. Registered apps receive `?hub=<slug>` so `WorkspaceShell` preserves this rail; custom links retain their exact URL.

**Footer actions** — Trash for people with trash authority, Hub settings for ADMIN only, and Back to Home for everyone.

**No hub-specific sections.** All hubs have the same built-in module set. Hub-specific functionality (course management, program management, scheduling) lives in linked tools. No hub injects custom nav items.

### Sidebar nav item construction (in layout.tsx)

```
const navItems = [
  { label: "Home",          href: base },
  { label: "Activity",      href: `${base}/activity` },
  { label: "Conversations", href: `${base}/conversations` },
  { label: "Files",         href: `${base}/files` },
  { label: "Members",       href: `${base}/members` },
];
```

### Active state logic

- Home (the root nav item): exact match only (`pathname === href`)
- All other sections: prefix match (`pathname === href || pathname.startsWith(href + "/")`)

---

## 4. Connecting Tools to a Hub

An admin connects a registered app or custom link in `/admin/hubs/[slug]/edit`. Registered apps are offered only where their registry contract says their data and authority are safely scoped. Existing legacy installations are preserved during ordinary edits, but new incompatible installations are rejected by both the UI and API.

Once added, every enabled item appears in the sidebar and on the universal Home. Registered apps contribute live, server-rendered context — for example registrations, draft courses, or hub-scoped Scheduler gaps. Custom links render as connected links with no access grant or data adapter.

Only apps declared `multi-space` can be installed in multiple hubs. An app declared `primary-space` is installable only in its named hub until its queries, writes, and permissions are genuinely hub-scoped.

---

## 4½. Connecting Programs to a Hosting Hub (session 128)

App links connect a *tool* to a hub (UI navigation). Programs connect to a *hosting hub* (data ownership) via a separate mechanism: the `Program.hostingHubSlug String?` field. This declares which hub's members are responsible for hosting this program — claiming sessions, holding sub-requests, receiving notifications when the program needs coverage, and (when the hub grants teacher capability) carrying the Teacher pill in the session room.

**Null defaults to `"host-team"`** — every existing program in the system stays with the Host Team without any backfill. The field is purely additive.

**Why a direct field, not the program's category?** Categories are coordinator-editable UI groupings. If a coordinator deletes/renames a category, hosting policy would silently break. Same lesson as the session 125 identity-vs-capability audit: don't overload one field with two meanings. The hosting hub is structural; the category is editorial.

**Lookup helpers (`lib/programHub.ts`):**

- `getProgramHubSlug(programSlug)` → `string` (always returns a slug; `"host-team"` for null)
- `getProgramHostingHub(programSlug)` → `{ slug, assignmentGrantsTeacher, teacherLabel } | null`
- `resolveTeacherPillLabel(programLabel, hubLabel)` — pill hierarchy `program.teacherLabel ?? hub.teacherLabel ?? "Teacher"`
- `DEFAULT_HOSTING_HUB_SLUG = "host-team"`

**Which routes consult this:**

- Zoom entry host-capability resolution through `lib/sessionAuth.ts` (the old participant-pill language is historical)
- `/api/host/assignments` POST self-claim (capability gate routes by program's hub)
- `/api/host/sub-requests` POST + `[id]/claim` (capability + notification recipient pool)
- `/api/programs-pg` POST (new-program host-needed notification routes to program's hub)
- `/tools/schedule?hub=...` (filters programs by `hostingHubSlug`)
- `lib/livekitAuth.ts::resolveSessionRole` (Co-host + Step-In gates)

**Editor surface.** The Program editor's "Hosting & Access" tab carries the hub dropdown. Default option "Host Team (default)" stores null. Mid-flight warning fires when changing the hub on a program with future HostAssignments — those assignments stay valid (grandfather policy); new claims route to the new hub.

**Slug validation.** POST + PUT on `programs-pg` reject non-existent hub slugs with 422.

**Slice 2 of the Silent Meditation Hub (queued).** This architecture is inert until a hub is created with `assignmentGrantsTeacher: true` and programs are moved. The first such hub will be `peer-led-silent-meditation`.

---

## 5. Navigating to a Tool

When a hub member clicks a tool link from the sidebar, two things happen:

**First**, the `?hub=registrar` query parameter is appended to the URL. This tells the tool which hub launched it. The sidebar appends it like this:
```
const toolHref = link.href.includes("?")
  ? `${link.href}&hub=${hub.slug}`
  : `${link.href}?hub=${hub.slug}`;
```

**Second**, `WorkspaceShell` reads that context and keeps the hub's `HubWorkspaceSidebar` in place while rendering the tool's task header/sub-navigation in the content area. The member remains visibly inside the team workspace.

The tool works the same regardless of how it was reached. Direct navigation without `?hub=` uses the compact `ToolsNav` header; its resolved back link returns a member to the tool's primary hub when appropriate and otherwise to Home.

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

**Hub access** is controlled by the `canAccessHub` door: a `HubMember` relationship, or GUIDING_TEACHER pastoral reach. ADMIN alone configures from outside and does not inherit private hub content. This is about belonging to a team, with one explicit dharma-authority exception.

**Tool access** is controlled by `hasToolAccess()`. It grants access through a required role/ADMIN, an individual `UserToolAccess` row, or ACTIVE membership in an ACTIVE hub with an enabled registered `HubAppLink` for that tool. This is about being authorized to do specific work; the tool's own page/API gates remain the security boundary.

Hub content access and tool access remain separate decisions even though hub membership is one valid tool-grant pathway. A visible shell or link never replaces the gate.

### Tool access matrix

| Tool | Route | Required Role | Primary Hub |
|------|-------|--------------|-------------|
| Course Manager | `/tools/learning` | TEACHER or ADMIN | courses |
| Program Manager | `/tools/programs` | REGISTRAR or ADMIN | registrar |
| Scheduler | `/tools/schedule` | linked-hub member, HOST_MANAGER, ADMIN, GT, or grant | scheduler-enabled hubs |

All tools also support individual access grants via `UserToolAccess` — admins can grant a specific user access to any tool without assigning them the full role. See `lib/toolAuth.ts`.

### Role gate pattern

Each tool's `layout.tsx` calls the shared helper:
```
const roles = session.user.roles ?? [];
const hasAccess = await hasToolAccess(userId, roles, ["REQUIRED_ROLE"], "tool-slug");
if (!hasAccess) return <div>You don't have permission...</div>;
```

Do not replace this with an inline role-only check; that would silently remove hub and individual-grant pathways.

### Hub section access

Home, Activity, Conversations, Files, and Members are the shared module set. Resource/action gates still apply inside each module; “the tab is visible” is not blanket edit authority.

Coordinator actions use the canonical coordinator helpers; structural Hub settings stays ADMIN-only. **Trash** appears only for trash-managers (Admin, Guiding Teacher, or hub coordinator) and offers Restore + Permanent Delete. See "Three-stage delete" below.

### Three-stage delete (Active → Archived → Trash)

Conversation threads use a three-stage soft-delete lifecycle (introduced session 113):

1. **Active** — default state; threads appear in the "Active" filter.
2. **Archived** — author or coordinator can archive; threads use `status: "CLOSED"` (relabeled "Archived" in the UI).
3. **Trash** — the only action available on an Archived item is "Delete", which soft-deletes the item: it disappears from member view entirely and surfaces only on the per-hub Trash page (`/account/hub/[slug]/trash`).

From Trash, a trash-manager can **Restore** (to archived) or **Delete permanently** (irreversible cascade).

Members never have a "go straight to trash" option. The Archive step is deliberate — it's reversible and visible. Trash is the second deliberate step that puts the item in front of leadership for review before final removal.

The gate for trash management is `canManageTrash(roles, isCoordinator)` in `lib/hubAuth.ts`. Returns true if `ADMIN ∈ roles || GUIDING_TEACHER ∈ roles || HubMember.isCoordinator === true` on this hub.

### Conversation thread subscriptions

Each thread has an explicit subscriber list (`HubThreadSubscription`, introduced session 113). Subscribers receive every reply automatically. Who becomes a subscriber:

- **Author** (always, source `AUTHOR`)
- **All hub coordinators** at thread creation (source `COORDINATOR_AUTO`)
- **Anyone the author picks** in the "Also notify" panel below the compose form (source `ADDED`)
- **The replier** on any reply (source `ADDED`) — subscribe-by-replying
- **Anyone added** via the "+ Notify someone new…" picker on a reply (source `ADDED`)
- **Anyone who self-subscribes** via the `Follow` button in the thread header (source `SELF`)

A subscriber can unsubscribe themselves any time. This model replaced the previous implicit "notify coordinators on new thread / notify participants on reply" — same default behavior, but now an explicit row exists per subscriber so the email recipient list is queryable and overridable.

### Access summary

| Question | Canonical answer |
|---|---|
| May this person enter the hub? | `canAccessHub(member, roles)` — member or GUIDING_TEACHER; ADMIN alone does not pass |
| May this person manage this hub action? | `effectiveCoordinator` / action-specific helper |
| May this person open a tool? | `hasToolAccess()` — role/ADMIN, individual grant, or linked-hub membership |
| May this person open a hub's Scheduler? | `canAccessHubScheduler()` — the Scheduler's stricter per-hub door |
| May this person configure the Hub record? | ADMIN-only `/admin/hubs/*` |

See `RIM_Role_Design.md`, `RIM_Hub_Engineering.md`, and each per-tool document for the full matrices.

---

## 7. Shared Hub Context and Data Scoping

### How hub context flows

```
Workspace-rail click → URL (?hub=slug) → WorkspaceShell / server page → hub context
                                → ToolsContext (client) → useToolsContext().hubSlug
```

1. **HubWorkspaceSidebar** appends `?hub=<slug>` to every tool link href
2. **Server-side:** Page components receive `searchParams` prop with `hub` param. Call `getToolHubContext(hubSlug)` from `lib/toolAuth.ts` to get the full hub record with members. This is the primary hub awareness mechanism.
3. **Client-side:** `ToolsContext` reads `?hub=` from `useSearchParams()` for any client components that need the hub slug.

### Hub awareness in tools (implemented)

**Scheduler** — reads `?hub=`, resolves a scheduler-enabled hub, gates that hub, and scopes programs/assignments to the active hub. Direct entry falls back to `host-team`.

**Program Manager and Course Manager** — not yet hub-aware (no hub member queries needed currently). When a tool serves multiple hubs, it will add `getToolHubContext()` to scope its data.

### Data scoping pattern

Tools query data globally by default. When hub context is available, they can scope:

**Program Manager** — fetches all programs regardless of hub context:
```
db.program.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
```
This is correct for now — the Registrar Hub is the only hub that links to Program Manager, and registrars need the complete view.

**Scheduler** — is fully hub-scoped; multiple hubs use it with different coverage semantics. See `RIM_Scheduler.md`.

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

Hub-native sections such as Conversations, Activity, Files, and Members scope by the resolved hub. Files authorize by their resolved Space place and folder subtree; the hub slug is context, not sufficient proof by itself.

```typescript
// Conversations page
const threads = await db.hubConversationThread.findMany({
  where: { hubId: hub.id },
  orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
});

// Portable resource pages instead use canAccessDocument / canAccessMindMap
// and include origin OR placement into the current hub.
```

This distinction is the model for tool scoping too: derive scope from the resource model, not from the visible sidebar alone.

---

## 8. Tool Creation Pattern

Step-by-step guide for building a new tool from scratch.

### Checklist

- [ ] **1. Create the route directory:** `app/tools/<tool-name>/`
- [ ] **2. Create `layout.tsx`** — the tool shell:
  - Import `auth`, `redirect`, `ToolsProvider`, `WorkspaceShell`, `hasToolAccess`
  - Auth check: `if (!session) redirect("/login")`
  - Access gate: call `hasToolAccess()` with the baseline roles + registered tool slug
  - Resolve back link: look up the tool's primary hub, check if user is a member
  - Wrap children in `ToolsProvider` + `WorkspaceShell`
- [ ] **3. Create `page.tsx`** — the main tool page:
  - Fetch data (scoped or global depending on use case)
  - Render the tool UI
- [ ] **4. Create sub-pages** (if needed): `app/tools/<tool-name>/<sub>/page.tsx`
  - Add sub-nav items to the `ToolsProvider` value in layout.tsx
- [ ] **5. Reuse the smallest existing authority model**; add a role only if the power is genuinely system-wide. Prefer linked-hub membership or `UserToolAccess` for team/individual access.
- [ ] **6. Register the app link** — add a `HubAppLink` record connecting the tool to its primary hub:
  - Via the hub admin edit form at `/admin/hubs/[slug]/edit`
  - Or via `seed-hubs.ts` for initial seeding
- [ ] **7. Update documentation:**
  - Add tool to the access control table in this document
  - Create its `RIM_<ToolName>.md` per-tool reference and add it to the Design Orientation table
  - Update `FEATURES.md`, `UP_NEXT.md`, and the session log

### Template: tool layout.tsx

```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ToolsProvider } from "@/components/ToolsContext";
import WorkspaceShell from "@/components/WorkspaceShell";
import { hasToolAccess } from "@/lib/toolAuth";

export default async function MyToolLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const hasAccess = await hasToolAccess(session.user.id, roles, ["MY_ROLE"], "my-tool");

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
      <WorkspaceShell variant="wide">{children}</WorkspaceShell>
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

**Host Schedule** (from Host Team Hub → `/tools/schedule`)
- *Why extracted:* Calendar-based staffing UI with a mini-calendar, occurrence rows, coverage actions, and standing rotations; now reused across several coverage hubs.
- *Pattern:* A hub-scoped operational app. The Space is where the team coordinates (Home, Activity, Conversations, Files); the Scheduler is where coverage work happens.

### The decision rule

> If the feature needs its own sub-pages, its own navigation, or a full-screen workflow — extract it to a tool. If it's a view that fits naturally in the hub's content area — keep it as a hub section.

When in doubt, start as a hub section. Extract to a tool when the hub section starts feeling cramped or when it needs navigation that conflicts with the hub sidebar.

---

## 10. Built-in Sections Architecture

The built-in sections are shared infrastructure. Every hub gets them for free. Improving one improves all hubs.

### Home

**Route:** `/account/hub/[slug]` (page.tsx)

**What it shows:**
- A greeting and one plain-language attention sentence
- The first-visit welcome interstitial for genuinely new members
- Coordinator-editable persistent welcome (where configured) and orientation content
- One card for every enabled `HubAppLink`; registered apps add live context through `lib/hubApps.ts`, custom links remain quiet navigation
- App modules below their card when the contract provides one (Scheduler-owned Spaces use the hub-scoped “Our offerings this month” module)
- Pinned conversation threads (from `HubConversationThread` where `isPinned: true`)
- A recent Activity preview across the same shared stream (without marking it read)

**Extension points:**
- `welcomeBody` and `homeContent` are HTML strings stored in the existing JSON fields and edited inline or in hub admin
- A new app extends the registry contract and a server adapter; the base Home component does not branch by hub slug
- `Hub.hasSchedule` controls the Scheduler month module and Program Editor hosting eligibility; it no longer selects a separate Home implementation

### Activity

**Route:** `/account/hub/[slug]/activity`

A computed, hub-scoped stream that brings together conversation starts/replies, visible Google Files events, member joins, and installed Scheduler events. It is a projection, not a separate activity model. The page and API share `lib/hubActivity.ts`, including filter semantics and pagination. `HubMember.activitySeenAt` is an independent read boundary; visiting Home does not clear Activity.

### Conversations

**Route:** `/account/hub/[slug]/conversations`

**What it shows:**
- Threaded discussions scoped to `hubId`
- Pinned threads appear first
- Category filtering (from `hub.conversationCategories[]`)
- Thread detail with replies at `/conversations/[id]`

**Data model:** `HubConversationThread` (title, body as HTML, status, isPinned, pinnedAt) → `HubConversationReply` (body as HTML)

### Files

**Route:** `/account/hub/[slug]/files`

**What it shows:** the Space's Google Workspace folder/Drive through RIM's authorization layer. Files remain in Google; RIM supplies identity, attribution, draft/share state, comments, and governed deletion. See `RIM_GoogleWorkspace.md`.

### Members

**Route:** `/account/hub/[slug]/members`

**What it shows:**
- All hub members with name, position, coordinator badge
- Last visited timestamp
- Member count

**Data model:** `HubMember` (hubId, userId, position, isCoordinator, joinedAt, lastVisitedAt, firstVisitedAt, activitySeenAt)

### No Hub-Specific Additions

No hub has custom nav items. All hub-specific functionality has been extracted to tools:

- Course/Lesson management → `/tools/learning` (Course Manager tool)
- Program management → `/tools/programs` (Program Manager tool)
- Host scheduling → `/tools/schedule` (Host Schedule tool)

Hubs connect to their tools via app links in the rail. This keeps the built-in workspace structure consistent while allowing different teams to use different operational applications.

---

## 11. App Link and Home Screen Pattern

### How app installations work today

An app link is a record in the `hub_app_links` table:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | String (cuid) | Primary key |
| `hubId` | String | Foreign key to `hubs` |
| `toolSlug` | String? | Registered app identity; null means custom link |
| `label` | String | Display text (e.g. "Program Manager") |
| `href` | String | Tool URL path (e.g. "/tools/programs") |
| `order` | Int | Sort order (0-based) |
| `isEnabled` | Boolean | Show/hide toggle |

**In the sidebar:** Rendered directly below Home. Registered apps receive `?hub=<slug>`; custom links keep the exact configured href.

**On the home screen:** `HubHomeClient` renders every enabled installation in one Apps section. `lib/hubApps.ts` resolves registered adapters and supplies live counts/copy; custom links receive no adapter.

### Registry contract

`lib/toolRegistry.ts` is the app manifest. Each registered app declares:

- canonical slug, label, path, and description
- `spaceMode`: `multi-space` or `primary-space`
- `primarySpaceSlug` when restricted
- `homeContribution`
- `activityContribution`

The installation is intentionally the only modifier layered onto the general Space. It may add navigation, a Home card/module, Activity events, and active-member tool access. It must not replace the Home, introduce hub-name conditionals, or make a global tool appear hub-scoped when it is not.

Current contracts:

| App | Space mode | Home | Activity |
|---|---|---|---|
| Scheduler | multi-space | hub-scoped open coverage + optional month module | cover requests + claims |
| Program Manager | primary-space (`registrar`) | recent registrations | none until its mutations have durable actor attribution |
| Course Manager | primary-space (`courses`) | draft courses | none until its mutations have durable actor attribution |

**Authorization rule:** only ACTIVE members inherit access through a registered app on an ACTIVE hub. Role grants and `UserToolAccess` remain separate pathways. Custom links never grant access.

---

## 12. Mobile Navigation

### Mobile sidebar drawer

On small screens, the `hub-ws-` rail transforms into a slide-in drawer:

**CSS behavior:**
- Sidebar becomes fixed-position overlay (260px wide, full viewport height)
- Default state: `transform: translateX(-100%)` (hidden off-screen left)
- Open state (`.hub-ws-sidebar--open`) slides the rail in
- Backdrop overlay appears behind sidebar when open (click to close)

**Mobile top bar:**
- A condensed `.hub-ws-mobilebar` appears with the menu button and hub name
- Hidden on desktop via `display: none`, shown on mobile via media query

**Interaction:**
- Hamburger button sets `mobileOpen: true` → sidebar slides in
- Clicking any nav link calls `setMobileOpen(false)` → sidebar auto-closes
- Clicking the backdrop also closes the sidebar

### Mobile patterns for tools

Tools should follow these patterns on mobile:

**Hub-launched tools:** keep the same drawer through `WorkspaceShell`. **Direct-entry tools:** use `ToolsNav`.

**Sub-nav tabs:** Tools with sub-navigation render as horizontal scrollable tabs. Keep them task-specific and preserve 44px touch targets.

**Guideline for new tools:** Design mobile-first. If the tool has a list → detail pattern, use the full-screen progressive disclosure pattern (list screen → detail screen). Avoid side-by-side panels on mobile.

---

## 13. The Current Hub Inventory

### Active operational hubs

| Hub | Slug | Tools | Hub-Specific Sections |
|-----|------|-------|----------------------|
| Host Team | `host-team` | Host Schedule | — |
| Course Hub | `courses` | Course Manager | — |
| Registrar Hub | `registrar` | Program Manager | — |
| Support Hub | `support` | — | — |
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
| `Hub` | `hubs` | `slug` (unique), `name`, `type`, `status`, `hasSchedule`, `welcomeHeadline`, `welcomeBody` (HTML), `homeContent` (HTML), `documentCategories[]`, `conversationCategories[]` | Hub definition |
| `HubType` | enum | `OPERATIONAL`, `GOVERNANCE`, `COMMUNITY_GROUP` | Hub classification |
| `HubStatus` | enum | `ACTIVE`, `ARCHIVED` | Hub lifecycle |
| `HubAppLink` | `hub_app_links` | `hubId`, `label`, `href`, `order`, `isEnabled` | Hub-to-tool connection |
| `HubMember` | `hub_members` | `hubId` + `userId` (unique), `position`, `isCoordinator`, `joinedAt`, `lastVisitedAt`, `firstVisitedAt` | Hub membership |
| `HubDocument` | `hub_documents` | nullable origin `hubId`, `addedById`, `label`, `docKind`, `visibility`, `category`, `body` (HTML), lifecycle fields | Portable document resource |
| `HubDocumentPlacement` | `hub_document_placements` | `documentId`, `hubId` | Cross-hub document placement |
| `MindMap` | `mind_maps` | nullable origin `hubId`, `addedById`, `visibility`, `editPolicy`, lifecycle fields | Portable spatial-conversation resource |
| `MindMapPlacement` | `mind_map_placements` | `mapId`, `hubId` | Cross-hub map placement |
| `MindMapNode` | `mind_map_nodes` | `mapId`, `parentId`, label/note/position | Topic/branch node; conversation anchor |
| `HubConversationThread` | `hub_conversation_threads` | `hubId`, `authorId`, `title`, `body` (HTML), `status`, `isPinned`, `pinnedAt`, `category` | Hub discussions |
| `HubConversationReply` | `hub_conversation_replies` | `threadId`, `authorId`, `body` (HTML) | Thread replies |
| `HubThreadSubscription` | `hub_thread_subscriptions` | `threadId`, `userId`, `source`, `@@unique([threadId, userId])` | Per-thread subscriber list (session 113) |
| `HubDocumentNotification` | `hub_document_notifications` | `documentId`, `userId`, `eventType` | Per-document notification event log (session 113) |

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · updated session 167 (2026-07-17) — universal Home, registered-app contract, multi-source Activity, independent Activity read boundary, Google Files-era built-ins.*
