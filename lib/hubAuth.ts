import { db } from "@/lib/db";

/**
 * Fetch hub + membership for the current user. Returns null if hub doesn't
 * exist or user is not a member. Caller decides whether to 404 or 403.
 */
export async function getHubMembership(slug: string, userId: string) {
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
  if (!hub) return { hub: null, member: null };

  const member = hub.members.find((m) => m.userId === userId) ?? null;
  return { hub, member };
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
