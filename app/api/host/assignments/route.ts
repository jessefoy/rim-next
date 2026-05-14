import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { getHubNotificationRecipients } from "@/lib/toolAuth";
import { sendHostAssignmentConfirmationEmail } from "@/lib/email";

/**
 * Format a session date for use in host emails.
 * Matches the format used in sub-claim ("Thu, May 22") and standing-assignment
 * emails so all host notifications speak the same dialect.
 */
function formatSessionDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

/**
 * Fire-and-forget: send "you're hosting" confirmation to the assignee.
 * Resolves the program's human name from the slug. Wrapped in after() by
 * the caller — this helper assumes it's running in deferred work.
 */
async function notifyAssignedHost(
  assignedUserId: string,
  programSlug: string,
  sessionDate: Date | null,
): Promise<void> {
  try {
    const [program, assignee] = await Promise.all([
      db.program.findUnique({ where: { slug: programSlug }, select: { name: true } }),
      db.user.findUnique({ where: { id: assignedUserId }, select: { email: true, firstName: true } }),
    ]);
    if (!assignee?.email) return;
    await sendHostAssignmentConfirmationEmail({
      to: assignee.email,
      firstName: assignee.firstName,
      programName: program?.name || programSlug,
      dateText: formatSessionDate(sessionDate),
    });
  } catch (e) {
    console.error("[host-assignment] confirmation email error:", e);
  }
}

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

async function hasEffectiveHostAccess(userId: string, roles: string[]): Promise<boolean> {
  if (roles.includes("ADMIN")) return true;
  const tentative = roles.includes("HOST") || roles.includes("HOST_MANAGER");
  return getEffectiveHostingCapability(userId, "host-team", tentative);
}

// ── Date helpers (duplicated from schedule/page.tsx — same logic) ─────────────

function ctDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
}

const ICAL_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function dateToDayCode(dateStr: string): string {
  return ICAL_DAY[new Date(dateStr + "T12:00:00").getDay()];
}

function shiftToDate(anchorISO: string, targetDate: string): Date {
  const anchor = new Date(anchorISO);
  const anchorCTDate = ctDateStr(anchorISO);
  if (anchorCTDate === targetDate) return anchor;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (new Date(targetDate + "T12:00:00").getTime() - new Date(anchorCTDate + "T12:00:00").getTime())
    / msPerDay
  );
  return new Date(anchor.getTime() + daysDiff * msPerDay);
}

interface PgProgram {
  id: string;
  name: string;
  slug: string;
  programFormat: string | null;
  startDatetime: Date | null;
  endDatetime: Date | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
  recurrenceCount: number | null;
  livekitRoom?: string | null;
}

function isOccurrenceOnDate(p: PgProgram, dateStr: string): boolean {
  if (!p.startDatetime) return false;
  const anchor = ctDateStr(p.startDatetime.toISOString());
  if (anchor > dateStr) return false;
  if (!p.recurrenceFreq) return anchor === dateStr;

  const freq = p.recurrenceFreq.toUpperCase();
  if (freq === "WEEKLY") {
    const days = p.recurrenceDays ?? [];
    if (days.length > 0 && !days.includes(dateToDayCode(dateStr))) return false;
    const n = p.recurrenceInterval ?? 1;
    if (n > 1) {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.round(
        (new Date(dateStr + "T12:00:00").getTime() - new Date(anchor + "T12:00:00").getTime())
        / msPerWeek
      );
      if (weeksDiff % n !== 0) return false;
    }
    if (p.recurrenceCount && p.recurrenceCount >= 2) {
      const daysPerCycle = p.recurrenceDays?.length ?? 1;
      const cyclesNeeded = Math.ceil((p.recurrenceCount - 1) / daysPerCycle);
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const lastMs = new Date(anchor + "T12:00:00").getTime()
        + cyclesNeeded * (p.recurrenceInterval ?? 1) * msPerWeek;
      if (new Date(dateStr + "T12:00:00").getTime() > lastMs) return false;
    }
    return true;
  }

  return anchor === dateStr;
}

