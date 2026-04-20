# Editor Audit — Sweep 3: Hub Surfaces (Four-Type Framing)

**Status:** Draft. Review with Jesse, then freeze and move to Sweep 4 (admin tools).
**Source:** All `components/Hub*.tsx` and `app/account/hub/[slug]/**/*.tsx` as of session 89 (2026-04-20).
**Reference:** `RIM_Editor_Types.md` (canonical).

---

## Correction to Sweep 1's drift flag

Sweep 1 flagged `Hub.welcomeBody` and `Hub.homeContent` as "wrong engine drift" because the old `RIM_Editor_Design.md` said they should use `RimBlockEditor` at Tier 2 Document. On closer look, this is not a code-is-wrong situation — it's **the old design doc over-prescribing**.

Under the new four-type model, we should evaluate each surface by **what the author is actually doing there**, not by what the old tier doc said. For hub welcome and home content, the author is writing orientation *messages* for members — short, warm, directional prose. Not standalone documents. **Message type is the right call.**

This reframes the recommendation:
- `Hub.welcomeBody` and `Hub.homeContent` → **stay Message type** (currently `RimProseEditor` with `variant="document"` for denser toolbar). No engine swap needed.
- But the `variant="document"` name is a **legacy misnomer** — it describes toolbar density within Message, not the Document type. This variant should be renamed in Stage 2 to avoid confusion. Code comment in `RimProseEditor.tsx` already flags this.

---

## Hub surface inventory

### Hub Home (`/account/hub/[slug]`)

**What the member sees:** A calm landing page with a plain-language state sentence, a primary work card, pinned threads, an activity rail (recent conversations, open tasks, recent docs), and an optional orientation block at the bottom.

**Authored fields on this surface:**

| Source field | Editor | Four-type classification | Notes |
|---|---|---|---|
| `Hub.welcomeHeadline` | `<input>` plain | Template data | Short headline, plain is right. |
| `Hub.welcomeBody` | `RimProseEditor` variant="document" | **Message** | Orientation for first-time visitors. |
| `Hub.homeContent` | `RimProseEditor` variant="document" | **Message** | Bottom-of-home orientation, shown every visit. |

**Recommendation:** Keep all three as-is (Template + Message + Message). Rename `variant="document"` → `variant="dense"` in Stage 2a to stop confusing "document density" with "Document type."

---

### Hub Conversations (`/account/hub/[slug]/conversations`)

**What the member sees:** A threaded discussion board. Members post threads, reply, react with emoji, pin threads, mark threads resolved.

**Authored fields:**

| Source field | Editor | Four-type classification | Notes |
|---|---|---|---|
| `HubConversationThread.title` | `<input>` plain | Template data | Plain text, single line. |
| `HubConversationThread.body` | `RimProseEditor` variant="compact" | **Message** | Thread OP body. |
| `HubConversationThread.category` | `<select>` | Template data | Categorical. |
| `HubConversationReply.body` | `RimProseEditor` variant="compact" | **Message** | Reply body. |
| `HubConversationThread.isPinned`, `status`, `edited` | toggles / flags | Template data | — |

**Recommendation:** All correct. No changes.

---

### Hub Tasks (`/account/hub/[slug]/tasks`)

**What the member sees:** Task lists, each with tasks, each with optional subtasks. Tasks have a title, optional rich body, assignee, due date, status.

**Authored fields:**

| Source field | Editor | Four-type classification | Notes |
|---|---|---|---|
| `TaskList.name`, `description` | `<input>` plain | Template data | |
| `Task.title` | `<input>` plain | Template data | |
| `Task.body` | `RimProseEditor` variant="compact" | **Message** | Task detail body. |
| `Subtask.title` | `<input>` plain | Template data | |
| `Subtask.body` | `RimProseEditor` variant="compact" | **Message** | Subtask detail body. |

**Recommendation:** All correct. No changes.

---

### Hub Documents (`/account/hub/[slug]/documents`)

**What the member sees:** A library of documents. Each document is either a "native" RIM document (authored in-app with the Document-type editor) or a link to an external file (Google Doc, Sheet, etc.). Native docs have a full edit experience with locking and presence.

**Authored fields:**

| Source field | Editor | Four-type classification | Notes |
|---|---|---|---|
| `HubDocument.label` | `<input>` plain | Template data | Document title. |
| `HubDocument.description` | `<input>` plain or textarea | Template data | Short description for the list view. |
| `HubDocument.body` | `RimBlockEditor` context="document" | **Document** | Native document body. Working as designed. |
| `HubDocument.category`, `fileType`, `isLocked`, etc. | — | Template data | |

**Recommendation:** All correct. This is the canonical Document-type placement.

---

### Hub Schedule (`/account/hub/[slug]/schedule` via `HubScheduleClient`)

**What the member sees:** The host rotation schedule. Hosts see their assignments, can request a sub ("I can't host this one") with an optional message, or claim someone else's open sub request with an optional message.

**Authored fields:**

