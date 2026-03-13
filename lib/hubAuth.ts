import { db } from "@/lib/db";

/**
 * ─── DEV-MODE ACCESS POLICY ──────────────────────────────────────────────────
 * During development, ADMIN has full coordinator-level access to ALL hubs,
 * even without a HubMember record. This is intentional — it lets admins test
 * and manage any hub without needing to be individually added as a member.
 *
 * How it works:
 *  - getHubMembership() always returns isAdmin (caller gates on !member && !isAdmin)
 *  - requireCoordinator() already bypasses for ADMIN (checks roles.includes("ADMIN"))
 *  - API write routes use `member?.isCoordinator ?? false` so null member is safe
 *  - Page isCoordinator computations use `(member?.isCoordinator ?? false) || isAdmin`
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
 * ADMIN users bypass this check.
 */
export function requireCoordinator(isCoordinator: boolean, roles: string[]) {
  if (!isCoordinator && !roles.includes("ADMIN")) {
    throw new Error("coordinator_required");
  }
}