// GET /api/host/assignments?month=YYYY-MM
// Returns all program occurrences for the month merged with assignment records.
// Sessions with no HostAssignment get a synthetic id ("unassigned::slug::YYYY-MM-DD")
// and status "unclaimed". This is used by HubScheduleClient for month navigation.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!(await hasEffectiveHostAccess(session.user.id, roles))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // e.g. "2026-03"

  if (!monthParam) {
    // No month param — return raw assignments (backward compat for any direct callers)
    const assignments = await db.hostAssignment.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true, email: true } },
        subRequests: { where: { status: "OPEN" }, select: { id: true, message: true }, take: 1 },
      },
      orderBy: [{ sessionDate: "asc" }, { programSlug: "asc" }],
    });
    return Response.json(
      assignments.map((a) => {
        const openSub = a.subRequests[0] ?? null;
        const status: "unclaimed" | "claimed" | "sub_needed" = !a.userId
          ? "unclaimed" : openSub ? "sub_needed" : "claimed";
        return {
          id: a.id, programSlug: a.programSlug,
          sessionDate: a.sessionDate?.toISOString() ?? null,
          status, hostUserId: a.userId ?? null,
          hostName: a.user
            ? (a.user.preferredName || [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || a.user.email)
            : null,
          subRequestId: openSub?.id ?? null, subMessage: openSub?.message ?? null,
        };
      })
    );
  }

  const [yearN, monthN] = monthParam.split("-").map(Number);
  const startOfMonth = new Date(yearN, monthN - 1, 1);
  const endOfMonth   = new Date(yearN, monthN, 0, 23, 59, 59, 999);
  const daysInMonth  = new Date(yearN, monthN, 0).getDate();

  const [pgPrograms, assignments] = await Promise.all([
    db.program.findMany({
      where: { programFormat: { in: ["virtual", "hybrid"] }, archivedAt: null },
      select: {
        id: true, name: true, slug: true,
        programFormat: true, startDatetime: true, endDatetime: true,
        recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true,
        livekitRoom: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.hostAssignment.findMany({
      where: { sessionDate: { gte: startOfMonth, lte: endOfMonth } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        subRequests: { where: { status: "OPEN" }, select: { id: true, message: true }, take: 1 },
      },
      orderBy: { sessionDate: "asc" },
    }),
  ]);

  // Build pause-state map: userId → "paused" | "inactive" | null
  // A single query covers all assigned hosts in this month's sessions.
  const assignedUserIds = [...new Set(assignments.map((a) => a.userId).filter(Boolean))] as string[];
  const pauseMap = new Map<string, "paused" | "inactive">();
  if (assignedUserIds.length > 0) {
    const hostHub = await db.hub.findUnique({ where: { slug: "host-team" }, select: { id: true } });
    if (hostHub) {
      const hubMembers = await db.hubMember.findMany({
        where: { hubId: hostHub.id, userId: { in: assignedUserIds } },
        select: { userId: true, status: true, hostingCapability: true },
      });
      for (const m of hubMembers) {
        if (m.status === "INACTIVE") {
          pauseMap.set(m.userId, "inactive");
        } else if (m.status === "PAUSED" || !m.hostingCapability) {
          pauseMap.set(m.userId, "paused");
        }
      }
    }
  }

  const assignmentMap = new Map(
    assignments.map((a) => {
      const dateStr = a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : "";
      return [`${a.programSlug}::${dateStr}`, a];
    })
  );

  type SessionStatus = "unclaimed" | "claimed" | "sub_needed";
  const sessions: object[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${yearN}-${String(monthN).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    for (const p of pgPrograms) {
      if (!isOccurrenceOnDate(p, dateStr)) continue;

      const shiftedDate = p.startDatetime
        ? shiftToDate(p.startDatetime.toISOString(), dateStr)
        : null;
      const key = `${p.slug}::${dateStr}`;
      const a = assignmentMap.get(key);

      if (a) {
        const openSub = a.subRequests[0] ?? null;
        const status: SessionStatus = !a.userId
          ? "unclaimed" : openSub ? "sub_needed" : "claimed";
        sessions.push({
          id: a.id,
          programSlug: p.slug, programName: p.name,
          sessionDate: shiftedDate?.toISOString() ?? null,
          status, hostUserId: a.userId ?? null,
          hostName: a.user
            ? (a.user.preferredName || [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || null)
            : null,
          subRequestId: openSub?.id ?? null, subMessage: openSub?.message ?? null,
          programFormat: p.programFormat ?? null, programId: p.id,
          livekitRoom: p.livekitRoom ?? null,
          standingAssignmentId: a.standingAssignmentId ?? null,
          hostBadge: a.userId ? (pauseMap.get(a.userId) ?? null) : null,
        });
      } else {
        sessions.push({
          id: `unassigned::${p.slug}::${dateStr}`,
          programSlug: p.slug, programName: p.name,
          sessionDate: shiftedDate?.toISOString() ?? null,
          status: "unclaimed", hostUserId: null, hostName: null,
          subRequestId: null, subMessage: null,
          programFormat: p.programFormat ?? null, programId: p.id,
          livekitRoom: p.livekitRoom ?? null,
          standingAssignmentId: null,
          hostBadge: null,
        });
      }
    }
  }

  return Response.json(sessions);
}

// POST /api/host/assignments
// Two modes:
//   action: "claim" — any HOST can create+claim a session for themselves.
//                     Creates the HostAssignment and sets userId = current user in one shot.
//   (no action)     — HOST_MANAGER/ADMIN only. Creates unclaimed or assigns to a userId.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!(await hasEffectiveHostAccess(session.user.id, roles))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.programSlug) {
    return Response.json({ error: "programSlug is required" }, { status: 400 });
  }

  const { programSlug, userId, sessionDate, notes, action } = body as {
    programSlug: string;
    userId?: string | null;
    sessionDate?: string | null;
    notes?: string | null;
    action?: "claim";
  };

  // Self-claim: any HOST can create+claim for themselves.
  // Manager operations (create unclaimed, assign to others): manager-only.
  if (action !== "claim" && !isManager(roles)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const assignedUserId = action === "claim" ? session.user.id : (userId ?? null);
  const parsedDate = sessionDate ? new Date(sessionDate) : null;

  // Uniqueness check: one assignment per (programSlug, sessionDate)
  const existing = await db.hostAssignment.findFirst({
    where: { programSlug, sessionDate: parsedDate },
  });
  if (existing) {
    // If a record already exists and action is "claim", just claim it if unclaimed
    if (action === "claim" && !existing.userId) {
      const updated = await db.hostAssignment.update({
        where: { id: existing.id },
        data: { userId: session.user.id, assignedBy: session.user.id },
        include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      });
      after(() => notifyAssignedHost(session.user.id, updated.programSlug, updated.sessionDate));
      return Response.json({
        id: updated.id, programSlug: updated.programSlug,
        sessionDate: updated.sessionDate?.toISOString() ?? null,
        status: "claimed", hostUserId: updated.userId,
        hostName: updated.user
          ? (updated.user.preferredName || [updated.user.firstName, updated.user.lastName].filter(Boolean).join(" ") || null)
          : null,
      });
    }
    return Response.json(
      { error: "A session already exists for this program on that date." },
      { status: 409 }
    );
  }

  // If assigning a specific user (manager only), verify they can host.
  // Hub authority applies: a member whose host-team capability is revoked
  // or who is paused/inactive cannot be assigned, even if the HOST role is present.
  if (assignedUserId && assignedUserId !== session.user.id) {
    const targetUser = await db.user.findUnique({
      where: { id: assignedUserId },
      select: { roles: true },
    });
    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    if (!(await hasEffectiveHostAccess(assignedUserId, targetUser.roles))) {
      return Response.json(
        { error: "This member can't host right now — they are paused, inactive, or have had hosting revoked on the Host Team." },
        { status: 422 }
      );
    }
  }

  const assignment = await db.hostAssignment.create({
    data: {
      programSlug,
      userId: assignedUserId ?? null,
      sessionDate: parsedDate,
      notes: notes ?? null,
      assignedBy: session.user.id,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
  });

  // Confirmation email when someone becomes the host: self-claim AND
  // manager-assigns-to-another-user both flow through here.
  if (assignment.userId) {
    after(() => notifyAssignedHost(assignment.userId!, assignment.programSlug, assignment.sessionDate));
  }

  return Response.json({
    id: assignment.id,
    programSlug: assignment.programSlug,
    sessionDate: assignment.sessionDate?.toISOString() ?? null,
    status: assignment.userId ? "claimed" : "unclaimed",
    hostUserId: assignment.userId ?? null,
    hostName: assignment.user
      ? (assignment.user.preferredName ||
          [assignment.user.firstName, assignment.user.lastName].filter(Boolean).join(" ") ||
          null)
      : null,
  });
}

