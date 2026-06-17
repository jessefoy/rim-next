# RIM Member Registry — the per-tool reference

**Read this before working on the admin member profile (`/admin/members`, `/admin/members/[id]`), the roles/hub-membership model, or any person-picker.**

The Member Registry is the canonical record of every person in the community. This doc is the per-tool reference for the **profile page** and the model it now embodies. For the broader three-layer architecture see `RIM_System_Architecture.md`; for role intent see `RIM_Role_Design.md`; for hub-callsite rules see `RIM_Hub_Engineering.md`.

---

## The boundary (unchanged, and load-bearing)

`/admin/members` and `/admin/members/[id]` are **ADMIN + REGISTRAR only.** This is a boundary to maintain, not a filtering problem to solve. In particular:

- **GUIDING_TEACHER does NOT get the registry.** GT is *dharma* authority (soft-admin on every hub's content), not the *technical* registry steward. A GT who needs to put someone on a team does it from inside that hub (GT can add/remove hub members anywhere). The divergence is deliberate: a future GT who isn't also an ADMIN must not inherit member PII. (Jesse holds both roles; his registry access flows through ADMIN.) — settled session 153.
- The page gate is per-page (`auth()` + a `roles` check in each page); there is no `/admin` layout gate (the layout is styling only).
- The page is server-rendered from a Prisma query → props. The `/api/admin/members` **GET** endpoint is NOT the listing — it backs the **household person-picker** only; the "+ Add member" modal POSTs.

---

## The section-registry pattern

The profile renders via `lib/memberSectionRegistry.tsx` → `MEMBER_SECTIONS` (ordered), each `{ id, allowedRoles, condition?, zoneStart?, render }`. `components/MemberDetail.tsx` shows a section iff the viewer holds a role in `allowedRoles` **or** the section id is in their `sectionGrants`, AND `condition(member)` passes. Add a section = one registry entry + one component in `components/member-sections/`. The header (name/email/status/role badges/tags) renders outside the registry, unconditionally.

Current sections + the save model are tabulated in `RIM_System_Architecture.md` ("Member Profile Architecture"). Each section saves independently via its own endpoint; there is no global save bar.

---

## The two controls: system powers vs team membership (session 153)

The profile separates **what a person can do** from **what teams they're on**. This replaced the old single role-checklist whose hub side-effects were invisible (assigning HOST silently created host-team membership; aux hubs had no path from the profile at all → "two places to add to a hub").

### Roles & access — `components/member-sections/RolesSection.tsx`
Genuine system-wide powers only. Assignable: **ADMIN** (technical), **GUIDING_TEACHER** (sangha-wide dharma authority), **REGISTRAR** (registry + Program Manager), **TEACHER** (Course Manager), **HOST_MANAGER** — shown as **"Scheduling manager"** (manage rotations/coverage across *every* team). Saves the full `roles[]` via `PATCH /api/admin/members/[id]` (which triggers `syncHubMembership`). A role the UI doesn't surface (e.g. a residual `SUPPORT`) is preserved on save, not dropped.

### Hub memberships (Teams) — `components/member-sections/HubMembershipSection.tsx`
Every **active** hub as one row with an **Off / Member / Coordinator** segmented control — the single place to set team membership, including **pre-staging** a person before they log in. Backed by `GET/POST/DELETE /api/admin/members/[id]/hubs`:

- **GET** → `{ hubs: [all ACTIVE], memberships: [{ hubId, isCoordinator, status, derivedFromRole, derivedRole }] }`.
- **POST** `{ hubSlug, isCoordinator? }` → upsert (add, or flip just `isCoordinator` — never touches coordinator-owned fields like status/hostingCapability/pause notes).
- **DELETE** `{ hubSlug }` → `removeHubMembershipWithCleanup` (the shared FK-safe coverage cascade).
- **Off** (removal) sits behind a confirm because it clears the person's upcoming coverage in that hub.
- Changes are **silent** — no hub-welcome email (pre-staging shouldn't surprise-email; the pre-threshold gate would suppress it for staged/legacy accounts anyway).

**Role-derived hubs render locked.** `roleDerivedHubs(roles)` (in `lib/syncHubMembership.ts`) maps the roles that still imply a hub — **Courses ← TEACHER, Registrar ← REGISTRAR**. For a user holding that role, the hub shows a locked "via … role" pill instead of the control, and **POST/DELETE 409** any write to it. Those memberships are governed by the role (managed in Roles & access), so the two controls can never contradict each other. A user *without* the role can still be added to courses/registrar directly (editable) — the lock is per-the-target-user's-roles.

---

## Hosting is membership, not a role (session 153)

The plain **HOST** role was retired. Being a host = an active host-team `HubMember` row. This was safe because every host gate already reads membership first:

- `lib/hubMemberAuth.ts::getEffectiveHostingCapability` — membership when a row exists, role only as fallback.
- `lib/hubAuth.ts::canAccessHubScheduler` — accepts a `HubMember` row.
- `lib/toolAuth.ts::hasToolAccess` — pathway 3 grants tool access via hub membership + the tool's `HubAppLink`.

So a host needs only host-team membership (set via Teams). `ROLE_HUB_MAPPINGS` keeps only TEACHER/REGISTRAR; HOST/HOST_MANAGER/SUPPORT were removed from it. **HOST_MANAGER** stays a role because its cross-hub `isManager` authority (rotations/coverage across all teams) isn't replicated by a per-hub Coordinator toggle — a *per-hub* host-team coordinator is the Teams "Coordinator" state (`HubMember.isCoordinator`).

**Migration `retire_host_role_v1`** (`prisma/migrate.mjs`, flag-guarded, idempotent): for each user with HOST, ensure host-team membership *first*, then strip HOST from `roles`; also strip HOST from any course's `requiredRoles` gate (a course gated on HOST would otherwise become invisible). Skips entirely if the host-team hub is missing (never strips without a landing spot).

---

## Pre-staging + the legacy pool

- **Add member** (`POST /api/admin/members`) creates a staged account (no `agreedToTerms`/`emailVerified`, no email) — pre-launch staging. It's reused by email when the person completes normal sign-up.
- **Legacy pool** (`isLegacyUnclaimed`, ~1,500 Memberstack imports): hidden from the default registry; `?pool=legacy` reveals them. They promote (`isLegacyUnclaimed → false`) on first login.
- **Every person-picker MUST exclude the legacy pool** (`isLegacyUnclaimed: false`, usually + `archivedAt: null`): hub member search, household add-member, instructor picker. Ghosts must not be pickable until claimed. Admins still pre-stage a legacy person **by id** from the profile (the Teams tool is by-id, not search — exempt).

---

## Pitfalls

- **Don't add GT (or any non-ADMIN/REGISTRAR role) to the registry gate.** Use the in-hub member tools for GT.
- **Don't inline the FK-safe coverage cascade** — call `removeHubMembershipWithCleanup`. Two copies drift (the "two sources of truth" class).
- **Don't write a role-derived hub from the Teams tool** — the 409 guard is intentional; the role governs it.
- **Don't add a person-picker that selects `User` rows without the `isLegacyUnclaimed: false` filter.**
- **`/api/admin/members` GET is a picker, not the listing** — it filters legacy + archived. The listing is server-rendered in `app/admin/members/page.tsx`; the "+ Add member" is a POST.
- Residual dead code after the HOST retirement (the `addingHost`/`sendHostRoleAssignmentEmail` path in `/api/admin/members/[id]`, `ROLE_COLORS.HOST`) is tracked in backlog `2026-06-17-003`.

---

*Rooted in Mindfulness · per-tool engineering reference · created session 153.*
