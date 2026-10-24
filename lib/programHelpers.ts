/**
 * Teams that prepare for a program (2026-10-24, Phase 3 slice 5, "Who's
 * helping, who's asking"): a kitchen team, say, that helps without being on
 * the program's schedule. Stored in `program_helpers` by the team's id, with
 * `canReach` (its members see email and phone on Helping with).
 *
 * A team may prepare only while it is active and has the Helping with app
 * installed: that is where its members see the programs and their own
 * questions' answers (/tools/helping). Separate from supporting teams
 * (ProgramCoverageHub), which the Scheduler, coverage notices and the Zoom
 * door read; nothing there reads this table.
 */

import { db } from "@/lib/db";

export const HELPING_TOOL_SLUG = "helping";

/** Teams that may prepare for a program: active, with Helping with installed. */
export async function helpingTeams(): Promise<{ id: string; slug: string; name: string }[]> {
  return db.hub.findMany({
    where: { status: "ACTIVE", appLinks: { some: { toolSlug: HELPING_TOOL_SLUG, isEnabled: true } } },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Why this team can't be added as a team that prepares, or null. */
export async function helperTeamRefusal(hubId: string): Promise<string | null> {
  const hub = await db.hub.findUnique({
    where: { id: hubId },
    select: { name: true, status: true, appLinks: { where: { toolSlug: HELPING_TOOL_SLUG, isEnabled: true }, select: { id: true } } },
  });
  if (!hub) return "That team couldn’t be found.";
  if (hub.status !== "ACTIVE") return `The ${hub.name} isn’t active, so it can’t help with a program.`;
  if (hub.appLinks.length === 0) return `The ${hub.name} doesn’t have Helping with installed, so it can’t prepare for a program yet.`;
  return null;
}

export interface HelperTeamInput {
  hubId: string;
  canReach: boolean;
}

/** The teams that prepare, as sent by the editor: well-formed, one per team, sorted. */
export function cleanHelperTeams(input: unknown): HelperTeamInput[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const out: HelperTeamInput[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const hubId = (item as Record<string, unknown>).hubId;
    const canReach = (item as Record<string, unknown>).canReach;
    if (typeof hubId !== "string" || !hubId.trim()) return null;
    if (seen.has(hubId)) continue;
    seen.add(hubId);
    out.push({ hubId, canReach: canReach === true });
  }
  return out.sort((a, b) => a.hubId.localeCompare(b.hubId));
}

/**
 * Save a program's teams that prepare. A team newly added must pass
 * helperTeamRefusal; teams already on the program stay without re-checking,
 * so an unrelated edit never fails on them. Returns a refusal, or null.
 */
export async function checkHelperTeams(programId: string | null, teams: HelperTeamInput[]): Promise<string | null> {
  const existing = programId
    ? new Set((await db.programHelper.findMany({ where: { programId }, select: { hubId: true } })).map((h) => h.hubId))
    : new Set<string>();
  for (const t of teams) {
    if (existing.has(t.hubId)) continue;
    const refusal = await helperTeamRefusal(t.hubId);
    if (refusal) return refusal;
  }
  return null;
}

export async function saveHelperTeams(programId: string, teams: HelperTeamInput[]): Promise<void> {
  await db.$transaction([
    db.programHelper.deleteMany({ where: { programId, hubId: { notIn: teams.map((t) => t.hubId) } } }),
    ...teams.map((t) =>
      db.programHelper.upsert({
        where: { programId_hubId: { programId, hubId: t.hubId } },
        create: { programId, hubId: t.hubId, canReach: t.canReach },
        update: { canReach: t.canReach },
      }),
    ),
  ]);
}

/**
 * May this person use Helping with as this team? The team must be active and
 * have Helping with installed; the person an active member of it, or the
 * guiding teacher. Admin alone does not open a team's page.
 */
export async function helpingTeamAccess(
  userId: string,
  roles: string[] | undefined,
  hubSlug: string | null | undefined,
): Promise<{ id: string; slug: string; name: string } | null> {
  if (!hubSlug) return null;
  const hub = await db.hub.findFirst({
    where: { slug: hubSlug, status: "ACTIVE", appLinks: { some: { toolSlug: HELPING_TOOL_SLUG, isEnabled: true } } },
    select: { id: true, slug: true, name: true },
  });
  if (!hub) return null;
  if ((roles ?? []).includes("GUIDING_TEACHER")) return hub;
  const member = await db.hubMember.findFirst({ where: { hubId: hub.id, userId, status: "ACTIVE" }, select: { id: true } });
  return member ? hub : null;
}

/** The teams with Helping with that this person is an active member of. */
export async function myHelpingTeams(userId: string): Promise<{ id: string; slug: string; name: string }[]> {
  return db.hub.findMany({
    where: {
      status: "ACTIVE",
      appLinks: { some: { toolSlug: HELPING_TOOL_SLUG, isEnabled: true } },
      members: { some: { userId, status: "ACTIVE" } },
    },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
}
