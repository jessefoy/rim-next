# RIM Mind Maps — per-tool reference

**Read this before working on any mind-map surface** (`/account/mindmaps`, the hub Mind Maps tab, the canvas editor, the `/api/mindmaps/*` routes, `lib/mindMapAuth.ts`, `lib/mindMapConversation.ts`). Pairs with `RIM_System_Architecture.md` (portable-resource model), `RIM_Documents.md` (the pattern Mind Maps mirrors), and `RIM_Hub_Engineering.md` (the four routing layers).

---

## What it is

A **mindful, collaborative brainstorming surface for the Sangha**: a spatial canvas of **topics** that can be dragged and reorganized into branches, where **each topic opens a real conversation**. Built in three slices on a throwaway POC (session 160, 2026-06-29). It is RIM's **second portable resource after Documents** — created/owned inside a hub, shareable across hubs with its own visibility, and surfaced as a **built-in hub module** alongside Documents and Conversations.

The metaphor was validated first with a throwaway no-auth POC (`/mindmap-preview`, since removed) before any schema landed — Jesse judged the spatial canvas a good fit; his one note ("the connections line up funny") drove the floating-edge decision.

Library: **`@xyflow/react`** (React Flow, MIT) — the one new dependency. Custom CSS prefix **`mm-`** (tokens only).

---

## Slice history

- **Slice 0 (POC, removed):** a throwaway `@xyflow/react` canvas with hardcoded sample nodes at a no-auth `/mindmap-preview` route — purely to judge the metaphor. Removed in Slice 1; its `mm-` styling was kept and became the real look.
- **Slice 1 — a persistent map:** `MindMap` + `MindMapNode`, the canvas editor (add / rename / note / drag / reparent / delete), **floating edges** + a **"Tidy up"** layout, debounced **autosave**. Standalone at `/account/mindmaps`, private to the author.
- **Slice 2 — a portable hub module:** `MindMapPlacement` + per-map `editPolicy`; the **Mind Maps hub tab**, the **share modal** (visibility + edit option + place into hubs), the directory reworked into hub/Community/Projects sections.
- **Slice 3 — a conversation per topic:** the `mindMapNodeId` thread anchor, the map-scoped conversation/follow/react routes, the in-panel conversation UI, the `mindmap-topic-comment` email.

---

## Data model (`prisma/schema.prisma`)

