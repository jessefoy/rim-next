import { db } from "@/lib/db";

/**
 * Check if a user has access to a tool.
 *
 * Access is granted if the user:
 * 1. Has one of the required roles (or ADMIN), OR
 * 2. Has an individual UserToolAccess grant for this tool
 *
 * This is the standard gate for all tools. Every tool layout should use this
 * instead of inline role checks.
 *
 * Usage:
 *   const hasAccess = await hasToolAccess(userId, roles, ["TEACHER"], "learning");
 */
export async function hasToolAccess(
  userId: string,
  roles: string[],
  requiredRoles: string[],
  toolSlug: string,
): Promise<boolean> {
  if (roles.some((r) => requiredRoles.includes(r) || r === "ADMIN")) return true;

  const grant = await db.userToolAccess.findUnique({
    where: { userId_toolSlug: { userId, toolSlug } },
  });
  return !!grant;
}

/**
 * Fetch hub context for a tool page.
 *
 * When a tool is launched from a hub sidebar, the URL includes ?hub=<slug>.
 * This function resolves that slug into the full hub record with members.
 *
 * Returns null if no hubSlug provided or hub not found.
 *
 * Usage (in a server page component):
 *   const { hub: hubSlug } = await searchParams;
 *   const hubContext = await getToolHubContext(hubSlug);
 *   const teamMembers = hubContext?.members ?? [];
 */
export async function getToolHubContext(hubSlug: string | undefined) {
  if (!hubSlug) return null;
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              email: true,
              title: true,
            },
          },
        },
        orderBy: [{ isCoordinator: "desc" }, { joinedAt: "asc" }],
      },
    },
  });
  return hub;
}

/**
 * Get notification recipients from a hub's member list.
 *
 * Returns all active (non-archived) members of a hub. Used by notification
 * code to replace hardcoded role queries. Hub membership is the source of
 * truth for who should receive alerts and emails for hub-related events.
 *
 * Options:
 *   coordinatorsOnly — only return members with isCoordinator: true
 *   excludeUserId — exclude a specific user (e.g. the person who triggered the event)
 *
 * Usage:
 *   const recipients = await getHubNotificationRecipients("host-team", { excludeUserId: actor.id });
 */
export async function getHubNotificationRecipients(
  hubSlug: string,
  options?: { coordinatorsOnly?: boolean; excludeUserId?: string },
) {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    include: {
      members: {
        where: {
          ...(options?.coordinatorsOnly ? { isCoordinator: true } : {}),
          user: { archivedAt: null },
          ...(options?.excludeUserId ? { NOT: { userId: options.excludeUserId } } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              preferredName: true,
            },
          },
        },
      },
    },
  });
  return hub?.members.map((m) => m.user) ?? [];
}
