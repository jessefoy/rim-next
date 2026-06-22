# RIM Documents — the filing system

The canonical design reference for how documents are **filed, found, and
surfaced** at RIM: the per-hub Documents tab and the cross-hub master directory.

This doc owns the *filing model* — organization, retrieval, categories,
placement, visibility, the directory. It does **not** own the office-editor /
save-loop machinery: that's **`RIM_OnlyOffice.md`** (the editor surface, the JWT
save callback, the doc-server infra). OnlyOffice owns the editing canvas; this
doc owns everything around it — where a document lives, how you find it again,
and who can reach it.

> Status: the canonical filing-system reference. Written session 155; **Slice 4
> shipped session 156** — all four steps in the Build order below are live on
> `main` (no schema change; every field already existed — see §2). Remaining:
> ungate office-doc creation, Slice 5 (native → `.docx`), and the deferred polish.

---

## 1. The principle — filing serves clear seeing

RIM's design is rooted in one Dharma principle: **clear seeing is the
prerequisite for wise and compassionate response.** A filing system honors that
when it makes *what is here* and *what is current* visible **without making
anyone sort to see it.**

This is the line between a calm document home and a corporate DMS. A DMS answers
"where do I put this?" with structure the user must build and navigate — nested
folders, tag taxonomies, permission matrices. Every one of those makes the user
do the sorting. RIM does the opposite: a **shallow, well-labeled, freshness-aware
list**, and **search + sort** as the way back to anything. You never navigate a
tree; you either glance (recency) or ask (search).

**The model is `hub → category → document`:**
- One document belongs to one hub-context and carries **one category**.
- Within a category, documents are a **flat list** — no sub-folders.
- Retrieval is **search and sort**, not folder-walking.

### Explicit non-goals (the things that would make this a DMS)
- **No folder nesting.** The deepest structure is hub → category. That's it.
- **No multi-tag taxonomy.** One category per doc, not a tag cloud.
- **No per-document ACL editor.** Reach is governed by three plain visibility
  levels (§7), not a per-user permission grid.
- **No full-text *content* search** (near-term). Search matches the things a
  person actually remembers — title, description, category, author — not the
  body. (Revisit only if a real need appears.)

If a proposed feature asks the user to build or walk structure, it's the wrong
shape for RIM. When in doubt, cut it and lean on search.

---

## 2. The data model (already in place)

Everything the redesign needs is on `HubDocument` and its neighbors today —
`prisma/schema.prisma` is canonical. The relevant fields:

| Field | Role in filing |
|---|---|
| `hubId String?` | Origin hub. **Nullable** → hubless "Projects" docs. |
| `category String?` | The one category. Drawn from `Hub.documentCategories`. |
| `docKind` | `NATIVE` / `ONLYOFFICE` / `LINK` / `UPLOAD` — drives how a row opens (§8). |
| `visibility` | `HUB` / `COORDINATORS` / `COMMUNITY` — who can reach it (§7). |
| `version Int` | OnlyOffice save counter (internal; see §9). |
| `updatedAt` | The freshness signal we now surface (§4). Auto-bumped on every write. |
| `createdAt` / `addedBy` | Provenance — demoted to detail (§4). |
| `archivedAt` / `deletedAt` | The Active → Archived → Trash lifecycle (§10). |

Companions:
- **`HubDocumentPlacement`** `(documentId, hubId)` — cross-hub sharing. One
  canonical `HubDocument` *placed in* several hubs; surfaced in each, never
  duplicated. Built already; **unused in the UI until Slice 4.**
- **`Hub.documentCategories String[]`** — the per-hub category vocabulary,
  ordered. Hub-local by design (§5).
- **`HubDocVisibility`** enum + **`lib/documentAuth.ts::canAccessDocument`** — a
  pure, placement-aware access function that filters in memory, so a directory
  listing never issues a query per doc. **This is the engine the directory
  rides on, and it's already written.**

**The redesign touches surfaces and routes, not the schema.** No migration.

---

## 3. Two surfaces, two jobs

The redesign lives on two surfaces. Keeping their jobs distinct is what stops
the directory from collapsing into a giant nested tree.

| | **Per-hub Documents tab** | **Master directory** |
|---|---|---|
| Route | `/account/hub/[slug]/documents` (exists) | `/account/documents` (**new**) |
| Job | *Browse one team's filing* | *Find a doc across all my teams* |
| Top-level grouping | **Category** | **Hub** (+ Community + Projects) |
| Within a group | Sort by recently-updated | Flat, recently-updated |
| Category | The grouping key | A small **row label**, not a key |
| Access | `canAccessHub` → moves to `canAccessDocument` (§7) | `canAccessDocument` from day one |
| Search | Within the hub | **Spans everything reachable** |
| CSS prefix | `hub-doc-` (extend) | `docs-` (**new**) |

The per-hub tab is where a team's filing has shape. The directory is the "where
did that doc go?" surface — its organizing key is *which team*, because at RIM
the hub is a real semantic boundary (your teams, and how access is computed),
not an arbitrary folder.

---

