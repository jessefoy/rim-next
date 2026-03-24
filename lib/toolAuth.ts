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
