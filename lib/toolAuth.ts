import { db } from "@/lib/db";

/**
 * Check if a user has access to a tool.
 *
 * Access is granted if the user:
 * 1. Has one of the required roles (or ADMIN), OR
 * 2. Has an individual UserToolAccess grant for this tool, OR
 * 3. Is a member of any hub that has this tool linked via HubAppLink
 *
 * Pathway 3 is the primary intent: hub membership implies access to that hub's tools.
 * Pathways 1 and 2 remain as safety nets and for edge-case grants.
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
  if (grant) return true;

  // Hub membership pathway: if the user is a member of any hub that links to this tool,
  // they have access. This is the primary grant mechanism — hub coordinators add team
  // members to a hub and they automatically gain access to that hub's tools.
  const hubAccess = await db.hubMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      hub: {
        status: "ACTIVE",
        appLinks: {
          some: { toolSlug, isEnabled: true },
        },
      },
    },
  });
  return !!hubAccess;
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
 * Respects hub-membership authority (Phase 3):
 *   - Only status === "ACTIVE" members are included.
 *   - Only members with communicationsEnabled === true are included.
 *   - Archived users are excluded.
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
          status: "ACTIVE",
          communicationsEnabled: true,
          ...(options?.coordinatorsOnly ? { isCoordinator: true } : {}),
          // emailVerified must be set: excludes pre-threshold / staged members.
          // An admin can add a host to a hub before they've ever logged in —
          // they must receive ZERO hub-pool notifications until they onboard.
          // This is the durable gate for EVERY pool email (new-program-needs-host,
          // sub-request-*, and any future getHubNotificationRecipients consumer);
          // direct 1:1 member emails are gated separately in lib/email.ts. A real,
          // active member always has emailVerified set, so this never excludes
          // anyone who has actually signed in.
          user: { archivedAt: null, emailVerified: { not: null } },
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
