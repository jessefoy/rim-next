import { db } from "@/lib/db";

/**
 * Maps system roles to the hub memberships they imply.
 * When a role is granted, the corresponding HubMember record is created/updated.
 * When a role is removed (and no other mapped role still covers that hub), the record is deleted.
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
  TEACHER:      [{ slug: "teacher",   position: "Teacher",          isCoordinator: false }],
  REGISTRAR:    [{ slug: "registrar", position: "Registrar",        isCoordinator: true  }],
  SUPPORT:      [{ slug: "support",  position: "Support Team",     isCoordinator: false }],
};

/**
 * Syncs HubMember records for a user based on their full updated roles array.
 *
 * - Upserts a HubMember record for every hub implied by active roles.
 *   (position and isCoordinator are updated if a record already exists.)
 * - Deletes HubMember records for managed hubs no longer implied by any active role.
 *
 * Safe to call on every role update — idempotent when roles haven't changed.
 * Should be called after db.user.update() whenever roles is in the update payload.
 */
export async function syncHubMembership(userId: string, roles: string[]): Promise<void> {
  // All hub slugs this function is responsible for (determines cleanup scope)
  const allManagedSlugs = [
    ...new Set(Object.values(ROLE_HUB_MAPPINGS).flat().map((m) => m.slug)),
  ];

  // Resolve slugs → hub ids in one query
  const managedHubs = await db.hub.findMany({
    where:  { slug: { in: allManagedSlugs } },
    select: { id: true, slug: true },
  });
  const hubIdBySlug  = new Map(managedHubs.map((h) => [h.slug, h.id]));
  const hubSlugById  = new Map(managedHubs.map((h) => [h.id,   h.slug]));
  const managedHubIds = managedHubs.map((h) => h.id);

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

  // Upsert: create or update membership for every hub the user should be in
  for (const [slug, config] of targetBySlug) {
    const hubId = hubIdBySlug.get(slug);
    if (!hubId) continue; // hub not seeded yet — skip silently

    await db.hubMember.upsert({
      where:  { hubId_userId: { hubId, userId } },
      create: { hubId, userId, position: config.position, isCoordinator: config.isCoordinator },
      update: { position: config.position, isCoordinator: config.isCoordinator },
    });
  }

  // Delete: remove memberships for managed hubs the user no longer qualifies for
  const existingMemberships = await db.hubMember.findMany({
    where:  { userId, hubId: { in: managedHubIds } },
    select: { id: true, hubId: true },
  });

  for (const m of existingMemberships) {
    const slug = hubSlugById.get(m.hubId);
    if (slug && !targetBySlug.has(slug)) {
      await db.hubMember.delete({ where: { id: m.id } });
    }
  }
}
