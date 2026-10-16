import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { sendHostAssignmentConfirmationEmail, sendHostAssignmentRemovedEmail } from "@/lib/email";
import { DEFAULT_HOSTING_HUB_SLUG, getHubCoverageConfig, getProgramHubSlug, programNeedsHost } from "@/lib/programHub";
import { canManageHubCoverage } from "@/lib/hubAuth";
import { authorizeSelfClaim } from "@/lib/hubMemberAuth";
import { fmtSessionDay } from "@/lib/timezone";
import { holdRotationDate } from "@/lib/applyStandingAssignments";
import { deliverGapNotices, gapNoticeReachesTeam, prepareGapNotices } from "@/lib/coverageNotices";

// Central Time, not the server's UTC (2026-10-15).
const fmtDate = (d: Date | null) => fmtSessionDay(d);

// PATCH /api/host/assignments/[id]
// Body: { action: "claim" | "unclaim" }
// claim:   anyone who may claim on this assignment's team (authorizeSelfClaim:
//          member or oversight, hosting allowed, enrolled) takes an open seat
// unclaim: owner, a manager, OR a coordinator of the assignment's hub can
//          unclaim — sets userId=null, cancels open sub requests, and notifies
//          the removed host when someone else takes them off.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action as "claim" | "unclaim" | undefined;

  if (!action || !["claim", "unclaim"].includes(action)) {
    return Response.json({ error: "action must be 'claim' or 'unclaim'" }, { status: 400 });
  }

  const assignment = await db.hostAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Authorize per action AFTER loading the assignment, so the gate can be scoped
  // to the assignment's own hub. (A pre-loaded system-role-only gate here used
  // to shadow the coordinator check below — it 403'd a non-HOST-role hub
  // coordinator on unclaim while DELETE/reassign let them through.)
  if (action === "claim") {
    // Open sign-up teams add a fresh row per person (POST); there is no seat
    // to take. A primary-team seat on a "No host needed" program can't be
    // taken. Both refused before the claim rule, which enrolls on success.
    if ((await getHubCoverageConfig(assignment.hubSlug))?.allowsMultipleAssignments) {
      return Response.json({ error: "This team uses open sign-up." }, { status: 400 });
    }
    if (
      assignment.hubSlug === (await getProgramHubSlug(assignment.programSlug)) &&
      !(await programNeedsHost(assignment.programSlug))
    ) {
      return Response.json({ error: 'This program is marked "No host needed".' }, { status: 422 });
    }
    // Claiming an open seat: the same rule as every self-claim, against the
    // assignment's own team. (It checked the retired HOST role, so ordinary
    // volunteers got 403 retaking a session a coordinator had removed.)
    if (assignment.userId) {
      return Response.json({ error: "This session is already claimed." }, { status: 409 });
    }
    if (!(await authorizeSelfClaim(session.user.id, roles, assignment.hubSlug))) {
      return Response.json({ error: "You can't take sessions on this team's schedule right now." }, { status: 403 });
    }
    // Only if it's still empty: two people claiming at once can't both win,
    // and the second can't overwrite the first (2026-10-16 audit).
    const taken = await db.hostAssignment.updateMany({
      where: { id, userId: null },
      data: { userId: session.user.id, assignedBy: session.user.id },
    });
    if (taken.count === 0) {
      return Response.json({ error: "Someone just took this session." }, { status: 409 });
    }
    // Confirmation email to the claimer. The email link is scoped to
    // the assignment's hub (session 129) so an AV claim lands the
    // recipient at /tools/schedule?hub=audio-visual, not host-team.
    after(async () => {
      try {
        const [program, claimer] = await Promise.all([
          db.program.findUnique({
            where: { slug: assignment.programSlug },
            select: { name: true },
          }),
          db.user.findUnique({ where: { id: session.user.id }, select: { email: true, firstName: true } }),
        ]);
        if (claimer?.email) {
          await sendHostAssignmentConfirmationEmail({
            to: claimer.email,
            firstName: claimer.firstName,
            programName: program?.name || assignment.programSlug,
            dateText: fmtDate(assignment.sessionDate),
            sessionAt: assignment.sessionDate,
            hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG,
          });
        }
      } catch (e) {
        console.error("[host-assignment claim] confirmation email error:", e);
      }
    });
    return Response.json({ ok: true, status: "claimed" });
  }

  // Open sign-up teams leave by removing the sign-up (DELETE), never by
  // emptying it: an empty row would read as a blank name (2026-10-16 audit).
  if ((await getHubCoverageConfig(assignment.hubSlug))?.allowsMultipleAssignments) {
    return Response.json({ error: "Cancel the sign-up instead." }, { status: 400 });
  }

  // unclaim — owner removes themselves, OR a manager/hub-coordinator removes
  // anyone in their hub. Coordinator parity with the assign path (session 140):
  // a coordinator who can put someone on a session can take them off it. Scoped
  // to THIS assignment's hub so a coordinator only manages their own team.
  const isOwn = assignment.userId === session.user.id;
  const canManage = await canManageHubCoverage(session.user.id, roles, assignment.hubSlug);
  if (!canManage && !isOwn) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  const removedUserId = assignment.userId;

  // Cancel open sub requests, empty the seat, and hold a rotation date open,
  // together: a half-done release would leave the seat empty and unreported.
  await db.$transaction(async (tx) => {
    await tx.subRequest.updateMany({
      where: { assignmentId: id, status: "OPEN" },
      data: { status: "CANCELLED" },
    });
    await tx.hostAssignment.update({
      where: { id },
      data: { userId: null },
    });
    await holdRotationDate(assignment, session.user.id, tx);
  });

  // The seat is empty: if the session is within two weeks, the team hears
  // (2026-10-16 ruling), never the person who did it or the person removed.
  // Only when someone was on it: an already-empty seat lost no one.
  const gaps = removedUserId
    ? await prepareGapNotices(
        [{ hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG, programSlug: assignment.programSlug, sessionDate: assignment.sessionDate }],
        [session.user.id, removedUserId],
      )
    : [];
  if (gaps.length) after(() => deliverGapNotices(gaps));

  // Courtesy notification: when a coordinator/manager removes SOMEONE ELSE, tell
  // that host — they were emailed when assigned, so a silent removal would leave
  // a stale "you're hosting" note. Self-unclaim is silent (they did it). The
  // template send is pre-threshold-gated, so staged accounts get nothing.
  if (removedUserId && removedUserId !== session.user.id) {
    after(async () => {
      try {
        const [program, removed, remover] = await Promise.all([
          db.program.findUnique({ where: { slug: assignment.programSlug }, select: { name: true } }),
          db.user.findUnique({ where: { id: removedUserId }, select: { email: true, firstName: true } }),
          db.user.findUnique({ where: { id: session.user.id }, select: { firstName: true, lastName: true, preferredName: true } }),
        ]);
        if (removed?.email) {
          const byName =
            remover?.preferredName ||
            [remover?.firstName, remover?.lastName].filter(Boolean).join(" ") ||
            "A coordinator";
          await sendHostAssignmentRemovedEmail({
            to: removed.email,
            firstName: removed.firstName,
            programName: program?.name || assignment.programSlug,
            dateText: fmtDate(assignment.sessionDate),
            sessionAt: assignment.sessionDate,
            byName,
            hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG,
          });
        }
      } catch (e) {
        console.error("[host-assignment unclaim] removal email error:", e);
      }
    });
  }

  return Response.json({ ok: true, status: "unclaimed", teamTold: gapNoticeReachesTeam(gaps) });
}

