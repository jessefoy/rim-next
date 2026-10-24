/**
 * A supporting team's page for one session (2026-10-24, Phase 3 slice 4,
 * "Who's helping, who's asking"): the greeters, or any supporting team on the
 * session (AV), not greeters by name. Who may open it, and as which team.
 *
 * Open to someone still on that team (active or paused; not inactive or
 * removed) assigned to that session (a dated assignment on that Central day,
 * or a standing one), that team's active coordinators,
 * and the Guiding Teacher. Admin alone does not open it (the rule that Admin
 * doesn't pass a team's door). The page shows names, the team's own
 * questions and arrivals: never contact details, never dana.
 */

import { db } from "@/lib/db";
import { centralToUtc, ctDayBounds, toCentralDatetime } from "@/lib/timezone";
import { isHubCoordinator } from "@/lib/hubAuth";

const DEFAULT_HOSTING_HUB_SLUG = "host-team";

export type SessionTeamAccess = {
  hub: { id: string; slug: string; name: string };
  why: "assigned" | "coordinator" | "guiding";
};

/** A real Central "YYYY-MM-DD", or null ("2026-02-30" is refused: it would
 *  roll over to March 2). */
export function cleanDay(day: unknown): string | null {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const noon = centralToUtc(`${day}T12:00`);
  return noon && toCentralDatetime(noon).slice(0, 10) === day ? day : null;
}

/**
 * The supporting team this person may see the session as, or null. With a
 * team named, only that team; otherwise the first they qualify for: a team
 * they're assigned to, then one they lead, then (for the guiding teacher) any
 * supporting team on the program.
 */
export async function sessionTeamAccess(
  userId: string,
  roles: string[] | undefined,
  program: { slug: string; hostingHubSlug: string | null },
  day: string,
  teamSlug?: string | null,
): Promise<SessionTeamAccess | null> {
  const hosting = program.hostingHubSlug || DEFAULT_HOSTING_HUB_SLUG;
  const coverage = (await db.programCoverageHub.findMany({ where: { programSlug: program.slug }, select: { hubSlug: true } }))
    .map((c) => c.hubSlug)
    .filter((h) => h !== hosting && (!teamSlug || h === teamSlug));
  if (coverage.length === 0) return null;
  const hubs = await db.hub.findMany({
    where: { slug: { in: coverage }, status: "ACTIVE" },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
  if (hubs.length === 0) return null;

  const start = centralToUtc(`${day}T00:00`);
  if (!start) return null;
  const { start: dayStart, end: dayEnd } = ctDayBounds(start);
  const assigned = await db.hostAssignment.findMany({
    where: {
      userId,
      programSlug: program.slug,
      hubSlug: { in: hubs.map((h) => h.slug) },
      OR: [{ sessionDate: null }, { sessionDate: { gte: dayStart, lte: dayEnd } }],
    },
    select: { hubSlug: true },
  });
  // An assignment counts only while they're still on the team: a standing
  // assignment can outlive a removal (only future dated rows are cleared).
  const onTeam = assigned.length
    ? new Set(
        (await db.hubMember.findMany({
          where: { userId, hub: { slug: { in: assigned.map((a) => a.hubSlug) } }, status: { in: ["ACTIVE", "PAUSED"] } },
          select: { hub: { select: { slug: true } } },
        })).map((m) => m.hub.slug),
      )
    : new Set<string>();
  for (const h of hubs) if (assigned.some((a) => a.hubSlug === h.slug) && onTeam.has(h.slug)) return { hub: h, why: "assigned" };
  for (const h of hubs) if (await isHubCoordinator(userId, h.slug)) return { hub: h, why: "coordinator" };
  if ((roles ?? []).includes("GUIDING_TEACHER")) return { hub: hubs[0], why: "guiding" };
  return null;
}
