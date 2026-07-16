# RIM Documents — the filing system

> **⚠️ HISTORICAL (retired session 165, 2026-07-16).** The native Documents system described here was **fully retired** — code and database — and replaced by **Google Workspace Files** (`RIM_GoogleWorkspace.md`). Active native docs were migrated to Google Docs first; the editor, routes, components, `documentAuth`, the models/enums, `HubConversationThread.documentId`, and `Hub.documentCategories` are all gone. This document is kept only as a record of the model that was. **Do not build against it** — Google Files is the document/file system now.

RIM Documents helped a community find and tend shared work without turning it into an impersonal file cabinet. It answered three quiet questions: *what is this, where does it belong, and is it current?*

## The supported document system

There are three document kinds:

- **Native document** — written and read in RIM’s calm, full-screen editor. It has a title, optional directory summary, category, body, sharing controls, comments, and exports.
- **Link** — a resource held elsewhere and opened in a new tab.
- **Upload** — currently a PDF held in RIM storage and opened in a new tab.

Native documents are deliberately **single-editor**, not real-time collaborative. The editor warns when someone else is active, sends a heartbeat only after edit permission is verified, detects stale saves, and protects against accidental navigation away from unsaved work. It does not promise tracked changes, simultaneous editing, or word-processor page layout.

Native documents export as a real `.md` download. **Print / Save as PDF** opens a clean, print-ready reader so the browser can create an accessible PDF without pretending RIM maintains a separate PDF rendering engine.

## Filing model

Every document has one canonical record:

| Field | Meaning |
|---|---|
| `hubId` | Its origin hub; nullable for a hubless project/community document. |
| `HubDocumentPlacement` | Additional hubs that surface the same canonical document — never a copy. |
| `category` | One hub-local filing category. |
| `description` | A short directory summary, included in search. |
| `docKind` | `NATIVE`, `LINK`, or `UPLOAD`. |
| `visibility` | `HUB`, `COORDINATORS`, or `COMMUNITY`. |

The origin hub owns the document lifecycle: edit, archive, delete, change visibility, and share outward. A coordinator of a hub receiving a shared document may edit its content and remove that hub’s placement, but cannot quietly change its wider reach.

## Surfaces

### Hub Documents — `/account/hub/[slug]/documents`

This is the working shelf. Documents are grouped by category, show **Updated** freshness first, and sort newest-first within a group. Search spans title, directory summary, category, and author; while searching, the category groups flatten so the answer is easy to scan. Archived documents stay recoverable in their own view; trashed documents stay manager-only.

Anyone with access to a hub can create a native document or file a link/PDF. Categories are **tended, not gated**: members can add, rename, merge, reorder, or remove categories. Removing a category leaves its documents safely uncategorized.

### Document directory — `/account/documents`

This is the cross-hub finder: “I know we have that document, but not which team filed it.” It gathers accessible documents by the member’s hubs, then Community and Projects, with one search across them all. A shared document still has one source of truth.

## Access

Document access is resource-level, not merely hub-level. `lib/documentAuth.ts` is the canonical gate:

- The author and `GUIDING_TEACHER` can reach their allowed documents.
- `HUB` visibility requires an **ACTIVE** membership in a hub where the document is originated or placed.
- `COORDINATORS` additionally requires that active membership to be a coordinator.
- `COMMUNITY` is community-readable; it never makes a document community-editable.
- `ADMIN` alone does not bypass the document boundary.

Every reader, directory, export, conversation route, sharing route, and presence route must use this rule. Do not substitute a bare `hubId` comparison for a document gate.

## Lifecycle and honest limits

Documents move **Active → Archived → Trash → permanent deletion**. Archive is reversible and deliberate; deletion requires archive first. Notifications are selective: an author chooses whom to notify, and recipients must be active, communication-enabled hub members.

The system keeps visible freshness (`updatedAt`), not a restorable revision timeline. If version history, inline co-editing, tracked changes, or office-style layout become a real community need, evaluate that as a new capability rather than implying that native documents already provide it.

## Engineering references

- `components/HubDocumentsClient.tsx` — filing shelf, search, category and share controls.
- `components/HubDocumentEditor.tsx` — native editor, save safety, presence, summary, and notifications.
- `app/api/documents/[id]/export/route.ts` — Markdown and print/PDF export.
- `lib/documentAuth.ts` — pure access/edit/sharing rules.
- `RIM_Editor_Types.md` — native document editor placement and allowed blocks.
