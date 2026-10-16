import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { authorizeSelfClaim, getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { canAccessHubScheduler, canManageHubCoverage } from "@/lib/hubAuth";
import { sendHostAssignmentConfirmationEmail } from "@/lib/email";
import { ctDayBounds, fmtSessionDay } from "@/lib/timezone";
import {
  DEFAULT_HOSTING_HUB_SLUG,
  getProgramHubSlug,
  getHubCoverageConfig,
  teamCannotStaff,
} from "@/lib/programHub";
import { buildHubMonthSessions } from "@/lib/scheduleSessions";
import { ctDateStr, isOccurrenceOnDate, shiftToDate } from "@/lib/scheduleUtils";

/**
 * Format a session date for use in host emails.
 * Matches the format used in sub-claim ("Thu, May 22") and standing-assignment
 * emails so all host notifications speak the same dialect.
 */
function formatSessionDate(date: Date | null): string | null {
  // Central Time, not the server's UTC (2026-10-15).
  return fmtSessionDay(date);
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
      sessionAt: sessionDate,
      hubSlug,
    });
  } catch (e) {
    console.error("[host-assignment] confirmation email error:", e);
  }
}

// Occurrence + date helpers (ctDateStr, isOccurrenceOnDate, shiftToDate) come
// from the shared lib/scheduleUtils.ts — the single source of truth. Do NOT
// reintroduce a private copy here: this route's old copy lacked the session-137
// endDatetime / DAILY rules and drifted from /tools/schedule + /this-week.

