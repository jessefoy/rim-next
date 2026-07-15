import { db } from "@/lib/db";

/**
 * ─── COORDINATOR-LEVEL ACCESS POLICY ─────────────────────────────────────────
 * Two roles bypass the per-hub HubMember.isCoordinator flag and act as
 * coordinators on every hub:
 *
 *   ADMIN            — technical authority. Soft-admins every surface; used
 *                      for testing and operating any hub without needing a
 *                      HubMember row.
 *
 *   GUIDING_TEACHER  — sangha-wide dharma authority (added session 113).
 *                      Distinct from ADMIN: no technical-admin scope (can't
 *                      edit hub config, delete hubs, hard-remove members),
 *                      but DOES act as an implicit coordinator on every hub
 *                      for content + moderation purposes. See
 *                      RIM_Role_Design.md for the rationale.
 *
 * Helpers in this module:
 *  - getHubMembership()    — returns { hub, member, isAdmin }; the returned
 *                            isAdmin is useful for the few ADMIN-required
 *                            actions (hard-remove member, etc.).
 *  - canAccessHub()        — the canonical access *door*: HubMember row OR
 *                            GUIDING_TEACHER.  Use it everywhere that gates
 *                            entry to / interaction with a hub.  ADMIN-alone
 *                            does NOT pass (session 128 boundary).
 *  - requireCoordinator()  — bypasses for ADMIN + GUIDING_TEACHER.  Coordinator-
 *                            level authority within a hub; distinct from access.
 *  - effectiveCoordinator()— the canonical "is this user acting as coordinator
 *                            on this hub?" computation. Use it everywhere
 *                            that previously inlined
 *                              (member?.isCoordinator ?? false) || isAdmin
 *  - canManageTrash()      — trash-bin authority (coordinator/ADMIN/GT)
 *
 * Access policy: the access door is `canAccessHub(member, roles)` — a
 * HubMember row OR the GUIDING_TEACHER role.  A hub is a team space and the
 * team is defined by membership; GUIDING_TEACHER (sangha-wide dharma
 * authority) is the one role that reaches every hub without a membership
 * row, because the guiding teacher stewards the content + tone of every
 * community space (see RIM_Role_Design.md).  ADMIN-alone does NOT pass:
 * ADMIN is *technical* authority — it configures hubs from /admin/hubs
 * (outside) and participates from inside as a member, like everyone else.
 * Pastoral reach into a team's private space belongs to the dharma role,
 * not the technical one, so a future technical operator who isn't a teacher
 * does not inherit it.  Hub administration (configure hub, hard-remove
 * member, hub create/delete) stays at /admin/hubs and remains ADMIN-gated.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Fetch hub + membership for the current user. Returns null hub if it
 * doesn't exist. Caller gates access on `member` — if null, return 403/404.
 * The `isAdmin` flag is returned for the routes that genuinely need ADMIN
 * authority (hard-remove member, etc.) but not as a content-access bypass.
 */
export async function getHubMembership(slug: string, userId: string, roles: string[] = []) {
  const hub = await db.hub.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
      },
    },
  });
  if (!hub) return { hub: null, member: null, isAdmin: false };

  const member = hub.members.find((m) => m.userId === userId) ?? null;
  const isAdmin = roles.includes("ADMIN");
  return { hub, member, isAdmin };
}

/**
 * The canonical "can this user enter / interact with this hub at all?" check —
 * the access *door*, distinct from coordinator-level authority *within* a hub.
 *
 * Returns true if EITHER:
 *   - a HubMember row exists (the team is defined by membership), OR
 *   - roles includes GUIDING_TEACHER (sangha-wide dharma authority — an
 *     implicit coordinator on every hub per RIM_Role_Design.md). The role doc
 *     grants GT full content reach across the sangha; this is the door that
 *     honors it.
 *
 * Deliberately does NOT pass ADMIN-alone. ADMIN is *technical* authority: it
 * configures hubs from /admin/hubs (outside) and participates from inside as a
 * member, like everyone else (the session-128 boundary). Pastoral reach into a
 * team's private space belongs to the dharma role, not the technical one — so a
 * future technical operator who isn't a teacher does not inherit it. (Jesse
 * holds both roles; his access flows through GUIDING_TEACHER, the right reason.)
 *
 * Authority *within* a hub (coordinator-only actions — delete, member
 * management, trash) is gated separately by effectiveCoordinator /
 * requireCoordinator / canManageTrash, all of which already honor GT.
 *
 * `openToAll` (session 165) is the Community-Space primitive: pass
 * `hub.openToAllMembers` at a hub's PARTICIPATION gates (entry, Files,
 * Conversations, Activity) so every signed-in member reaches them without a
 * HubMember row. Defaulted false, so the ~80 existing call sites keep pure
 * membership-gating — the flag only widens the door where a caller opts in.
 * Deliberately NOT passed at roster/admin gates (Members, Trash, category
 * management): an open-to-all Space has no roster and no per-hub coordinators,
 * so those surfaces stay closed.
 */
