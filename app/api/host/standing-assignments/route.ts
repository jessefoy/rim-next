/**
 * GET  /api/host/standing-assignments?programSlug=...
 *   Lists active standing rotations. Optional programSlug filter.
 *   Available to any authenticated host-team member (read-only).
 *
 * POST /api/host/standing-assignments
 *   Creates OR updates a single rotation rule. Body:
 *     { id?:        string,           -- present = update, absent = create
 *       programSlug: string,
 *       occurrence:  StandingOccurrence,
 *       userId:      string,
 *       endsOn?:     string | null    -- ISO date or null }
 *   Returns the saved record.
 *   Coordinator / HOST_MANAGER / ADMIN only.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import type { StandingOccurrence } from "@prisma/client";

const OCCURRENCES: StandingOccurrence[] = [
  "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "LAST", "ALL",
];

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

async function isCoordinator(userId: string): Promise<boolean> {
  const membership = await db.hubMember.findFirst({
    where: { userId, hub: { slug: "host-team" }, isCoordinator: true },
  });
  return !!membership;
}

async function hasEffectiveHostAccess(userId: string, roles: string[]): Promise<boolean> {
  if (roles.includes("ADMIN")) return true;
  const tentative = roles.includes("HOST") || roles.includes("HOST_MANAGER");
  return getEffectiveHostingCapability(userId, "host-team", tentative);
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];
  if (!(await hasEffectiveHostAccess(session.user.id, roles))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const programSlug = searchParams.get("programSlug");
  const userId      = searchParams.get("userId"); // optional: filter to a single host (for "your rotations")

  const assignments = await db.standingAssignment.findMany({
    where: {
      ...(programSlug ? { programSlug } : {}),
      ...(userId      ? { userId      } : {}),
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
    orderBy: [{ programSlug: "asc" }, { occurrence: "asc" }],
  });

  return Response.json(
    assignments.map((a) => ({
      id:          a.id,
      programSlug: a.programSlug,
      occurrence:  a.occurrence,
      userId:      a.userId,
      hostName:
        a.user.preferredName ||
        [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") ||
        null,
      startsOn: a.startsOn.toISOString(),
      endsOn:   a.endsOn?.toISOString() ?? null,
    }))
  );
}

// ── POST (create or update single rotation) ──────────────────────────────────

interface RotationInput {
  id?:         string;
  programSlug: string;
  occurrence:  StandingOccurrence;
  userId:      string;
  endsOn?:     string | null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  if (!isManager(roles) && !(await isCoordinator(session.user.id))) {
    return Response.json({ error: "Forbidden — coordinator or manager required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as RotationInput | null;
  if (!body?.programSlug || !body?.occurrence || !body?.userId) {
    return Response.json(
      { error: "programSlug, occurrence, and userId are required" },
      { status: 400 }
    );
  }
  if (!OCCURRENCES.includes(body.occurrence)) {
    return Response.json({ error: `Invalid occurrence: ${body.occurrence}` }, { status: 400 });
  }

  const endsOn = body.endsOn ? new Date(body.endsOn) : null;

  let saved;
  if (body.id) {
    // UPDATE
    saved = await db.standingAssignment.update({
      where: { id: body.id },
      data: {
        programSlug: body.programSlug,
        occurrence:  body.occurrence,
        userId:      body.userId,
        endsOn,
      },
    });
  } else {
    // CREATE — upsert on (programSlug, occurrence) so changing the host of an
    // existing slot via the "+ Add" form replaces in place rather than failing.
    saved = await db.standingAssignment.upsert({
      where: { programSlug_occurrence: { programSlug: body.programSlug, occurrence: body.occurrence } },
      create: {
        programSlug: body.programSlug,
        occurrence:  body.occurrence,
        userId:      body.userId,
        endsOn,
        createdById: session.user.id,
      },
      update: {
        userId:   body.userId,
        endsOn,
        startsOn: new Date(), // reset window when re-assigning
      },
    });
  }

  return Response.json({
    id:          saved.id,
    programSlug: saved.programSlug,
    occurrence:  saved.occurrence,
    userId:      saved.userId,
    startsOn:    saved.startsOn.toISOString(),
    endsOn:      saved.endsOn?.toISOString() ?? null,
  });
}
