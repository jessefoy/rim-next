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

### Teacher profile portrait (session 162)

`components/member-sections/TeacherSection.tsx` manages the public teacher profile, including its portrait. The admin uploads a normal image through the existing `/api/upload` Vercel Blob path, previews it, and then saves the profile; the resulting URL remains `TeacherProfile.photoUrl`. Public program facilitator rows and `/teachers/[slug]` consume that same profile. CSS creates the circular crop (`border-radius: 50%` + `object-fit: cover`)—do not ask coordinators to create circular source files.

An uploaded file is not the saved profile until the section's Save action succeeds. Keep that two-step state explicit in help copy. A facilitator only links/renders the public portrait when `TeacherProfile.isPublic` is true and a public slug exists; otherwise the program page falls back to the plain attributed name.

---

## The two controls: system powers vs team membership (session 153)

The profile separates **what a person can do** from **what teams they're on**. This replaced the old single role-checklist whose hub side-effects were invisible (assigning HOST silently created host-team membership; aux hubs had no path from the profile at all → "two places to add to a hub").

### Roles & access — `components/member-sections/RolesSection.tsx`
Genuine system-wide powers only. Assignable: **ADMIN** (technical), **GUIDING_TEACHER** (sangha-wide dharma authority), **REGISTRAR** (registry + Program Manager), **TEACHER** (Course Manager), **HOST_MANAGER** — shown as **"Scheduling manager"** (manage rotations/coverage across *every* team), **CONTENT_EDITOR** — **"Content editor"** (2026-10-28: changes the site's content through the RIM Guide; see `volunteer-guide/README.md`). Saves the full `roles[]` via `PATCH /api/admin/members/[id]` (which triggers `syncHubMembership`). A role the UI doesn't surface (e.g. a residual `SUPPORT`) is preserved on save, not dropped.

### Hub memberships (Teams) — `components/member-sections/HubMembershipSection.tsx`
Every **active** hub as one row with an **Off / Member / Coordinator** segmented control — the single place to set team membership, including **pre-staging** a person before they log in. Backed by `GET/POST/DELETE /api/admin/members/[id]/hubs`:

- **GET** → `{ hubs: [all ACTIVE], memberships: [{ hubId, isCoordinator, status, derivedFromRole, derivedRole }] }`.
- **POST** `{ hubSlug, isCoordinator? }` → upsert (add, or flip just `isCoordinator` — never touches coordinator-owned fields like status/hostingCapability/pause notes).
- **DELETE** `{ hubSlug }` → `removeHubMembershipWithCleanup` (the shared FK-safe coverage cascade).
- **Off** (removal) sits behind a confirm because it clears the person's upcoming coverage in that hub.
- Changes are **silent** — no hub-welcome email (pre-staging shouldn't surprise-email; the pre-threshold gate would suppress it for staged/legacy accounts anyway).

**Role-derived hubs render locked.** `roleDerivedHubs(roles)` (in `lib/syncHubMembership.ts`) maps the roles that still imply a hub — **Courses ← TEACHER, Registrar ← REGISTRAR**. For a user holding that role, the hub shows a locked "via … role" pill instead of the control, and **POST/DELETE 409** any write to it. Those memberships are governed by the role (managed in Roles & access), so the two controls can never contradict each other. A user *without* the role can still be added to courses/registrar directly (editable) — the lock is per-the-target-user's-roles. Since 2026-10-19 that membership does not open the Program Manager: it is role-only (`canUseProgramManager`: Registrar, Admin, Guiding Teacher), so a non-Registrar on the registrar team reads its conversations and files but neither sees nor opens the tool. (The Course Manager still opens to ACTIVE members of the `courses` team.)

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

## The Members list, duplicates and merging (2026-10-15)

**The list** shows one Name column (sortable by first or last name; "Last, First" while sorted by last; the email under the name, wrapping only after the @), Teams (coordinator and paused marked, three then "and N more"), Roles in Roles & access's words (`lib/roleLabels.ts`; the retired HOST and SUPPORT hidden), Regs, Joined. Status shows only when it isn't Active, as a quiet line under the name. Filters: role, team (any one, on a team, on none), status, and **Possible second account**. The frame may reach 1120px (`.adm-content--wide`); measured to fit at 1280 with real-length addresses.

**Possible second accounts** (`lib/memberDuplicates.ts`): two accounts may be one person when they share a first and last name, or a phone (last ten digits; not inside one household, not a number shared by more than three accounts, not a one-digit placeholder). Every account is compared, the quiet pool included, because that is where the second account usually waits (all three 2026-10-15 cases: a personal-address account with the teams, and an unclaimed import at the RIM address that the person then signed in with). A profile with a match shows a note at the top (`PossibleDuplicatesSection`), where teams are added.

**Merging** (`lib/memberMerge.ts`, `POST /api/admin/members/[id]/merge`, ADMIN only): the admin opens the panel from the note, sees what each account holds and chooses the address to keep. The rules, from the three merges done by hand that day:
- **The record kept is the one with the history** (roles, teams, hosting, teaching, conversations), whichever address it has; only its address changes. Standing rotations make an account undeletable anyway (`ON DELETE RESTRICT`).
- Every link moves in one transaction. Teams keep the stronger membership (coordinator over member; a coordinator's "can't host" or "no notices" is taken whole from the stronger row, never OR-ed). One-per things keep the kept copy (a public teacher page wins over a private one). Two live registrations for one program leave one and Cancel the other (history kept). Reactions are rewritten. Sessions and old codes end. Older-format admin notes on both accounts stop the merge rather than lose one.
- **A safety net** checks every foreign key to users and every column named like a person reference (`…userId`, `…ById`, `…authorId`, `…by`, `…identity`) and refuses to delete the other account if anything still points at it: a table added later must be added to the lists in `lib/memberMerge.ts`.
- **The preview runs the whole merge and rolls it back**, so the admin is told before pressing whether it can complete. Refused: merging away the account you're signed in with.
- The address not kept becomes a former address (`RIM_Auth.md`, "Former sign-in addresses"). The `accounts-merged` email goes to the kept address, except for an account still archived or unclaimed (the quiet pool gets no email).

**Archive, Inactive and deletion release the schedule (2026-10-16).** Archiving a member (Status → Inactive in the core record; the API's `archive` action does the same, though no button in the registry calls it today) releases their upcoming sessions and ends their rotations in the same transaction (`releasePersonCoverage` in `lib/applyStandingAssignments.ts`): an open sign-up is removed, a seat emptied with its cover request closed. The rotation engine also skips archived people. Deleting an account does the same first, passes rotations they created to the deleting admin (that column can't be empty, so the delete used to fail), and removes their past open sign-up rows. **The merge now knows** `sub_requests.requestedById`, `standing_assignment_skips.createdById`, `pages.updatedById` and `reflection_responses` (a table with no Prisma model): missing ones had refused every merge of someone who had asked for cover.

## Pitfalls

- **Don't add GT (or any non-ADMIN/REGISTRAR role) to the registry gate.** Use the in-hub member tools for GT.
- **Don't inline the FK-safe coverage cascade** — call `removeHubMembershipWithCleanup`. Two copies drift (the "two sources of truth" class).
- **Don't write a role-derived hub from the Teams tool** — the 409 guard is intentional; the role governs it.
- **Don't add a person-picker that selects `User` rows without the `isLegacyUnclaimed: false` filter.**
- **A new table that points at a person must be added to `lib/memberMerge.ts`** (`ONE_PER` if a person may hold one row per key, else `POINTERS`). The merge's safety net will refuse every merge until it is, which is the intended failure.
- **`/api/admin/members` GET is a picker, not the listing** — it filters legacy + archived. The listing is server-rendered in `app/admin/members/page.tsx`; the "+ Add member" is a POST.
- **A teacher portrait is stored as a normal rectangular image URL.** The public circle is CSS. Preserve the existing upload → preview → Save sequence and the `isPublic`/slug gate.
- Residual dead code after the HOST retirement (the `addingHost`/`sendHostRoleAssignmentEmail` path in `/api/admin/members/[id]`, `ROLE_COLORS.HOST`) is tracked in backlog `2026-06-17-003`.

---

*Rooted in Mindfulness · per-tool engineering reference · created session 153.*
