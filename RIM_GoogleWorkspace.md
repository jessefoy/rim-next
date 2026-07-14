# RIM Google Workspace — Files & Documents

**Status: foundation in design/build (session 163, 2026-07-14). Not yet live.**

This is the authority document for RIM's Google Workspace file and document system — the assessment of what exists, the architecture decided with Jesse, the build plan, and the manual Google setup steps. When the cutover completes, this supersedes `RIM_Documents.md` (native documents), which becomes historical.

---

## 1. The decision

**Google Workspace replaces native documents as RIM's primary document and file system.** The model is the proven Zoom pattern: **"RIM orchestrates, Google is the file cabinet."** RIM keeps identity, team membership, permissions, and the calm front-door UI; Google provides the editors (Docs, Sheets, Slides), file storage (PDFs, audio, images), real collaboration, and version history.

### Why (the third run at documents)

1. **Native Tiptap documents** (s154–161, the supported path until now) — good filing model, but in use the system hasn't worked as well as the community needs: single-editor only, no version history, no spreadsheets/office formats, no home for audio or large files.
2. **OnlyOffice** (s154–156, retired s161) — self-hosted office docs; retired for operational weight.
3. **Google Workspace** (now) — familiar editors ("cultural muscle memory"), real co-editing, version history, org-owned storage, and no server for RIM to maintain. `RIM_Documents.md` itself anticipated this: *"If version history, inline co-editing, tracked changes, or office-style layout become a real community need, evaluate that as a new capability."*

Jesse's direction (session 163): Google files are **the primary approach, not a parallel option** — "less options is better for organization and cultural muscle memory. I want it to feel like a real filing system within the hubs," specifically **Mac-Finder-like**.

### What was deliberately rejected from the source spec

This project began from a ChatGPT-authored spec that assumed a heavyweight identity architecture. After checking it against the actual repo and RIM's model, we **dropped**:

| Spec item | Why dropped |
|---|---|
| Managed Google Workspace accounts for volunteers | Nobody gets a Google account assigned (the Zoom decision: members join by link + RIM identity, no external accounts). |
| Google OAuth sign-in for volunteers | With no managed accounts, there's nothing to sign into. RIM auth stays 6-digit codes, untouched. |
| Google Groups mirroring teams + group sync | Groups exist only to project team membership into Google's permission system. RIM's DB **is** the permission system; the service account is the only Google actor. |
| Admin SDK + domain-wide delegation + user provisioning | Only needed for Groups/accounts. Dropping them removes the most security-sensitive scopes entirely. |
| A new team system / new file manager from scratch | Hubs are the teams; the Documents shelf UX evolves into the Files browser. |

What survives from the spec: server-only service layer, hub→Drive mapping, RIM-side authorization before every Google call, never trusting client-supplied Drive IDs, staged uploads that don't proxy large files through function bodies, feature-flagged rollout, plain-language UX, an admin status surface, and the setup guide.

---

## 2. Repository assessment (what the app actually is)

- **Framework:** Next.js 16 App Router + TypeScript, React 19. Hosted on Vercel. `params` is a Promise; RSC serialization rules apply (no raw Dates to client components).
- **Auth:** NextAuth v5, passwordless 6-digit codes via Resend. No OAuth providers of any kind. Route protection per-page via `auth()` + the `(authenticated)` route-group layout. **Untouched by this project.**
- **DB:** Prisma 5 + Neon Postgres. Idempotent flag-guarded migrations in `prisma/migrate.mjs` (runs on Vercel builds; prod DB unreachable locally — `npx tsc --noEmit` is the local gate).
- **Teams:** Hubs (`Hub` + `HubMember`, status ACTIVE/PAUSED/INACTIVE, `isCoordinator`). Access door: `lib/hubAuth.ts::canAccessHub`. Hub feature config lives as fields on `Hub` (e.g. `documentCategories`) — the Drive mapping follows this convention.
- **Existing documents system:** `HubDocument` (NATIVE/LINK/UPLOAD kinds) + placements + visibility + master directory + document conversations + selective notifications. **This is what gets replaced.** Reference: `RIM_Documents.md`.
- **Storage:** Vercel Blob (`/api/upload`) — reusable as the staging area for large uploads.
- **Google surface area today:** none. No `googleapis`, no Google env vars, no OAuth. (`jesse@` / `support@` are Google Workspace accounts organizationally — the Workspace org exists; edition/status to confirm.)
- **No test framework; no queue/worker system** (5 Vercel crons + `after()` are the async patterns). Tests will be added minimally and targeted (access-gate logic only). Background transfer uses `after()` + a cron backstop, matching existing patterns.
- **Precedent to model on:** `lib/zoom.ts` + `lib/sessionMeeting.ts` + `/admin/zoom-test` — S2S credentials in env, server-only client, self-healing provisioning, an ADMIN diagnostic page.

---

## 3. Architecture

### Actors

One **Google Cloud service account** is RIM's only Google identity — the equivalent of the Zoom pool seat. It is added as a **Manager member of each Shared Drive** (no domain-wide delegation, no Admin SDK). Every Google operation is server-side through it: list, create, move, rename, upload, set link sharing, read content. Its key lives in Vercel env vars, never in the browser.

