import { db } from "@/lib/db";

/**
 * Hard-remove a user's membership in one hub AND clean up their future coverage
 * footprint there, in a single transaction — so the HostAssignment ledger can't
 * outlive the HubMember roster ("covers ⇒ member", session 146; the most likely
 * cause of "shown as covering but absent from the picker"). Future only — past
 * sessions stay as historical record.
 *
 * FK-safe order: SubClaim → SubRequest → HostAssignment (SubRequest.assignmentId
 * is Restrict). Their StandingAssignment rules go too, so the daily apply cron
 * stops re-creating assignments for someone no longer on the team.
 *
 * The caller owns authorization and confirming the membership exists; this helper
 * only does the destructive cleanup + delete and returns counts for logging.
 *
 * Shared by the in-hub hard-remove (`/api/hub/[slug]/members/[userId]` DELETE)
 * and the Member Registry hub-assignment tool (`/api/admin/members/[id]/hubs`
 * DELETE) so the cascade can't drift between the two call sites.
 */
export async function removeHubMembershipWithCleanup(
  hubId: string,
  hubSlug: string,
  userId: string,
): Promise<{ removedAssignments: number; removedRules: number }> {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const futureAssns = await tx.hostAssignment.findMany({
      where: { userId, hubSlug, sessionDate: { gte: now } },
      select: { id: true },
    });
    const futureIds = futureAssns.map((a) => a.id);
    if (futureIds.length > 0) {
      await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: futureIds } } } });
      await tx.subRequest.deleteMany({ where: { assignmentId: { in: futureIds } } });
      await tx.hostAssignment.deleteMany({ where: { id: { in: futureIds } } });
    }
    const rules = await tx.standingAssignment.deleteMany({ where: { userId, hubSlug } });
    await tx.hubMember.delete({ where: { hubId_userId: { hubId, userId } } });
    return { removedAssignments: futureIds.length, removedRules: rules.count };
  });
}
