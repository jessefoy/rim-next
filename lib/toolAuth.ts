import { db } from "@/lib/db";

/**
 * Who may use the Program Manager (Jesse, 2026-10-19): the Registrar, Admin
 * and Guiding Teacher roles. One rule for its pages and every API behind them.
 * Team membership alone does not open it, unlike the other tools (registrant
 * contact details and gifts are registry-level data), and the page and its
 * saves used to follow different rules (2026-10-19 audit).
 */
export const PROGRAM_MANAGER_ROLES = ["REGISTRAR", "ADMIN", "GUIDING_TEACHER"] as const;

export function canUseProgramManager(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.some((r) => (PROGRAM_MANAGER_ROLES as readonly string[]).includes(r));
}

/**
 * Who may use the Registration app and every API that reads or changes a
 * registration (2026-10-23): the Registrar, Admin and Guiding Teacher roles,
 * by role only. Today the same people as the Program Manager, but its own
 * rule: when Programs opens to the teams that set programs up, people's
 * contact details and answers stay here. Team membership never opens it, so
 * someone who leaves the role leaves the data.
 */
export const REGISTRATION_ROLES = ["REGISTRAR", "ADMIN", "GUIDING_TEACHER"] as const;

export function canUseRegistration(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.some((r) => (REGISTRATION_ROLES as readonly string[]).includes(r));
}

/**
 * Whether a Space shows an installed app to this person. The two role-only
 * apps (Programs, Registration) hide from a team's rail and Home for members
 * without the role: a card that opened "You don't have permission" was worse
 * than none (2026-10-19). Every other app shows to every member.
 */
export function canSeeInstalledApp(toolSlug: string | null, roles: readonly string[] | null | undefined): boolean {
  if (toolSlug === "programs") return canUseProgramManager(roles);
  if (toolSlug === "registration") return canUseRegistration(roles);
  return true;
}

/**
 * Who may see how much someone gave (Jesse, 2026-10-23: "relatively
 * private"): the Registrar, Guiding Teacher and Admin roles. Anyone else
 * helping with a program sees whether dana is finished, never the amount,
 * and no helper's page shows dana at all.
 */
export function canSeeDanaAmounts(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.some((r) => r === "REGISTRAR" || r === "GUIDING_TEACHER" || r === "ADMIN");
}

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
 * This is the standard gate for the tools, except the Program Manager, which
 * is role-only (canUseProgramManager above). Every other tool layout should use
 * this instead of inline role checks.
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
  /** `canCover`: only members who may take sessions on the schedule
   *  (hostingCapability). For coverage asks (cover requests, a new program to
   *  staff): a member taken off the schedule can't act on them (2026-10-16). */
  options?: {
    coordinatorsOnly?: boolean;
    excludeUserId?: string;
    canCover?: boolean;
    /** Also those whose team emails are switched off, marked `muted`: they
     *  get the notice in Notifications, not the email (Jesse, 2026-10-20). */
    withMuted?: boolean;
  },
) {
  const hub = await db.hub.findUnique({
    where: { slug: hubSlug },
    include: {
      members: {
        where: {
          status: "ACTIVE",
          ...(options?.withMuted ? {} : { communicationsEnabled: true }),
          ...(options?.coordinatorsOnly ? { isCoordinator: true } : {}),
          ...(options?.canCover ? { hostingCapability: true } : {}),
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
  return hub?.members.map((m) => ({ ...m.user, muted: !m.communicationsEnabled })) ?? [];
}