| Source field | Editor | Four-type classification | Notes |
|---|---|---|---|
| `SubRequest.message` | `RimProseEditor` variant="compact" | **Message** | Host's context when requesting coverage. |
| `SubClaim.message` | *(not yet wired to a UI)* | **Message** (target) | Claimer's optional message back, embedded in the sub-claimed email. |

**Recommendation:** `SubRequest.message` is correct. `SubClaim.message` needs a UI added — currently a live schema field with no editor path. Small Stage 2 follow-up.

---

### Hub Members (`/account/hub/[slug]/members`)

**What the member sees:** A roster of hub members with names, positions, coordinator flags, last visit info. No authored content — all template data from `User` and `HubMember`.

**Recommendation:** Not an editor surface. No action.

---

### Hub Admin — Coordinator management (`/admin/hubs/[slug]/edit`)

**What the coordinator sees:** The hub's administrative form. Fields for name, type, description, welcome headline, welcome body, home content, document categories, conversation categories, tools roster.

**Authored fields:**

| Source field | Editor | Four-type classification | Notes |
|---|---|---|---|
| `Hub.name`, `type`, `status` | plain / select | Template data | |
| `Hub.description` | textarea | Template data | Short description shown in sidebar. |
| `Hub.welcomeHeadline` | `<input>` plain | Template data | |
| `Hub.welcomeBody` | `RimProseEditor` variant="document" | **Message** | (see note above re: `variant="dense"` rename) |
| `Hub.homeContent` | `RimProseEditor` variant="document" | **Message** | Same. |
| `Hub.documentCategories`, `conversationCategories` | tag input | Template data | String arrays. |
| `HubAppLink.label`, `href`, `toolSlug` | plain / select | Template data | |

**Recommendation:** All correct once the `variant` rename lands.

---

## Hub surfaces that do NOT exist (but design doc claimed they did)

### `hub-announcement` — confirmed unbuilt

No `HubAnnouncementsClient.tsx`. No `/account/hub/[slug]/announcements` route. The old `RIM_Editor_Design.md` and `lib/editorRegistry.ts` both reference `hub-announcement`, but there is no implementation.

**Decision needed from Jesse:** Two options —

- **(a) Remove `hub-announcement` from the registry.** It's not built. If a future version of hubs needs a dedicated announcements surface, it'll get registered when it's designed. Keeping dead entries in the registry is exactly the drift pattern we're trying to end.
- **(b) Keep it as a deliberate placeholder with a "planned" flag.** Signals intent; but also risks becoming stale again.

**My recommendation:** (a). Remove from the registry. The hub home page already handles "pinned threads" (a kind of announcement by promotion), and the site-wide banner handles urgent announcements. Adding a separate hub-scoped announcements feature is a design decision that should happen when it's needed, not a ghost that sits in the registry.

---

## Hub workspace chrome (`HubWorkspaceSidebar`)

Sidebar renders hub name, description, coordinator names, tool links, active tab indicator. All template data. No editor. No action.

---

## Summary

| Hub surface | Editor | Type | Status |
|---|---|---|---|
| Hub Home — welcome body | RimProseEditor variant=document | Message | Correct (pending variant rename) |
| Hub Home — home content | RimProseEditor variant=document | Message | Correct (pending variant rename) |
| Conversations — thread body | RimProseEditor variant=compact | Message | Correct |
| Conversations — reply body | RimProseEditor variant=compact | Message | Correct |
| Tasks — task body | RimProseEditor variant=compact | Message | Correct |
| Tasks — subtask body | RimProseEditor variant=compact | Message | Correct |
| Documents — native body | RimBlockEditor context=document | **Document** | Correct — the canonical Document placement |
| Schedule — sub request message | RimProseEditor variant=compact | Message | Correct |
| Schedule — sub claim message | *(no UI yet)* | Message (target) | Small follow-up needed |
| Hub Admin — welcome body | RimProseEditor variant=document | Message | Correct (pending variant rename) |
| Hub Admin — home content | RimProseEditor variant=document | Message | Correct (pending variant rename) |
| Members | — | — | No editor surface |
| Announcements | *(doesn't exist)* | — | Registry entry should be removed |

**Net from Sweep 3:**
- 0 wrong-engine bugs (Sweep 1's flag was actually "old doc over-prescribed")
- 1 cosmetic code fix: rename `variant="document"` → `variant="dense"` in `RimProseEditor` (Stage 2a)
- 1 follow-up: `SubClaim.message` needs a UI (small task, not blocking)
- 1 registry cleanup: remove `hub-announcement` (Stage 2a)

---

## Open questions for Jesse

1. **`hub-announcement` registry entry** — remove it (my recommendation) or keep as "planned"?
2. **`variant="document"` → `variant="dense"`** rename in `RimProseEditor` — agreed it's worth doing to stop confusing toolbar density with Document type? This is Stage 2a cleanup.
3. **`SubClaim.message` UI** — when should this get built? It's a small feature (add an optional message field to the "claim this sub" confirmation). Do you want it in Stage 2 or pushed to a regular feature session?

Next: Sweep 4 — admin tools (manual, banner, email templates, member profile, registrar, support, course editor, program editor, lesson editor, teacher hub). Same four-type framing.