// GET /api/host/assignments?month=YYYY-MM&hub=<slug>
// One team's month (lib/scheduleSessions.ts): every occurrence of the
// programs it staffs, with its assignments. HubScheduleClient's month
// navigation. The month is required (the old no-month listing had no callers
// and was removed, 2026-10-15).
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

  // Per-hub gate (session 146): you can only view a hub's Scheduler if you're
  // a member of that hub OR hold an oversight role (HOST_MANAGER / ADMIN / GT).
  // Tighter than the prior capability check, which let any HOST role-holder
  // read every hub's board regardless of membership.
  if (!(await canAccessHubScheduler(session.user.id, roles, requestedHubSlug))) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  const match = monthParam ? /^(\d{4})-(\d{2})$/.exec(monthParam) : null;
  const monthN = match ? Number(match[2]) : 0;
  if (!match || monthN < 1 || monthN > 12) {
    return Response.json({ error: "Which month? (YYYY-MM)" }, { status: 400 });
  }

  // The same builder the page uses (lib/scheduleSessions.ts), so the first
  // month and every month after it are built by one rule.
  const { sessions } = await buildHubMonthSessions(requestedHubSlug, Number(match[1]), monthN - 1);
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
  // The body-less fallback to the program's primary hub is backward-compat for
  // legacy callers only (RIM_Hub_Engineering.md). New client code must pass
  // hubSlug; warn loudly so a missing-hubSlug write to the wrong hub is
  // discoverable instead of silent (session 146 fallback hardening).
  if (!bodyHubSlug) {
    console.warn(
      `[assignments] POST without hubSlug — falling back to program primary "${programHubSlug}" for ${programSlug}. New callers must send hubSlug.`,
    );
  }

  // Capability gate routes by the resolved hub. A peer-leader can
  // self-claim a peer-led silent sit; a host-team volunteer can self-claim
  // host-team programs; a greeter signs themselves up in the greeter hub.
  // Manager operations (create-unclaimed, assign-to-others) still require
  // the system-role manager check.
  const roles = session.user.roles ?? [];
  // Per-hub access gate THEN capability (session 146). Access = member of this
  // hub or an oversight role; capability = ACTIVE + hostingCapability (role
  // fallback only for oversight). A plain HOST can no longer claim in a hub
  // they don't belong to — that was a source of "covers but not a member"
  // orphan assignments.
  if (!(await canAccessHubScheduler(session.user.id, roles, targetHubSlug))) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  // The team must be one that staffs this program (2026-10-15: this was
  // checked only where the schedule is shown, so a crafted request could add
  // an assignment on any team, for any program or format). Includes "No host
  // needed" on the hosting team.
  const cannot = await teamCannotStaff(targetHubSlug, programSlug);
  if (cannot) return Response.json({ error: cannot.message }, { status: 422 });

  // Placing yourself is a self-claim, with or without the "claim" action, and
  // passes the one self-claim rule (access, coverage allowed, enrollment).
  // Placing someone else, or leaving a seat empty, is coverage management.
  const placingSelf = action === "claim" || userId === session.user.id;
  if (placingSelf) {
    if (!(await authorizeSelfClaim(session.user.id, roles, targetHubSlug))) {
      return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
    }
  } else if (!(await canManageHubCoverage(session.user.id, roles, targetHubSlug))) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  const assignedUserId = placingSelf ? session.user.id : (userId ?? null);

  // The session: a day the program meets, stored at the program's own start
  // and matched by its Central day (2026-10-16 audit: the client's timestamp
  // was stored as sent and matched exactly, so any drift split one session
  // into two rows).
  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: {
      id: true, name: true, slug: true, programFormat: true, startDatetime: true, endDatetime: true,
      recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true,
    },
  });
  const requested = sessionDate ? new Date(sessionDate) : null;
  if (!program?.startDatetime || !requested || Number.isNaN(requested.getTime())) {
    return Response.json({ error: "Which session?" }, { status: 400 });
  }
  const dayStr = ctDateStr(requested.toISOString());
  if (!isOccurrenceOnDate(program, dayStr)) {
    return Response.json({ error: "This program doesn't meet that day." }, { status: 422 });
  }
  const parsedDate = shiftToDate(program.startDatetime.toISOString(), dayStr);
  const day = ctDayBounds(parsedDate);
  const thisSession = { programSlug, hubSlug: targetHubSlug, sessionDate: { gte: day.start, lte: day.end } };

  // Hub-coverage config decides whether (programSlug, sessionDate, hubSlug)
  // is single-slot or multi-claim. Single-slot (host-team / AV / peer-led):
  // one claimed row per session; the existing "claim the unclaimed seed"
  // pattern stays. Multi-claim (greeter): each sign-up is a fresh insert;
  // dedupe is per (slug, date, hub, userId).
  const hubConfig = await getHubCoverageConfig(targetHubSlug);
  const multiClaim = hubConfig?.allowsMultipleAssignments ?? false;

  if (multiClaim && (action !== "claim" || !assignedUserId)) {
    return Response.json(
      { error: "This hub uses open sign-up — only the self-claim action is supported." },
      { status: 400 },
    );
  }

  // If assigning a specific person (coordinator/manager path), verify they
  // can host in the target hub BEFORE touching any row. Assigning someone
  // requires them to be an active, hosting-capable MEMBER of this hub, no
  // role fallback (session 146): the server-side guard that keeps a
  // coordinator (or a crafted request) from placing a non-member.
  if (assignedUserId && assignedUserId !== session.user.id) {
    if (!(await getEffectiveHostingCapability(assignedUserId, targetHubSlug, false))) {
      return Response.json(
        { error: "This person can't be scheduled here: they're not on this team, or they're paused or off the schedule." },
        { status: 422 },
      );
    }
  }

  // Check and write under a lock on this session (program, Central day,
  // team), so two people taking the same open seat at once can't both win.
  type Outcome =
    | { kind: "error"; status: number; error: string }
    | { kind: "ok"; row: Awaited<ReturnType<typeof db.hostAssignment.create>> & { user: { id: string; firstName: string | null; lastName: string | null; preferredName: string | null } | null } };
  const userSelect = { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } };
  const outcome: Outcome = await db.$transaction(async (tx) => {
    await tx.$queryRawUnsafe("SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))", `seat:${programSlug}:${dayStr}:${targetHubSlug}`);

    if (multiClaim) {
      const dup = await tx.hostAssignment.findFirst({ where: { ...thisSession, userId: assignedUserId }, select: { id: true } });
      if (dup) return { kind: "error", status: 409, error: "You're already signed up." };
      const row = await tx.hostAssignment.create({
        data: { programSlug, hubSlug: targetHubSlug, userId: assignedUserId, sessionDate: parsedDate, notes: notes ?? null, assignedBy: session.user.id },
        include: userSelect,
      });
      return { kind: "ok", row };
    }

    // Single seat: fill an empty row for this session, or refuse if filled.
    const existing = await tx.hostAssignment.findFirst({ where: thisSession, orderBy: { createdAt: "asc" } });
    if (existing) {
      if (existing.userId) {
        return { kind: "error", status: 409, error: existing.userId === session.user.id ? "This session is already yours." : "Someone already has this session." };
      }
      if (!assignedUserId) {
        return { kind: "error", status: 409, error: "This session is already on the schedule." };
      }
      const row = await tx.hostAssignment.update({
        where: { id: existing.id },
        data: { userId: assignedUserId, assignedBy: session.user.id },
        include: userSelect,
      });
      return { kind: "ok", row };
    }
    const row = await tx.hostAssignment.create({
      data: { programSlug, hubSlug: targetHubSlug, userId: assignedUserId ?? null, sessionDate: parsedDate, notes: notes ?? null, assignedBy: session.user.id },
      include: userSelect,
    });
    return { kind: "ok", row };
  });
  if (outcome.kind === "error") return Response.json({ error: outcome.error }, { status: outcome.status });
  const assignment = outcome.row;

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