Members and volunteers have **no Google accounts in this system**. If a volunteer happens to be signed into a personal Google account while editing, Google shows their name in the doc — a bonus, never a requirement.

### Access model — RIM is the permission system

Three layers, all enforced in RIM before any Google call or link is revealed:

1. **The drive is the boundary.** Each Shared Drive maps to a hub (visible to that hub's ACTIVE members) or to **Community** (visible to all signed-in members). Sensitive areas (Board/Finance, someday) are separate drives mapped to tighter hubs — never nested exceptions inside a shared drive.
2. **Within a hub, RIM decides what each person is shown.** Read-only viewers get documents rendered inside RIM; authorized members get "Edit in Google Docs"; structure actions (new folder/move/rename/delete) scope to whatever level a hub needs. Default posture mirrors the current "tended, not gated" documents culture: all active hub members can create, edit, and organize.
3. **Individual exceptions** (per-person email grants on a file/drive) are a later hardening layer for sensitive drives — not built in v1.

**Edit access = the link is the key (Fork A, decided).** Files are set to "anyone with the link can edit"; RIM hands the link only to people its own checks authorize. This is the same accepted risk posture as Zoom's no-registration meeting links (a leaked link is the known trade; RIM is the gate; rotation/lockdown per-drive is the recovery). For any drive that ever needs real lockdown, the hardening path is switching that drive to per-email grants.

**Read path = inside RIM.** Non-editors never touch Google: the server exports a Google Doc's content (Drive `files.export` → HTML) and renders it in a calm RIM page (`.rim-content`); PDFs/images/audio stream or open as they do today. This is what preserves "members need zero Google literacy."

**Never trust client-supplied IDs.** Every route resolves the target drive/folder against the server-side hub mapping and verifies the requesting user's membership. A file ID in a request is only honored if its drive resolves to a mapping the user can access.

### Filing model — Drive is the source of truth (Fork B, decided)

RIM **live-browses** each mapped Shared Drive: real folders, real files, straight from the Drive API. No RIM-side file index to drift out of sync — a coordinator tidying folders directly in Google Drive is automatically reflected in RIM. RIM's DB keeps only:

- the **hub → Drive mapping** (fields on `Hub`: drive ID, optional root folder ID, enabled flag)
- a **creation/audit log** (which RIM member created/uploaded/deleted what, when — "who created and manages this" is RIM's record, independent of Google's attribution)

Search uses Drive API queries across the member's accessible drives. Freshness is Drive's `modifiedTime`. Deletion goes to **Drive's own trash** (30-day recovery), replacing RIM's Active→Archived→Trash lifecycle for files.

### The Finder UX

The browsing experience is deliberately **Mac Finder / iOS Files**–shaped:

- **Sidebar of places:** Community, then each team drive the member belongs to (like Finder's volumes).
- **Folders-first list view:** name, kind, last modified; breadcrumb path bar; click a folder to descend, click a file to open.
- **Two doors, one component:** the per-hub **Files** tab opens directly into that team's drive; `/account/files` is the system-wide Finder window with all your places (mirrors how Documents/Mind Maps have a hub tab + master directory today).
- **Phone:** drill-down list (the iOS Files pattern), 44px targets, no hover-dependent affordances.
- **Plain language everywhere:** "Create document," "Upload a file," "Open in Google Docs," "We couldn't load these files. Please try again." No Google jargon (no "Shared Drive," "MIME type," "permissions") in member-facing UI.
- Drag-and-drop moving is later polish, not v1 (move via a picker first).

---

## 4. What retires, what survives, migration

**Retires (at cutover, not before the Google path is proven):** the native Tiptap document editor and its presence/stale-save machinery, Markdown/print-PDF exports, `HubDocumentPlacement` cross-hub sharing + per-doc visibility as built, document-targeted notifications, document conversations (threads anchored to `documentId`) — hub Conversations remain the discussion surface. `RIM_Documents.md` becomes historical.

**Survives:** hub membership as the access gate, the calm shelf/browser UI language, the two-door pattern (hub tab + master directory), Vercel Blob (as upload staging), the pre-threshold email gate and other cross-cutting systems (untouched).

**Migration is light** (Jesse: nobody is using the system fully yet): native docs are Tiptap **HTML**, and the Drive API imports HTML directly as a Google Doc — a one-time conversion per real document. Existing Blob PDFs transfer into the appropriate drive. Old document routes redirect to the Files browser.

---

## 5. Risks and honest limits

- **Link leakage** (accepted, Zoom-consistent): anyone holding an edit link can edit and can pass the link on. Mitigations: RIM-only distribution, per-drive lockdown path (per-email grants), Drive version history makes vandalism recoverable.
- **In-app rendering fidelity:** complex Google Docs (heavy tables, embedded objects) may render more simply in RIM's reader than in Google. Acceptable for reading; editors always see the real thing.
- **Large-file streaming through Vercel:** proxying long audio via a function has platform limits. V1 streams through a route handler for normal sizes; very large media may need a temp-Blob hop or direct-link approach — flagged, not hidden.
- **Workspace sharing policy:** "anyone with link" on Shared Drive files requires the Workspace admin settings to allow external sharing for those drives — a real setup step, documented below.
- **Attribution inside Google:** edits by people not signed into a personal Google account appear as "Anonymous [animal]." RIM's audit log is the authoritative record of creation/management.
- **API quotas / transient errors:** Drive API default quotas are far above RIM's scale. Retry/backoff is **not yet implemented** — it's a Slice 2 item at the single `driveApi` choke point; Slice 1's admin-diagnostic traffic surfaces transient failures as visible errors instead.

---

## 6. Build plan

Each slice ships independently, reviewer-gated, `tsc`-green; hubs come online one at a time as their drives are created. A feature flag keeps the existing Documents tab in place until cutover.

- **Slice 0 — Google-side setup (Jesse + guide, §7):** confirm Workspace edition, Cloud project, enable Drive API, service account + key, env vars in Vercel, first Shared Drive(s) with the service account as Manager, sharing policy.
- **Slice 1 — Service layer + mapping + diagnostic:** server-only `lib/google/` (auth, drive ops, error normalization; modeled on `lib/zoom.ts` — a **deliberate mirror**, so a fix to one must be hand-carried to the other); env validation (incl. private-key newline handling); `Hub` mapping fields + `/admin/hubs` edit UI; `/admin/google-test` diagnostic (the `/admin/zoom-test` pattern); the audit-log model. Retry/backoff is **not** in Slice 1.
- **Slice 2 — The Finder (read):** per-hub **Files** tab + `/account/files`; live folder browsing, breadcrumbs, folders-first; open files — Google Docs render in-app, PDFs/images/audio open/stream; search; empty/error states in plain language. Also lands here: **the Community drive's place** (Community isn't a hub, so its selection needs its own mechanism — not the hub mapping) and **retry/backoff at the single `driveApi` choke point** before member-facing traffic depends on it.
- **Slice 3 — Write:** "Create document" (Doc first; Sheets/Slides structured to follow), new folder, rename, move; link-as-key edit buttons for authorized members; uploads (small direct; large staged via Blob → `after()` transfer → cron backstop; type/size rules, name sanitization, temp cleanup); audit logging on every write.
- **Slice 4 — Cutover:** convert real native docs → Google Docs (HTML import); transfer Blob PDFs; retire the native editor + placement/visibility machinery; the Documents tab becomes (or redirects to) Files; update `RIM_Documents.md` (historical banner), FEATURES.md, architecture docs.
- **Targeted tests** (alongside slices 2–3): the access-gate logic only — mapping resolution, membership checks, refusal of unmapped/foreign drive IDs. Mocked Google; no live API in tests.

---

## 7. Google admin setup guide (manual steps — Jesse)

Steps RIM's code cannot do. Placeholders in `⟨⟩`; no real values in this file.

**A. Google for Nonprofits / Workspace (once)**
1. ✅ **Confirmed (session 163):** Google Workspace for Nonprofits is approved on `rootedinmindfulness.org` and has been in use for years. Admin account: `jesse@rootedinmindfulness.org`. Shared Drives are included in this edition. Nothing to do here.

**B. Google Cloud Console (once)**
1. Create (or reuse) a project, e.g. `rim-workspace`.
2. Enable the **Google Drive API** (only this — no Admin SDK).
3. Create a **service account**, e.g. `rim-files@⟨project⟩.iam.gserviceaccount.com`. No domain-wide delegation.
4. Create a **JSON key** for it; from the JSON take `client_email` and `private_key` for the env vars below. Never commit the JSON.

**C. Google Admin Console (once + per sensitive change)**
1. Ensure sharing settings for the relevant OUs/Shared Drives allow **sharing outside the domain with link** (required for link-as-key). Scope this as narrowly as the console allows.

**D. Per hub (repeatable, as each hub comes online)**
1. In Google Drive, create a Shared Drive, e.g. `RIM — ⟨Hub name⟩` (plus one `RIM — Community`).
2. Add the service account's email as a **Manager** member of that drive.
3. Copy the drive's ID (from its URL) into the hub's mapping in `/admin/hubs`.

**E. Vercel env vars (server-only; never `NEXT_PUBLIC_`)**

```
GOOGLE_SERVICE_ACCOUNT_EMAIL      # the service account's client_email
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY # the key; newlines escaped as \n (code un-escapes)
```

Slice 1 reads **only these two**. The per-hub rollout switch is `Hub.googleFilesEnabled` (set in `/admin/hubs`, default off), and the Community drive's selection mechanism ships with Slice 2 — if a `GOOGLE_COMMUNITY_DRIVE_ID` or `GOOGLE_FILES_ENABLED` env var was set earlier, it is unread and harmless.

---

## 8. Open items

- Per-hub tightening of who can edit vs. read vs. manage structure (v1 default: all active hub members full working power, matching current culture).
- Sensitive-drive hardening (per-email grants) — designed, deferred.
- Drag-and-drop move; Sheets/Slides creation; file-anchored conversations/notifications — post-cutover candidates.
- Stale memory `project-onlyoffice-docs` ("don't propose Google Docs") — update at session close.