- **`MindMap`** (`mind_maps`) — mirrors `HubDocument`. `id`, `addedById` (author), `title`, `description?`, `hubId?` (origin hub — null = a standalone "project" map), `visibility` (string `HUB`/`COORDINATORS`/`COMMUNITY`, validated in routes), **`editPolicy`** (string `OPEN`/`RESTRICTED` — the per-map edit option), `archivedAt?`/`deletedAt?` lifecycle, timestamps. Relations: `nodes`, `placements`.
- **`MindMapNode`** (`mind_map_nodes`) — `mapId`, **`parentId?`** (self-FK = the branch link; `onDelete: SetNull`; null = a root/free-floating node), `label`, `note?`, `x`/`y` (Float). Edges are **derived from `parentId`** — there is no edge table ("reconnect a line" = change `parentId`). `threads` back-relation (the node's conversation).
- **`MindMapPlacement`** (`mind_map_placements`) — clone of `HubDocumentPlacement`: `mapId` + `hubId`, `@@unique([mapId, hubId])`, cascade both ways. Origin (`MindMap.hubId`) is never a placement (rejected on create).
- **`HubConversationThread.mindMapNodeId?`** — the conversation anchor, parallel to `documentId`, `onDelete: Cascade`. **`@@unique([mindMapNodeId])`** (nullable → Postgres allows many NULLs but enforces one thread per topic).

Migrations (idempotent, flag-guarded, snake_case): `create_mind_maps_tables`, `create_mind_map_placements_and_edit_policy`, `add_mindmapnodeid_to_threads`, `seed_mindmap_topic_comment_email_template`.

---

## Access model (`lib/mindMapAuth.ts`) — mirrors `documentAuth.ts`

Pure, placement-aware functions; load the map's access shape + the viewer's **ACTIVE** memberships once, filter in memory.

- **`canAccessMindMap`** (open it): author **or** GUIDING_TEACHER **or** COMMUNITY-visibility **or** a member of a hub the map is in (HUB) / a coordinator of one (COORDINATORS). ADMIN-alone does **not** pass (session-128 boundary).
- **`canEditMindMap`** (edit the canvas) honors the **per-map option**: author/GT always; if `editPolicy === "OPEN"` → returns `canAccessMindMap` (a **collaborative canvas** — anyone who can see it edits); if `"RESTRICTED"` → only a coordinator of a hub the map is in (document-parity).
- **`canManageMindMapSharing`** (visibility + sharing): author, origin-hub coordinator, or GT. **`canRemoveMindMapPlacement`**: the origin side, or a coordinator of the specific hub being removed (a team declining a shared map).

**Gate-load rule (reviewer-caught):** every membership query that feeds an access/edit gate filters `status: "ACTIVE"` — a removed/paused member's stale `HubMember` row must not confer access, and with `editPolicy: OPEN`, access == edit.

---

## The three surfaces

1. **Master directory** `/account/mindmaps` — a cross-hub finder. Sections: your hubs → Community → Projects (hubless personal maps), built via `canAccessMindMap` over a placement-aware candidate query (mirrors `/account/documents`). "New mind map" here creates a **hubless personal/project map**. Authored maps expose Share.
2. **Hub module** `/account/hub/[slug]/mindmaps` — a **built-in hub tab** (added to `HubWorkspaceSidebar`'s `otherItems`, like Documents). Lists maps that originate in or are shared into the hub; "New mind map" here creates a **hub-owned** map (`hubId` = this hub, gated by `canAccessHub`). Per-card Open / **Share** (origin + canManage) / **Remove from hub** (placed-in, coordinator) / **Delete** (author/GT). Badges: "Shared from [hub]" / "Community" / "Shared".
3. **Canvas editor** `/account/mindmaps/[id]` — full-screen React Flow (`MindMapEditor`, mounted via `MindMapEditorMount` with `dynamic(ssr:false)`). Topic nodes (Left target + Right source handles), **floating edges** (`FloatingEdge` + `floatingEdgeUtils` — the React Flow floating-edge recipe), drag/pan/zoom, reparent via edge reconnection (`onReconnect` → `setParent`, with a cycle guard), add (button + double-click pane), delete (guarded, no Backspace), "Tidy up" (a simple left→right tree layout + fit). Side panel: title + note (edit-gated) and the **conversation** (view-gated).

**Save model:** debounced autosave (~800ms), edit-driven (not selection-driven), **serialized on one in-flight promise chain** (no two concurrent PATCHes → no out-of-order writes), flushed on unmount with `keepalive`. The editor exposes an imperative **`flushSave()`** so a brand-new topic is persisted before its first comment. Snapshot PATCH `/api/mindmaps/[id]` upserts the node set in a transaction (two-pass `parentId` to avoid self-FK ordering issues; deletes absent nodes). Client owns stable node ids (`crypto.randomUUID()`) so ids persist — which the conversation anchor relies on.

---

## Conversations (`lib/mindMapConversation.ts`)

**One shared conversation per topic, across every hub the map lives in** (Jesse's choice — not a separate thread per hub). Reuses the hub conversation **tables** (thread/reply/subscription/reaction) but behind **NEW routes gated on `canAccessMindMap`**, not `canAccessHub` — because participants span hubs and the existing hub routes would leak/limit by a single hub. **Participation follows VIEW access** (anyone who can open the map can comment); canvas editing is separate.

- **One thread per node**, created **lazily on the first comment** (`mindMapNodeId` set, `hubId` = the map's origin hub or first placement as a nominal home, `title` = node label). Comments are `HubConversationReply` rows, stored as **plain text** (v1). Follows = `HubThreadSubscription`. Reactions = the existing 5-emoji per-user-array.
- Routes: `GET`/`POST /api/mindmaps/[id]/nodes/[nodeId]/conversation`, `POST`/`DELETE .../follow`, `POST /api/mindmaps/[id]/comments/[replyId]/react`. The react route verifies `reply.thread.mindMapNode.mapId === id` (rejects cross-map + hub-only threads). The create path catches the `@@unique([mindMapNodeId])` violation from a concurrent first-comment and uses the winner.
- UI: `MindMapNodeConversation` in the editor side panel (comments, plain-text compose, 5-emoji reactions, Follow/Unfollow). Submits `await flushSave()` then POST (with a 409-retry if the node isn't persisted yet). A **hubless map with no placements shows "Place this map in a hub to start conversations"** (notifications need a hub home).

### Notifications + Email Template Gate
- **One template: `mindmap-topic-comment`** (seeded in `migrate.mjs`, `enabled: true`, group `05-hubs`; sent via `sendMindMapCommentEmail`; gated in `PRE_THRESHOLD_GATED_SLUGS`). It **deep-links to the map** (`/account/mindmaps/[id]`) — the existing `hub-conv-*` templates build a hub-conversation URL, which is wrong here, so a new slug was required.
- **Recipients honor "like hub conversations," generalized to the union of the map's hubs:** on a new topic, the commenter + the map author + coordinators of **every** hub the map lives in auto-follow. On each comment, `commentRecipients(threadId, mapHubIds, exceptUserId)` emails followers who are **comms-on members of any map hub OR non-members who followed** (COMMUNITY followers, the author/GT) — and **excludes hub members who turned comms off**. Quiet by default; never a whole-hub blast.

---

## Hub four-layer audit (per `RIM_Hub_Engineering.md`)

Mind Maps is hub-adjacent, so the audit applies — and it diverges from hub-scoped tools deliberately because it's a **map-scoped** resource:
1. **Capability gates** route by **map access** (`canAccessMindMap`/`canEditMindMap`), not a single hub — correct for a multi-hub resource. Creating *in* a hub gates on `canAccessHub`.
2. **Notification recipients** use the **map-hub union** (`commentRecipients`/`coordinatorRecipientIds`), not `getHubNotificationRecipients(oneHub)` — because the conversation is shared across hubs.
3. **UI/list queries** filter by hub (the hub tab queries `hubId = hub OR placements.some(hub)`); the directory filters by the viewer's hubs + `canAccessMindMap`.
4. **Email URLs** point at the **map** (`mindmap-topic-comment` → `/account/mindmaps/[id]`), not a `hubScopedUrl` — appropriate because a map isn't a hub-scoped URL.

---

## Pitfalls / decisions to remember

- **Edges are derived from `parentId`**, not stored — don't add an edge table unless multi-parent links are ever wanted (noted as a later option).
- **Floating edges** are the fix for "lines up funny" — don't pin edges to fixed handles for rendering.
- **Saves must stay serialized** (the in-flight chain) — re-introducing parallel PATCHes risks out-of-order snapshot writes; `flushSave` must go through the same chain.
- **`@@unique([mindMapNodeId])` is load-bearing** — it's what makes "one thread per topic" safe under a concurrent first-comment; the create path also catches the violation.
- **Gate membership loads filter `status: "ACTIVE"`** — see the access-model note.
- **Conversations need a hub home** — a hubless personal map can't have conversations until placed.
- **Comments are plain text in v1** — rich text, comment-count badges, per-topic unread, and comment edit/delete are deferred (the tables already support edit/delete).

---

## Deferred
Rich-text comments; a comment-count badge on topics + hub/directory cards; per-topic unread; comment edit/delete affordances; real-time multiplayer (a map is async/curated for now). See `data/backlog.json` (`2026-06-29-*`).

---
*Rooted in Mindfulness · per-tool reference · created session 160 (2026-06-29).*
