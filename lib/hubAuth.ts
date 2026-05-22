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
 *  - getHubMembership()    — returns { hub, member, isAdmin }; callers gate
 *                            ACCESS on !member alone (ADMIN no longer bypasses
 *                            content access — session 128 follow-up).  The
 *                            returned isAdmin is still useful for the few
 *                            ADMIN-required actions (hard-remove member, etc.).
 *  - requireCoordinator()  — bypasses for ADMIN + GUIDING_TEACHER.  Coordinator-
 *                            level authority within a hub; distinct from access.
 *  - effectiveCoordinator()— the canonical "is this user acting as coordinator
 *                            on this hub?" computation. Use it everywhere
 *                            that previously inlined
 *                              (member?.isCoordinator ?? false) || isAdmin
 *  - canManageTrash()      — trash-bin authority (coordinator/ADMIN/GT)
 *
 * Access policy (session 128 follow-up): ADMIN no longer bypasses hub
 * content access.  A hub is a team space and the team is defined by
 * membership.  An ADMIN who wants to interact with hub content (read or
 * post threads, view docs, etc.) must be a HubMember just like everyone
 * else — same as GUIDING_TEACHER.  Hub administration (configure hub,
 * hard-remove member, hub create/delete) stays at /admin/hubs and remains
 * ADMIN-gated.  The boundary: ADMIN configures hubs from outside; ADMIN
 * participates from inside (as a member).
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
