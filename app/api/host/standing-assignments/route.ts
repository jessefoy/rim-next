/**
 * GET  /api/host/standing-assignments?programSlug=...&userId=...
 *   Lists active standing rotations. Optional filters.
 *   Available to any authenticated host-team member (read-only).
 *
 * POST /api/host/standing-assignments
 *   Saves an entire rotation BUNDLE for one (programSlug, dayOfWeek) in a
 *   single atomic transaction. Body shape (pattern-based, matches the
 *   coordinator UX):
 *
 *     {
 *       programSlug: string,
 *       dayOfWeek:   "MO"|"TU"|"WE"|"TH"|"FR"|"SA"|"SU",
 *       pattern:     "same" | "alternate" | "pair" | "custom",
 *       hosts: {                       -- shape depends on pattern:
 *         every?:  string,             -- "same"
 *         oddWk?:  string, evenWk?: string,  -- "alternate" (1st&3rd, 2nd&4th)
 *         firstHalf?: string, secondHalf?: string,  -- "pair" (1st&2nd, 3rd&4th)
 *         first?: string, second?: string, third?: string, fourth?: string,
 *                                       -- "custom" (any subset filled)
 *       },
 *       fifthHost?:   string | null,  -- 5th-occurrence host (any pattern)
 *       endsOn?:      string | null   -- ISO date or null
 *     }
 *
 *   Backend translates this into 1–6 StandingAssignment records, atomically:
 *     - DELETEs any existing records in (programSlug, dayOfWeek) bundle that
 *       aren't in the new set
 *     - UPSERTs each record in the new set
 *
 *   Returns: { saved: [{id, occurrence, userId}, ...], dayOfWeek, programSlug }
 *
 *   Coordinator / HOST_MANAGER / ADMIN only.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import type { StandingOccurrence } from "@prisma/client";

const VALID_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
type DayOfWeek = (typeof VALID_DAYS)[number];

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
  const userId      = searchParams.get("userId");

  const assignments = await db.standingAssignment.findMany({
    where: {
      ...(programSlug ? { programSlug } : {}),
      ...(userId      ? { userId      } : {}),
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
    orderBy: [{ programSlug: "asc" }, { dayOfWeek: "asc" }, { occurrence: "asc" }],
  });

  return Response.json(
    assignments.map((a) => ({
      id:          a.id,
      programSlug: a.programSlug,
      dayOfWeek:   a.dayOfWeek,
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

// ── POST: pattern-based bundle save ──────────────────────────────────────────

interface BundleInput {
  programSlug: string;
  dayOfWeek:   DayOfWeek;
  pattern:     "same" | "alternate" | "pair" | "custom";
  hosts: {
    every?:       string;
    oddWk?:       string;
    evenWk?:      string;
    firstHalf?:   string;
    secondHalf?:  string;
    first?:       string;
    second?:      string;
    third?:       string;
    fourth?:      string;
  };
  fifthHost?: string | null;
  endsOn?:    string | null;
}

/**
 * Translates a pattern + hosts payload into the underlying record set.
 * Returns Map<occurrence, userId> — only filled cells.
 */
function patternToRecords(input: BundleInput): Map<StandingOccurrence, string> {
  const out = new Map<StandingOccurrence, string>();
  const h = input.hosts;

  switch (input.pattern) {
    case "same":
      // One ALL record. Apply-time specificity rule lets a FIFTH override it.
      if (h.every) out.set("ALL", h.every);
      break;

    case "alternate":
      if (h.oddWk) {
        out.set("FIRST", h.oddWk);
        out.set("THIRD", h.oddWk);
      }
      if (h.evenWk) {
        out.set("SECOND", h.evenWk);
        out.set("FOURTH", h.evenWk);
      }
      break;

    case "pair":
      if (h.firstHalf) {
        out.set("FIRST",  h.firstHalf);
        out.set("SECOND", h.firstHalf);
      }
      if (h.secondHalf) {
        out.set("THIRD",  h.secondHalf);
        out.set("FOURTH", h.secondHalf);
      }
      break;

    case "custom":
      if (h.first)  out.set("FIRST",  h.first);
      if (h.second) out.set("SECOND", h.second);
      if (h.third)  out.set("THIRD",  h.third);
      if (h.fourth) out.set("FOURTH", h.fourth);
      break;
  }

  if (input.fifthHost) out.set("FIFTH", input.fifthHost);
  return out;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  if (!isManager(roles) && !(await isCoordinator(session.user.id))) {
    return Response.json({ error: "Forbidden — coordinator or manager required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as BundleInput | null;
  if (!body?.programSlug || !body?.dayOfWeek || !body?.pattern || !body?.hosts) {
    return Response.json(
      { error: "programSlug, dayOfWeek, pattern, and hosts are required" },
      { status: 400 }
    );
  }
  if (!VALID_DAYS.includes(body.dayOfWeek)) {
    return Response.json({ error: `Invalid dayOfWeek: ${body.dayOfWeek}` }, { status: 400 });
  }
  if (!["same", "alternate", "pair", "custom"].includes(body.pattern)) {
    return Response.json({ error: `Invalid pattern: ${body.pattern}` }, { status: 400 });
  }

  const targets = patternToRecords(body);

  if (targets.size === 0) {
    return Response.json(
      { error: "Pattern requires at least one host. Pick a person before saving." },
      { status: 400 }
    );
  }

  const endsOn = body.endsOn ? new Date(body.endsOn) : null;

  // Single transaction: delete any existing records in the bundle that aren't
  // in the new set, then upsert each target record.
  const saved = await db.$transaction(async (tx) => {
    const existing = await tx.standingAssignment.findMany({
      where: { programSlug: body.programSlug, dayOfWeek: body.dayOfWeek },
      select: { id: true, occurrence: true },
    });

    // DELETE records not in the new set
    const targetOccs = new Set(targets.keys());
    for (const ex of existing) {
      if (!targetOccs.has(ex.occurrence)) {
        await tx.standingAssignment.delete({ where: { id: ex.id } });
      }
    }

    // UPSERT each target record
    const out: Array<{ id: string; occurrence: StandingOccurrence; userId: string }> = [];
    for (const [occurrence, userId] of targets.entries()) {
      const rec = await tx.standingAssignment.upsert({
        where: {
          programSlug_dayOfWeek_occurrence: {
            programSlug: body.programSlug,
            dayOfWeek:   body.dayOfWeek,
            occurrence,
          },
        },
        create: {
          programSlug: body.programSlug,
          dayOfWeek:   body.dayOfWeek,
          occurrence,
          userId,
          endsOn,
          createdById: session.user!.id,
        },
        update: {
          userId,
          endsOn,
          // Reset window when re-saving so the new assignment takes effect now
          startsOn: new Date(),
        },
      });
      out.push({ id: rec.id, occurrence: rec.occurrence, userId: rec.userId });
    }

    return out;
  });

  return Response.json({
    programSlug: body.programSlug,
    dayOfWeek:   body.dayOfWeek,
    saved,
  });
}
