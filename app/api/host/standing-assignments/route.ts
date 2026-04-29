/**
 * GET  /api/host/standing-assignments?programSlug=...
 *   Returns standing assignments for one program (or all if no param).
 *   Available to any authenticated host-team member.
 *
 * POST /api/host/standing-assignments
 *   Saves the full rotation for one program. Body:
 *     { programSlug: string, slots: SlotInput[] }
 *   Each slot: { occurrence, userId, endsOn? }
 *   Slots present → upsert. Slots absent (unassigned) → delete existing record.
 *   Coordinator / HOST_MANAGER / ADMIN only.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import type { StandingOccurrence } from "@prisma/client";

const OCCURRENCES: StandingOccurrence[] = [
  "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "ALL",
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

  const assignments = await db.standingAssignment.findMany({
    where: programSlug ? { programSlug } : undefined,
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

// ── POST ──────────────────────────────────────────────────────────────────────

interface SlotInput {
  occurrence: StandingOccurrence;
  userId: string;
  endsOn?: string | null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  // Must be HOST_MANAGER / ADMIN or a hub coordinator
  if (!isManager(roles) && !(await isCoordinator(session.user.id))) {
    return Response.json({ error: "Forbidden — coordinator or manager required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.programSlug || !Array.isArray(body.slots)) {
    return Response.json({ error: "programSlug and slots[] required" }, { status: 400 });
  }

  const { programSlug, slots } = body as { programSlug: string; slots: SlotInput[] };

  // Validate occurrence values
  for (const slot of slots) {
    if (!OCCURRENCES.includes(slot.occurrence)) {
      return Response.json({ error: `Invalid occurrence: ${slot.occurrence}` }, { status: 400 });
    }
  }

  // Build a map of occurrence → slot for quick lookup
  const slotMap = new Map(slots.map((s) => [s.occurrence, s]));

  // Fetch existing assignments for this program
  const existing = await db.standingAssignment.findMany({ where: { programSlug } });

  const ops: Promise<unknown>[] = [];

  // Upsert filled slots
  for (const slot of slots) {
    ops.push(
      db.standingAssignment.upsert({
        where: { programSlug_occurrence: { programSlug, occurrence: slot.occurrence } },
        create: {
          programSlug,
          occurrence: slot.occurrence,
          userId:      slot.userId,
          endsOn:      slot.endsOn ? new Date(slot.endsOn) : null,
          createdById: session.user.id,
        },
        update: {
          userId:  slot.userId,
          endsOn:  slot.endsOn ? new Date(slot.endsOn) : null,
          // Reset startsOn when reassigned so the new host gets immediate coverage
          startsOn: new Date(),
        },
      })
    );
  }

  // Delete slots that are no longer assigned (absent from slots array)
  for (const ex of existing) {
    if (!slotMap.has(ex.occurrence)) {
      ops.push(db.standingAssignment.delete({ where: { id: ex.id } }));
    }
  }

  await Promise.all(ops);

  return Response.json({ ok: true });
}
