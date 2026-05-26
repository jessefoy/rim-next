import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { sendHostAssignmentConfirmationEmail } from "@/lib/email";
import {
  DEFAULT_HOSTING_HUB_SLUG,
  getProgramHubSlug,
  getHubCoverageConfig,
  getProgramSlugsForHub,
} from "@/lib/programHub";

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
 * The `hubSlug` argument is the assignment's hub (session 129) so the
 * email link lands the recipient in the right Scheduler view — an AV
 * volunteer's confirmation points at /tools/schedule?hub=audio-visual.
 * Wrapped in after() by the caller — this helper assumes it's running
 * in deferred work.
 */
async function notifyAssignedHost(
  assignedUserId: string,
  programSlug: string,
  sessionDate: Date | null,
  hubSlug: string,
): Promise<void> {
  try {
    const [program, assignee] = await Promise.all([
      db.program.findUnique({
        where: { slug: programSlug },
        select: { name: true },
      }),
      db.user.findUnique({ where: { id: assignedUserId }, select: { email: true, firstName: true } }),
    ]);
    if (!assignee?.email) return;
    await sendHostAssignmentConfirmationEmail({
      to: assignee.email,
      firstName: assignee.firstName,
      programName: program?.name || programSlug,
      dateText: formatSessionDate(sessionDate),
      hubSlug,
    });
  } catch (e) {
    console.error("[host-assignment] confirmation email error:", e);
  }
}

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

/**
 * Capability gate. For the program-aware POST handler, callers pass the
 * program's hosting hub slug. GET handlers (which surface schedules across
 * potentially many programs) keep the legacy host-team gate for Slice 1 —
 * broadening the schedule UI to surface multiple hubs is a Slice 2 follow-on.
 */
