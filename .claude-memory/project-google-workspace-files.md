---
name: project-google-workspace-files
description: "Google Workspace IS RIM's document & file system, per-Space (COMPLETE through s166) — 'RIM orchestrates, Google is the file cabinet'; native docs AND Mind Maps retired; Community Space also retired (s166); has a file detail page, draft/attribution, governed deletion, per-post notifications; DO propose Google Docs"
metadata: 
  node_type: memory
  type: project
  originSessionId: b371851a-ef35-4b75-9d97-30e992d3029c
---

**Google Workspace is RIM's document & file system**, adopted session 163 (2026-07-14) and **replacing** native Tiptap documents. Model: **"RIM orchestrates, Google is the file cabinet"** — the Zoom pattern (see [[project-zoom-migration]]) applied to files. This **reverses** the old "don't propose Google Docs" stance from the OnlyOffice era ([[project-onlyoffice-docs]], now retired).

**The load-bearing architecture (why half the original spec was dropped):** ONE Google Cloud **service account** (`rim-files@rim-workspace-502418.iam.gserviceaccount.com`) is RIM's only Google identity — a Manager on each org-owned Shared Drive, the equivalent of the Zoom pool seat. **Nobody gets a Google account** (not members, not volunteers). RIM's database IS the permission system. So there are **no** managed Google identities, **no** Google OAuth sign-in, **no** Google Groups or group-sync, **no** Admin SDK, **no** domain-wide delegation — those only exist to mirror teams into Google's permission model, which RIM doesn't need. Only the Drive API is enabled.

**Decided design (session 163, Jesse):** (1) **link-as-key** editing — files are anyone-with-link-editable and RIM hands the link only to authorized members (the same accepted trade as no-registration Zoom links; a leaked link is the known risk, mitigated by Drive version history + a backlogged admin revoke/lockdown tool `2026-07-14-001`). (2) **Drive folders ARE the filing system** — live-browsed, so Drive is the source of truth and can't drift (Mac-Finder feel, per Jesse). (3) **Community drive readable + editable by ALL members** (matched by exact reserved name "RIM — Community"). (4) Reading happens **inside RIM** (Google Doc → sanitized HTML → RIM typography), so members need zero Google literacy; editing opens the real Google editor in a new tab.

**Why the switch:** native docs (s154–161) worked but not well enough in practice (single-editor, no version history, no Sheets/Slides, no audio/large-file home). `RIM_Documents.md` itself said to evaluate a new capability if office layout / co-editing / version history became a real need — this is that evaluation resolved.

**Env (server-only):** `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (from the SA's JSON key; `\n`-escaped, un-escaped in code). Prod Vercel had an old Calendar-era `GOOGLE_SERVICE_ACCOUNT_EMAIL` shadowing the new key (→ "Invalid JWT Signature") — watch for stale Google env vars.

**Storage topology (s164):** the service account **can't create Shared Drives** (`403 userCannotCreateTeamDrives`), so a Space's storage is an auto-created **folder** in one shared **`RIM — Spaces`** container Drive; Community + any future sensitive Space keep their **own** Drive (the hard wall). Authorization is **subtree-aware** (`resolvePlaceForFile`/`fileWithinFolderRoot`, fails closed) so Spaces sharing the container stay isolated.

**Status: COMPLETE (through session 166, 2026-07-16).** All slices shipped + the cutover done: read Finder, write layer, uploads, admin revoke, per-folder gate, auto-provisioning; the reshape (every hub auto-provisioned, the **global `/account/files` finder removed** — files live only per-Space); native docs **migrated → Google Docs** then **native Documents fully retired** (code + DB); **Mind Maps also retired**. So BOTH earlier document attempts are gone — native Tiptap docs AND OnlyOffice — **don't resurrect either**; `RimTiptapEditor` stays only for non-document rich text (program/course/lesson/conversation/bio).

**Session 166 additions (the file-detail refinement):**
- **The Community Space was RETIRED** — reversing the s165 "Community is an open-to-all Space." An open, ownerless commons fit nothing in the coordinator-led governance model (no lead to approve removals; "notify everyone" = the whole sangha). The `Hub.openToAllMembers` primitive is gone (`canAccessHub(member, roles)` is back to membership-OR-GT), the Google-files Community place is removed, and the seeded community hub is deleted (`retire_community_space_v1`). **Every Space is now a stewarded team/project with a real roster.** The `openToAllMembers` column drop is Phase 2 (backlog `2026-07-16-001`, two-phase). `Hub.conversationsEnabled` (per-hub toggle) is unrelated and kept. The "RIM — Community" Google Drive still exists in Google (Jesse's to remove there).
- **File detail page** `/account/files/[fileId]` — every file opens here; fidelity-aware rendering (Google `/preview` iframe for shared docs, RIM export for drafts, native embed for binaries).
- **`GoogleFileMeta`** (sparse, loose-keyed): **creator attribution** (RIM's own record, backfilled from the audit log; Google can't be made to show a member's name so attribution lives at RIM's layer) + **draft/"held" state** (opt-out; RIM-created docs born held).
- **Conversation per file** (`FileComment` — deliberately NOT `HubConversationThread`, to avoid leaking into the hub Conversations feed).
- **Governed deletion**: Remove is a proposal → a Space **lead** (`isSpaceLead` = GT/ADMIN/coordinator, same set as `canManageTrash`) approves (→ Google's 30-day trash) or keeps; requester can cancel. Members no longer one-tap-trash.
- **Notifications**: Basecamp-style, **per-post, default No one**, email-first (templates `file-shared`/`file-comment`); in-app inbox deferred (backlog `2026-07-16-002`).

Deferred: cross-Space file sharing (`2026-07-15-001`), the literal `Hub`→`Space` code rename, the GT self-serve create-Space entry, the in-app notification inbox (`2026-07-16-002`). **Authority doc: `RIM_GoogleWorkspace.md`** (§10 = the file-detail layer as-built). Aligns with [[feedback-community-not-anonymous]]. Don't quote this as live detail — verify against `RIM_GoogleWorkspace.md` + code.
