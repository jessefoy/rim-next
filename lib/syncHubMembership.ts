import { db } from "@/lib/db";
import { sendHubWelcomeEmail, hubHomeUrl } from "@/lib/email";

/**
 * Maps system roles to the hub memberships they imply.
 * When a role is granted, the corresponding HubMember record is created/updated.
 *
 * Priority: isCoordinator: true beats false when a user holds multiple roles for the same hub.
 * Example: HOST_MANAGER wins over HOST if both are present.
 *
 * To add a new mapping as new hubs and roles are introduced:
 *   SOME_ROLE: [{ slug: "hub-slug", position: "Position Label", isCoordinator: false }],
 */
const ROLE_HUB_MAPPINGS: Record<
  string,
  { slug: string; position: string; isCoordinator: boolean }[]
> = {
  HOST:         [{ slug: "host-team", position: "Host",             isCoordinator: false }],
  HOST_MANAGER: [{ slug: "host-team", position: "Host Coordinator", isCoordinator: true  }],
  TEACHER:      [{ slug: "courses",   position: "Teacher",          isCoordinator: false }],
  REGISTRAR:    [{ slug: "registrar", position: "Registrar",        isCoordinator: true  }],
  SUPPORT:      [{ slug: "support",  position: "Support Team",     isCoordinator: false }],
};

/**
 * Syncs HubMember records for a user based on their full updated roles array.
 *
 * Field ownership:
 *   - Sync owns: hubId, userId, position, isCoordinator (identity + role-derived)
 *   - Coordinator owns: status, hostingCapability, communicationsEnabled,
 *     pausedAt, pausedById, pauseNote, coordinatorNote
 *   - Member owns: firstVisitedAt, lastVisitedAt
 *
 * This function MUST NOT touch coordinator-owned or member-owned fields.
 *
 * No-delete policy: when a role is revoked, the HubMember record is preserved.
 * Coordinator-owned state (pause notes, capability flags) would otherwise be
 * silently lost. Hard removal is ADMIN-only via the DELETE endpoint.
 *
 * Safe to call on every role update — idempotent when roles haven't changed.
 */
export async function syncHubMembership(userId: string, roles: string[]): Promise<void> {
  const allManagedSlugs = [
    ...new Set(Object.values(ROLE_HUB_MAPPINGS).flat().map((m) => m.slug)),
  ];

  const managedHubs = await db.hub.findMany({
    where:  { slug: { in: allManagedSlugs } },
    select: { id: true, slug: true, name: true },
  });
  const hubIdBySlug = new Map(managedHubs.map((h) => [h.slug, h.id]));

  // Determine which hubs this user should be in and at what level.
  // Higher privilege (isCoordinator: true) wins if multiple roles map to the same hub.
  const targetBySlug = new Map<string, { position: string; isCoordinator: boolean }>();
  for (const role of roles) {
    for (const mapping of ROLE_HUB_MAPPINGS[role] ?? []) {
      const existing = targetBySlug.get(mapping.slug);
      if (!existing || (!existing.isCoordinator && mapping.isCoordinator)) {
        targetBySlug.set(mapping.slug, {
          position:      mapping.position,
          isCoordinator: mapping.isCoordinator,
        });
      }
    }
  }

  // Upsert: create or update membership for every hub the user should be in.
  // Only sync-owned fields are written; coordinator-owned fields are never touched.
  const newlyCreatedSlugs: string[] = [];

  for (const [slug, config] of targetBySlug) {
    const hubId = hubIdBySlug.get(slug);
    if (!hubId) continue;

    const existing = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId, userId } },
      select: { id: true },
    });

    await db.hubMember.upsert({
      where:  { hubId_userId: { hubId, userId } },
      create: { hubId, userId, position: config.position, isCoordinator: config.isCoordinator },
      update: { position: config.position, isCoordinator: config.isCoordinator },
    });

    if (!existing) newlyCreatedSlugs.push(slug);
  }

  // Intentionally NO deletes. If a role is revoked, the HubMember record stays
  // so coordinator-owned fields are preserved. Removing a member from a hub
  // requires an explicit ADMIN-only DELETE via the hub members API.

  // Fire-and-forget: send welcome emails for newly created hub memberships
  if (newlyCreatedSlugs.length > 0) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    if (user?.email) {
      const newHubs = managedHubs.filter((h) => newlyCreatedSlugs.includes(h.slug));
      // Await sends instead of fire-and-forget.  The caller (admin role
      // grant) already awaits this whole function, so awaiting here just
      // converts "fire-and-forget Promise" (which Vercel may kill at
      // teardown) into "awaited Promise" — same execution time on the
      // happy path, reliable delivery, errors logged via console.error
      // rather than swallowed.  See RIM_Email_Engineering.md.
      const userEmail = user.email;
      const userFirstName = user.firstName;
      await Promise.all(
        newHubs.map(async (hub) => {
          try {
            await sendHubWelcomeEmail({
              to: userEmail,
              firstName: userFirstName,
              hubName: hub.name,
              hubUrl: hubHomeUrl(hub.slug),
            });
          } catch (e) {
            console.error(`[syncHubMembership] welcome email failed for hub ${hub.slug}:`, e);
          }
        }),
      );
    }
  }
}