## 4. Retrieval — search, sort, freshness

**Search (highest-leverage add — there is none today).** A single calm input at
the top of each surface. Filters **client-side** over the already-loaded set
(a hub holds tens of docs; the directory holds hundreds at most — no server
search needed) across **label + description + category + author**. When a query
is active, the grouping **collapses to one flat ranked list** — grouping fights
search.

**Freshness — lead with "Updated."** The row's primary timestamp is
**"Updated <date>"**, in plain relative language ("Updated 3 days ago"). Author
is kept; **"Added <date>" is demoted** to a detail/hover. *Updated* answers the
question a person actually has — *is this current?* — where *added* is mere
provenance. `updatedAt` already moves on every write (native save, OnlyOffice
save, metadata edit), so this is pure surfacing.

**Sort.** Recently-updated is the default order within every group — that *is*
the freshness lens, no separate mode required. A **Name / Updated toggle is
deferred polish**, not Slice 4 core.

---

## 5. Categories — a tended vocabulary, not a gated one

**The decision (session 155): pick-from-existing is the default; the creator can
still add one for a genuine gap; coordinators curate.**

### Why not lock members out of adding
The sprawl we have today is **not** caused by creators adding categories — it's
caused by the fact that **nobody can clean up.** There is no curation surface, so
every inline addition (the POST/PATCH routes `push` straight onto
`Hub.documentCategories`) is permanent and unmanaged. Blocking members wouldn't
produce clean filing — it would produce **misfiling**: the member who needs
"Fall Retreat 2026" and can't make it picks "Misc" or leaves it blank, and now
the doc is filed *wrong*, which is worse for clear seeing than a slightly-long
list. **Curation-after beats gating-before.**

### The pairing
1. **Pick-from-existing is the *visual* default.** Existing categories are shown
   prominently; "+ add new category" is a quieter, secondary affordance. (Today
   it sits co-equal right in the dropdown, which invites casual minting — that's
   the nudge we change.)
2. **Any doc creator can still add a category** when none fits. It flows into the
   hub's list as it does now.
3. **Coordinators curate** — rename, merge, reorder, remove — from a
   **coordinator-gated surface on the hub.** This is the piece that never
   existed. *Build note:* the only current hub-config page
   (`/admin/hubs/[slug]/edit`) is **ADMIN-only**, so this curation surface is
   built fresh and coordinator-gated, living on/beside the Documents tab — not
   bolted onto the admin page.