export function canAccessHub(member: unknown, roles: string[], openToAll = false): boolean {
  if (member) return true;
  if (openToAll) return true;
  return roles.includes("GUIDING_TEACHER");
}

/**
 * Throws an error (HTTP-style) if user is not a coordinator on this hub.
 * ADMIN and GUIDING_TEACHER bypass this check — see the access policy
 * comment at the top of this file.
 */
export function requireCoordinator(isCoordinator: boolean, roles: string[]) {
  if (
    !isCoordinator &&
    !roles.includes("ADMIN") &&
    !roles.includes("GUIDING_TEACHER")
  ) {
    throw new Error("coordinator_required");
  }
}

/**
 * The canonical "is this user acting as a coordinator on this hub?" check.
 *
 * Returns true if any of:
 *   - HubMember.isCoordinator === true on this hub (the canonical flag)
 *   - roles includes ADMIN (technical authority)
 *   - roles includes GUIDING_TEACHER (sangha-wide dharma authority)
 *
 * Replaces the inline pattern
 *     const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;
 * which appeared at ~14 call sites and silently omitted GT. Use this helper
 * everywhere coordinator-level UI affordances or write paths are gated.
 */
export function effectiveCoordinator(
  member: { isCoordinator: boolean } | null | undefined,
  roles: string[],
): boolean {
  if (roles.includes("ADMIN")) return true;
  if (roles.includes("GUIDING_TEACHER")) return true;
  return member?.isCoordinator ?? false;
}

/**
 * Is this user a coordinator of the named hub? Looks up the HubMember row
 * and checks isCoordinator. Does NOT consider ADMIN / GUIDING_TEACHER —
 * callers should check role-based bypass separately, then fall back to
 * this for hub-specific coordinator authority.
 *
 * Added Slice 2.6 to replace inline hardcoded-hub coordinator checks
 * scattered across the standing-rotation routes.
 */
export async function isHubCoordinator(userId: string, hubSlug: string): Promise<boolean> {
  const membership = await db.hubMember.findFirst({
    where: { userId, hub: { slug: hubSlug }, isCoordinator: true },
    select: { id: true },
  });
  return !!membership;
}

/**
 * Can this user open a given hub's Scheduler view?
 *
 * The Scheduler is gated per-hub, not just per-tool (session 146): a hub's
 * coverage board is that team's space, so a host-team member can't wander into
 * the greeter board and sign themselves up there. Returns true if ANY of:
 *   - roles includes ADMIN / HOST_MANAGER / GUIDING_TEACHER (oversight — these
 *     roles steward scheduling across hubs), OR
 *   - a HubMember row exists for (userId, hubSlug), regardless of status. A
 *     PAUSED / INACTIVE member can still SEE their team's schedule; pause
 *     governs hosting capability, not visibility.
 *
 * This is the access door for /tools/schedule?hub=<slug>, its month-nav GET,
 * and the create POST. It is distinct from getEffectiveHostingCapability,
 * which decides whether a viewer may actually CLAIM a slot (ACTIVE +
 * hostingCapability). Together they enforce the "covers ⇒ member" invariant
 * at the door rather than reconciling orphans after the fact.
 */
export async function canAccessHubScheduler(
  userId: string,
  roles: string[],
  hubSlug: string,
): Promise<boolean> {
  if (
    roles.includes("ADMIN") ||
    roles.includes("HOST_MANAGER") ||
    roles.includes("GUIDING_TEACHER")
  ) {
    return true;
  }
  const member = await db.hubMember.findFirst({
    where: { userId, hub: { slug: hubSlug } },
    select: { id: true },
  });
  return !!member;
}

/**
 * Trash-management authority for hub documents + conversations.
 *
 * A user can see the per-hub Trash, restore items, or permanently delete them
 * if ANY of the following is true:
 *   - role includes ADMIN
 *   - role includes GUIDING_TEACHER (sangha-wide dharma authority)
 *   - HubMember.isCoordinator === true on this hub (hub-scoped authority)
 *
 * Non-coordinators can still soft-delete their own items — that's a separate
 * check (authorship or coordinator-ness on the item itself). This helper is
 * only the gate for the trash bin: who can see deleted items, restore them,
 * or perform the final permanent delete.
 */
export function canManageTrash(roles: string[], isCoordinator: boolean): boolean {
  if (roles.includes("ADMIN")) return true;
  if (roles.includes("GUIDING_TEACHER")) return true;
  return isCoordinator;
}