// DELETE /api/host/assignments/[id]
// A manager, or a coordinator of the assignment's hub, can delete any
// assignment in that hub. A HOST can delete their own assignment.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const assignment = await db.hostAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const roles = session.user.roles ?? [];
  const canManage = await canManageHubCoverage(session.user.id, roles, assignment.hubSlug);
  const isOwn = assignment.userId !== null && assignment.userId === session.user.id;

  if (!canManage && !isOwn) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  const removedUserId = assignment.userId;

  // Atomic cascade-delete. SubRequest.assignmentId FK is Restrict — a
  // bare hostAssignment.delete would FK-violate the moment any historic
  // SubRequest (CLAIMED, CANCELLED) referenced this row. SubClaim cascades
  // on SubRequest delete but we delete explicitly for clarity. Pattern
  // matches /api/host/assignments/clear (session 130 follow-up — this
  // route had the same FK gap that surfaced as HTTP 500 elsewhere).
  await db.$transaction(async (tx) => {
    await tx.subClaim.deleteMany({
      where: { request: { assignmentId: id } },
    });
    await tx.subRequest.deleteMany({
      where: { assignmentId: id },
    });
    await tx.hostAssignment.delete({ where: { id } });
    await holdRotationDate(assignment, session.user.id, tx);
  });

  // If that was the session's last person on this team and it's within two
  // weeks, the team hears (2026-10-16: a greeter's cancel was silent).
  const gaps = removedUserId
    ? await prepareGapNotices(
        [{ hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG, programSlug: assignment.programSlug, sessionDate: assignment.sessionDate }],
        [session.user.id, removedUserId],
      )
    : [];
  if (gaps.length) after(() => deliverGapNotices(gaps));

  // Courtesy notification, mirroring the PATCH-unclaim path above: when a
  // coordinator/manager removes SOMEONE ELSE, tell that person — they were
  // emailed when they signed up, so a silent removal leaves a stale note.
  // Self-removal (greeter "Cancel my signup") is silent — `removedUserId
  // === self` — which is exactly the distinguisher between the two callers
  // that share this DELETE route. The template is pre-threshold-gated, so
  // staged accounts get nothing.
  if (removedUserId && removedUserId !== session.user.id) {
    after(async () => {
      try {
        const [program, removed, remover] = await Promise.all([
          db.program.findUnique({ where: { slug: assignment.programSlug }, select: { name: true } }),
          db.user.findUnique({ where: { id: removedUserId }, select: { email: true, firstName: true } }),
          db.user.findUnique({ where: { id: session.user.id }, select: { firstName: true, lastName: true, preferredName: true } }),
        ]);
        if (removed?.email) {
          const byName =
            remover?.preferredName ||
            [remover?.firstName, remover?.lastName].filter(Boolean).join(" ") ||
            "A coordinator";
          await sendHostAssignmentRemovedEmail({
            to: removed.email,
            firstName: removed.firstName,
            programName: program?.name || assignment.programSlug,
            dateText: fmtDate(assignment.sessionDate),
            sessionAt: assignment.sessionDate,
            byName,
            hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG,
          });
        }
      } catch (e) {
        console.error("[host-assignment delete] removal email error:", e);
      }
    });
  }

  return Response.json({ ok: true, teamTold: gapNoticeReachesTeam(gaps) });
}