async function hasEffectiveHostAccess(
  userId: string,
  roles: string[],
  hubSlug: string = DEFAULT_HOSTING_HUB_SLUG,
): Promise<boolean> {
  if (roles.includes("ADMIN")) return true;
  const tentative = roles.includes("HOST") || roles.includes("HOST_MANAGER");
  return getEffectiveHostingCapability(userId, hubSlug, tentative);
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

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // e.g. "2026-03"
  // ?hub= scopes the query to one hub's view. Defaults to host-team for
  // backward-compat with the legacy callers. Session 129.
  const requestedHubSlug = searchParams.get("hub") || DEFAULT_HOSTING_HUB_SLUG;

  if (!(await hasEffectiveHostAccess(session.user.id, roles, requestedHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!monthParam) {
    // No month param — return raw assignments scoped to this hub
    // (backward compat for any direct callers).
    const assignments = await db.hostAssignment.findMany({
      where: { hubSlug: requestedHubSlug },
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
          hubSlug: a.hubSlug,
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

  // Hub-scoped program filter: primary + auxiliary coverage, then the
  // hub's appliesToFormats. Session 129. The page does the same filter
  // for SSR; this branch handles client-side month nav.
  const hubConfig = await getHubCoverageConfig(requestedHubSlug);
  const appliesToFormats = hubConfig?.appliesToFormats ?? ["virtual", "hybrid"];
  const allowsMultipleAssignments = hubConfig?.allowsMultipleAssignments ?? false;
  const eligibleSlugs = await getProgramSlugsForHub(requestedHubSlug);

  const [pgPrograms, assignments] = await Promise.all([
    db.program.findMany({
      where: {
        programFormat: { in: appliesToFormats },
        archivedAt: null,
        slug: { in: eligibleSlugs },
      },
      select: {
        id: true, name: true, slug: true,
        programFormat: true, startDatetime: true, endDatetime: true,
        recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true,
        livekitRoom: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.hostAssignment.findMany({
      where: {
        sessionDate: { gte: startOfMonth, lte: endOfMonth },
        hubSlug: requestedHubSlug,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        subRequests: { where: { status: "OPEN" }, select: { id: true, message: true }, take: 1 },
      },
      orderBy: { sessionDate: "asc" },
    }),
  ]);

  // Pause-state map for the active hub.
  const assignedUserIds = [...new Set(assignments.map((a) => a.userId).filter(Boolean))] as string[];
  const pauseMap = new Map<string, "paused" | "inactive">();
  if (assignedUserIds.length > 0) {
    const activeHub = await db.hub.findUnique({ where: { slug: requestedHubSlug }, select: { id: true } });
    if (activeHub) {
      const hubMembers = await db.hubMember.findMany({
        where: { hubId: activeHub.id, userId: { in: assignedUserIds } },
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

  // Group assignments by (programSlug, dateStr) for multi-claim support.
  type AssignmentRow = typeof assignments[number];
  const assignmentsByKey = new Map<string, AssignmentRow[]>();
  for (const a of assignments) {
    const dateStr = a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : "";
    const key = `${a.programSlug}::${dateStr}`;
    const bucket = assignmentsByKey.get(key);
    if (bucket) bucket.push(a);
    else assignmentsByKey.set(key, [a]);
  }

  type SessionStatus = "unclaimed" | "claimed" | "sub_needed";
  const sessions: object[] = [];

  function nameOf(u: { firstName: string | null; lastName: string | null; preferredName: string | null } | null): string | null {
    if (!u) return null;
    return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${yearN}-${String(monthN).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    for (const p of pgPrograms) {
      if (!isOccurrenceOnDate(p, dateStr)) continue;

      const shiftedDate = p.startDatetime
        ? shiftToDate(p.startDatetime.toISOString(), dateStr)
        : null;
      const key = `${p.slug}::${dateStr}`;
      const bucket = assignmentsByKey.get(key);

      if (!bucket || bucket.length === 0) {
        sessions.push({
          id: `unassigned::${p.slug}::${dateStr}`,
          programSlug: p.slug, programName: p.name,
          sessionDate: shiftedDate?.toISOString() ?? null,
          status: "unclaimed", hostUserId: null, hostName: null,
          claimants: [],
          subRequestId: null, subMessage: null,
          programFormat: p.programFormat ?? null, programId: p.id,
          livekitRoom: p.livekitRoom ?? null,
          standingAssignmentId: null,
          hostBadge: null,
        });
        continue;
      }

      if (allowsMultipleAssignments) {
        const claimants = bucket.map((a) => ({
          assignmentId: a.id,
          userId: a.userId ?? null,
          userName: nameOf(a.user),
          badge: a.userId ? (pauseMap.get(a.userId) ?? null) : null,
        }));
        const first = bucket[0];
        sessions.push({
          id: `multi::${p.slug}::${dateStr}`,
          programSlug: p.slug, programName: p.name,
          sessionDate: shiftedDate?.toISOString() ?? null,
          status: "claimed", hostUserId: null, hostName: null,
          claimants,
          subRequestId: null, subMessage: null,
          programFormat: p.programFormat ?? null, programId: p.id,
          livekitRoom: p.livekitRoom ?? null,
          standingAssignmentId: first?.standingAssignmentId ?? null,
          hostBadge: null,
        });
        continue;
      }

      const a = bucket[0];
      const openSub = a.subRequests[0] ?? null;
      const status: SessionStatus = !a.userId
        ? "unclaimed" : openSub ? "sub_needed" : "claimed";
      sessions.push({
        id: a.id,
        programSlug: p.slug, programName: p.name,
        sessionDate: shiftedDate?.toISOString() ?? null,
        status, hostUserId: a.userId ?? null,
        hostName: nameOf(a.user),
        claimants: [],
        subRequestId: openSub?.id ?? null, subMessage: openSub?.message ?? null,
        programFormat: p.programFormat ?? null, programId: p.id,
        livekitRoom: p.livekitRoom ?? null,
        standingAssignmentId: a.standingAssignmentId ?? null,
        hostBadge: a.userId ? (pauseMap.get(a.userId) ?? null) : null,
      });
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

  const body = await request.json().catch(() => null);
  if (!body?.programSlug) {
    return Response.json({ error: "programSlug is required" }, { status: 400 });
  }

  const { programSlug, userId, sessionDate, notes, action, hubSlug: bodyHubSlug } = body as {
    programSlug: string;
    userId?: string | null;
    sessionDate?: string | null;
    notes?: string | null;
    action?: "claim";
    /** Hub the assignment lands in. Defaults to the program's primary
     *  hosting hub for backward compat; auxiliary callers (AV /
     *  greeter views) pass their own slug. Session 129. */
    hubSlug?: string | null;
  };

  // Resolve the target hub. Body wins; otherwise fall through to the
  // program's primary hosting hub.
  const programHubSlug = await getProgramHubSlug(programSlug);
  const targetHubSlug = bodyHubSlug || programHubSlug;

  // Capability gate routes by the resolved hub. A peer-leader can
  // self-claim a peer-led silent sit; a host-team volunteer can self-claim
  // host-team programs; a greeter signs themselves up in the greeter hub.
  // Manager operations (create-unclaimed, assign-to-others) still require
  // the system-role manager check.
  const roles = session.user.roles ?? [];
  if (!(await hasEffectiveHostAccess(session.user.id, roles, targetHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Self-claim: any active hub-team member can create+claim for themselves.
  // Manager operations (create unclaimed, assign to others): manager-only.
  if (action !== "claim" && !isManager(roles)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const assignedUserId = action === "claim" ? session.user.id : (userId ?? null);
  const parsedDate = sessionDate ? new Date(sessionDate) : null;

  // Hub-coverage config decides whether (programSlug, sessionDate, hubSlug)
  // is single-slot or multi-claim. Single-slot (host-team / AV / peer-led):
  // one claimed row per session; the existing "claim the unclaimed seed"
  // pattern stays. Multi-claim (greeter): each sign-up is a fresh insert;
  // dedupe is per (slug, date, hub, userId).
  const hubConfig = await getHubCoverageConfig(targetHubSlug);
  const multiClaim = hubConfig?.allowsMultipleAssignments ?? false;

  if (multiClaim) {
    if (action !== "claim" || !assignedUserId) {
      return Response.json(
        { error: "This hub uses open sign-up — only the self-claim action is supported." },
        { status: 400 },
      );
    }
    // Already signed up?
    const dup = await db.hostAssignment.findFirst({
      where: {
        programSlug, sessionDate: parsedDate, hubSlug: targetHubSlug, userId: assignedUserId,
      },
      select: { id: true },
    });
    if (dup) {
      return Response.json({ error: "You're already signed up." }, { status: 409 });
    }
    const created = await db.hostAssignment.create({
      data: {
        programSlug,
        hubSlug: targetHubSlug,
        userId: assignedUserId,
        sessionDate: parsedDate,
        notes: notes ?? null,
        assignedBy: session.user.id,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      },
    });
    after(() => notifyAssignedHost(assignedUserId, created.programSlug, created.sessionDate, created.hubSlug));
    return Response.json({
      id: created.id,
      programSlug: created.programSlug,
      sessionDate: created.sessionDate?.toISOString() ?? null,
      hubSlug: created.hubSlug,
      status: "claimed",
      hostUserId: created.userId,
      hostName: created.user
        ? (created.user.preferredName || [created.user.firstName, created.user.lastName].filter(Boolean).join(" ") || null)
        : null,
    });
  }

  // Single-slot path. Look up any existing row in this hub for the
  // session; either claim its unclaimed seed or reject as already filled.
  const existing = await db.hostAssignment.findFirst({
    where: { programSlug, sessionDate: parsedDate, hubSlug: targetHubSlug },
  });
  if (existing) {
    if (action === "claim" && !existing.userId) {
      const updated = await db.hostAssignment.update({
        where: { id: existing.id },
        data: { userId: session.user.id, assignedBy: session.user.id },
        include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      });
      after(() => notifyAssignedHost(session.user.id, updated.programSlug, updated.sessionDate, updated.hubSlug));
      return Response.json({
        id: updated.id, programSlug: updated.programSlug,
        sessionDate: updated.sessionDate?.toISOString() ?? null,
        hubSlug: updated.hubSlug,
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

  // If assigning a specific user (manager only), verify they can host in
  // the target hub. Hub authority applies: a member whose capability is
  // revoked or who is paused/inactive in the target hub cannot be assigned,
  // even if the HOST role is present.
  if (assignedUserId && assignedUserId !== session.user.id) {
    const targetUser = await db.user.findUnique({
      where: { id: assignedUserId },
      select: { roles: true },
    });
    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    if (!(await hasEffectiveHostAccess(assignedUserId, targetUser.roles, targetHubSlug))) {
      return Response.json(
        { error: "This member can't host right now — they are paused, inactive, or have had hosting revoked on this hub." },
        { status: 422 }
      );
    }
  }

  const assignment = await db.hostAssignment.create({
    data: {
      programSlug,
      hubSlug: targetHubSlug,
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
    after(() => notifyAssignedHost(assignment.userId!, assignment.programSlug, assignment.sessionDate, assignment.hubSlug));
  }

  return Response.json({
    id: assignment.id,
    programSlug: assignment.programSlug,
    sessionDate: assignment.sessionDate?.toISOString() ?? null,
    hubSlug: assignment.hubSlug,
    status: assignment.userId ? "claimed" : "unclaimed",
    hostUserId: assignment.userId ?? null,
    hostName: assignment.user
      ? (assignment.user.preferredName ||
          [assignment.user.firstName, assignment.user.lastName].filter(Boolean).join(" ") ||
          null)
      : null,
  });
}

