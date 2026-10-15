import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { authorizeSelfClaim, getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { canAccessHubScheduler, canManageHubCoverage } from "@/lib/hubAuth";
import { sendHostAssignmentConfirmationEmail } from "@/lib/email";
import { fmtSessionDay } from "@/lib/timezone";
import {
  DEFAULT_HOSTING_HUB_SLUG,
  getProgramHubSlug,
  getHubCoverageConfig,
  teamCannotStaff,
} from "@/lib/programHub";
import { buildHubMonthSessions } from "@/lib/scheduleSessions";

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
    return Response.json({ error: "Forbidden" }, { status: 403 });
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
    return Response.json({ error: "Forbidden" }, { status: 403 });
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
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!(await canManageHubCoverage(session.user.id, roles, targetHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const assignedUserId = placingSelf ? session.user.id : (userId ?? null);
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

  // If assigning a specific person (coordinator/manager path), verify they
  // can host in the target hub BEFORE touching any row — applies whether we
  // claim an existing unclaimed seed or create a fresh assignment. Hub
  // authority applies: a member who is paused/inactive or has had hosting
  // revoked on this hub can't be assigned, even with the HOST role.
  if (assignedUserId && assignedUserId !== session.user.id) {
    const targetUser = await db.user.findUnique({
      where: { id: assignedUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    // Assigning someone requires them to be an active, hosting-capable MEMBER
    // of this hub — no role fallback (session 146). The picker only offers
    // roster members, so this is the server-side guard that keeps a coordinator
    // (or a crafted request) from placing a non-member onto a session and
    // creating a "covers but not on the team" orphan.
    if (!(await getEffectiveHostingCapability(assignedUserId, targetHubSlug, false))) {
      return Response.json(
        { error: "This member can't be assigned here — they're not on this team, or they're paused, inactive, or have had hosting revoked on this hub." },
        { status: 422 }
      );
    }
  }

  // Single-slot path. Look up any existing row in this hub for the session;
  // claim/assign its unclaimed seed, or reject as already filled.
  const existing = await db.hostAssignment.findFirst({
    where: { programSlug, sessionDate: parsedDate, hubSlug: targetHubSlug },
  });
  if (existing) {
    // Self-claim an unclaimed seed.
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
    // Coordinator/manager assigns a specific person to an unclaimed seed.
    // (Capability already verified above.) Without this branch, assigning
    // someone to an existing-but-empty slot returned a confusing 409
    // "session already exists" — the kind of dead-end that erodes trust
    // (session 140).
    if (action !== "claim" && !existing.userId && assignedUserId) {
      const updated = await db.hostAssignment.update({
        where: { id: existing.id },
        data: { userId: assignedUserId, assignedBy: session.user.id },
        include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      });
      after(() => notifyAssignedHost(assignedUserId, updated.programSlug, updated.sessionDate, updated.hubSlug));
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