### Categories are hub-local
`documentCategories` belongs to each hub. The directory does **not** try to unify
them across hubs (two hubs may both have "Guidelines" — that's fine; they're
different teams' filing). In the directory, category is a **row label**, never a
cross-hub grouping key. This keeps us out of a global tag taxonomy.

---

## 6. The master directory — `/account/documents`

The new cross-hub surface. The "find a doc without remembering which hub it's
in" view. It rides entirely on the already-built `canAccessDocument`.

**Structure:**
- **One section per hub** the viewer can reach docs in, **plus two special
  sections:**
  - **Community** — `visibility === COMMUNITY` docs (reachable by every active
    member, hub-independent).
  - **Projects** — hubless docs (`hubId === null`, no placements) the viewer can
    reach.
- **Within each section:** a **flat list, sorted recently-updated.** No category
  sub-grouping here — that's the per-hub tab's job. Category rides along as a row
  label.
- **One search box spans the entire reachable set**, collapsing the sections into
  a flat ranked result list when active. This is the cross-hub payoff.

**Shared / placed docs.** A doc placed in several hubs appears in **each section
it's placed in**, carrying a **"Shared" badge** that names its hubs — but it is
**one canonical record, never duplicated.** Editing or deleting it anywhere is
editing the one document.

**It scales down to the common case.** Most members belong to 1–3 hubs → 1–3
short sections (plus Community if relevant). The long version is for
coordinators / GT / Jesse, who are also the people equipped to use search. The
shape optimizes for the common reader and degrades gracefully for the power user.

**The higher bar this surface must clear.** A *new* view earns its place only by
handling **every** shape without fragmenting (the lesson of the reverted s141
Coverage grid): all four `docKind`s, all three visibilities, shared/placed docs,
hubless docs, the active/archived lifecycle, **and mobile at 360px.** If any
shape makes it fragment, it isn't finished. And it must be genuinely useful —
real search, real freshness — not a thin cross-hub list that reads as cheap
(sparse ≠ minimal). Hold it to that bar before shipping.

---

## 7. Sharing & visibility (the Slice 4 controls)

Both are already modeled; Slice 4 builds the UI.

**Cross-hub sharing — `HubDocumentPlacement`.** A "share with hubs" picker on a
doc writes placement rows. **Guard the create path: reject
`hubId === document.hubId`** so the origin hub is never double-listed. Removing a
placement un-shares from that hub (the doc itself is untouched).

**Visibility — three plain levels** (`HubDocVisibility`, layered *on top of*
placement):

| Level | Who can reach it |
|---|---|
| **HUB** (default) | Any member of any hub the doc is placed in |
| **COORDINATORS** | Only coordinators of those hubs |
| **COMMUNITY** | Any active member, hub-independent → shows in the directory's Community section |

The author always reaches their own doc; **GUIDING_TEACHER** reaches every doc
(sangha-wide); **ADMIN-alone does *not*** (ADMIN participates as a member — the
session-128 boundary). Edit rights are role-driven and ignore visibility: a
COMMUNITY doc is community-*readable*, never community-*editable*
(`canEditDocument`).

**The access-door shift.** Office docs are hub-origin today, so the doc-view page
(`/account/hub/[slug]/documents/[id]`) is `canAccessHub`-gated and it happens to
match. **The moment Slice 4 makes docs multi-hub or hubless, that page must move
to `canAccessDocument`** (see `RIM_OnlyOffice.md` §4) — otherwise a legitimately
shared/community doc 404s for someone who can reach it but isn't in the origin
hub.

---

## 8. How the four doc kinds render in a list

A list row opens differently per `docKind`:
- **NATIVE** — the in-app reader (Tiptap) at the hub doc-view page.
- **ONLYOFFICE** — the doc-view page (metadata + **"Open in editor"** + Comments),
  *not* straight into the editor. See `RIM_OnlyOffice.md` §4.
- **LINK** — opens the external URL in a new tab (`↗`).
- **UPLOAD** (PDF in Blob) — opens the file.

The directory and the per-hub tab share this rendering logic. Office-doc specifics
(the save loop, comments-not-topics, the editor crash gotchas) live in
`RIM_OnlyOffice.md`, not here.

---

## 9. Version history — the honest scope

What we actually retain: **only the current blob.** The OnlyOffice callback prunes
the previous version's blob on each `MustSave` (`RIM_OnlyOffice.md` §2), so
`version` is an internal **save counter**, not a restorable chain.

- **Near-term (Slice 4):** freshness is **"Updated <date>"** — the universal
  signal that works for all four kinds. We do **not** show the raw save counter
  to members (it counts autosaves, not meaningful revisions — it would read as
  noise).
- **Deferred:** a **restorable version timeline.** OnlyOffice supports this
  natively; wiring it means either retaining prior blobs (storage cost) or
  calling OnlyOffice's history API. A real feature for later — not Slice 4.

Be honest in the UI: near-term "version history" means *visible recency*, not a
restore button.

---

## 10. Lifecycle (unchanged; the directory respects it)

Documents move **Active → Archived → Trash** (`archivedAt`, then `deletedAt`):
- **Active** — shows in the main list.
- **Archived** — read-only, behind an "Archived" filter, still visible to members.
- **Trashed** — vanishes from members; visible only to ADMIN / GUIDING_TEACHER /
  coordinator at the hub's `/trash`.

The master directory shows **Active by default** and honors the same filter
model. Trash stays a per-hub coordinator surface — the directory does not become
a cross-hub trash can.

---

## Build order (Slice 4 — ✅ shipped session 156)

All four steps are live on `main`; this is the order they landed:

1. ✅ **Freshness + search on the per-hub tab** (`HubDocumentsClient`) — `updatedAt`
   surfaced, search box, recency sort. Pure surfacing, no new routes.
2. ✅ **Category governance** — pick-from-existing default + the coordinator-gated
   curation surface `/api/hub/[slug]/document-categories` (rename / merge /
   reorder / remove) + `HubDocCategoryManager`. Inline creation case-dedups so
   "Forms" and "forms" can't both exist.
3. ✅ **Sharing + visibility** — `/api/documents/[id]/placements` + `/visibility`
   (`canEditDocument`-gated, origin-owns-lifecycle), `HubDocShareModal`, the
   "Shared from [hub]" / "Community" badges, and the doc-view page's
   `canAccessHub` → `canAccessDocument` shift.
4. ✅ **The master directory** `/account/documents` — hub sections + Community +
   Projects, flat-by-recency, global search; the hub-agnostic reader
   `/account/documents/[id]`; the account-sidebar **Documents** link.

Beyond Slice 4 (deferred): ungate office-doc creation to all members; migrate
native docs → `.docx` (Slice 5); polish — restorable version history, a
Name/Updated sort toggle + a global "Recent" strip, **archived docs in the
directory**, and **comments on the hub-agnostic reader** (read/launch-only
today). Backlog `2026-06-22-002` / `-003` / `-004` / `-006`.

---

## Companion docs
- **`RIM_OnlyOffice.md`** — the office editor, save loop, infra, comments.
- **`RIM_Hub_Model.md`** / **`RIM_Hub_Engineering.md`** — hub structure + the
  four routing layers every hub-scoped callsite must respect.
- **`RIM_System_Architecture.md`** — the three-layer model; hub-membership-as-
  authority; `canAccessHub` vs `canAccessDocument`.
- **`RIM_Web_Design_Philosophy.md`** — clear seeing, restraint, designing for
  overwhelmed users (the §1 ground).
- `prisma/schema.prisma` — `HubDocument`, `HubDocumentPlacement`,
  `HubDocVisibility`, `Hub.documentCategories` (canonical data model).
