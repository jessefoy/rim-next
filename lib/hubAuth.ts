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
 *  - getHubMembership()    — returns isAdmin (callers gate on !member && !isAdmin)
 *  - requireCoordinator()  — bypasses for ADMIN + GUIDING_TEACHER
 *  - effectiveCoordinator()— the canonical "is this user acting as coordinator
 *                            on this hub?" computation. Use it everywhere
 *                            that previously inlined
 *                              (member?.isCoordinator ?? false) || isAdmin
 *  - canManageTrash()      — trash-bin authority (coordinator/ADMIN/GT)
 *
 * Post-launch decision: revisit whether ADMIN should be auto-added to all hubs
 * as a HubMember (coordinator) via syncHubMembership, or whether the bypass
 * approach is sufficient. The bypass is clean and low-maintenance for now.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Fetch hub + membership for the current user. Returns null if hub doesn't
 * exist or user is not a member. Caller decides whether to 404 or 403.
 * ADMIN users can access any hub even without a HubMember record —
 * isAdmin is returned so callers can skip the member redirect for admins.
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
