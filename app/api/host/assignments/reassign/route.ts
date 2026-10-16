import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { ensureActiveHubMembership } from "@/lib/hubMemberAuth";
import { ctStartOfToday, fmtSessionDay } from "@/lib/timezone";
import {
  sendHostAssignmentConfirmationEmail,
  sendHostAssignmentRemovedEmail,
} from "@/lib/email";
import { getHubCoverageConfig, teamCannotStaff } from "@/lib/programHub";
import { holdRotationDate } from "@/lib/applyStandingAssignments";
import { canManageHubCoverage } from "@/lib/hubAuth";

// Central Time, not the server's UTC (2026-10-15).
const fmtDate = (d: Date | null) => fmtSessionDay(d);

// POST /api/host/assignments/reassign
// A manager (HOST_MANAGER/ADMIN), or a coordinator of the session's hub, can
// reassign — swaps the current assignee (if any) for the requester (the
// coordinator/manager takes the session over themselves). Coordinator parity
// with the assign + unclaim paths: scoped to the session's own hub.
//
// Body: { currentAssignmentId } (programSlug and sessionDate are ignored: the
// assignment's own are used)
//   - If currentAssignmentId is provided, the old HostAssignment is deleted
//     (its open sub-requests are cancelled first). The previously assigned
//     host, if any, is notified.
//   - A fresh HostAssignment is created with userId = current user.
//
// Regular HOST uses the sub-request system for coverage transfers — this
// endpoint is reserved for coordinator/manager overrides.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];

  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Which session?" }, { status: 400 });
  }

  const { currentAssignmentId } = body as {
    programSlug: string;
    sessionDate?: string | null;
    currentAssignmentId?: string | null;
  };


  let previousUserId: string | null = null;
  // Preserve the existing assignment's hub on reassign (session 129) so
  // an AV reassign doesn't accidentally route the new row to host-team.
  // Falls back to the program's primary hub when there's no existing
  // assignment to inherit from.

  // Load the existing assignment first (if any) so the permission check can be
  // scoped to the SESSION's hub.
  // Taking over is always of a real assignment: its own program, date and
  // team are used, never the request's (2026-10-15 audit).
  if (!currentAssignmentId) {
    return Response.json({ error: "Which session?" }, { status: 400 });
  }
  const existing = await db.hostAssignment.findUnique({
    where: { id: currentAssignmentId },
  });
  if (!existing) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }
  previousUserId = existing.userId ?? null;
  if ((await getHubCoverageConfig(existing.hubSlug))?.allowsMultipleAssignments) {
    return Response.json({ error: "This team uses open sign-up." }, { status: 400 });
  }

  // Only a session still ahead, on a team that may still staff the program
  // (2026-10-16 audit).
  if (existing.sessionDate && existing.sessionDate < ctStartOfToday()) {
    return Response.json({ error: "This session has already happened." }, { status: 400 });
  }
  const cannot = await teamCannotStaff(existing.hubSlug, existing.programSlug);
  if (cannot) return Response.json({ error: cannot.message }, { status: 422 });

  // The assignment's own team decides who may take it over.
  const sessionHubSlug = existing.hubSlug;

  if (!(await canManageHubCoverage(session.user.id, roles, sessionHubSlug))) {
    return Response.json(
      { error: "Only coordinators, Host Managers, and Admins can reassign sessions." },
      { status: 403 },
    );
  }

  if (previousUserId === session.user.id) {
    return Response.json(
      { error: "You're already hosting this session." },
      { status: 409 },
    );
  }

  // The person taking over joins the team ("covers ⇒ member").
  await ensureActiveHubMembership(session.user.id, existing.hubSlug);

  // Swap in one transaction (FK-safe order: SubClaim → SubRequest →
  // HostAssignment), so a failure never leaves the session with no one.
  const existingId = existing.id;
  const created = await db.$transaction(async (tx) => {
    await tx.subClaim.deleteMany({ where: { request: { assignmentId: existingId } } });
    await tx.subRequest.deleteMany({ where: { assignmentId: existingId } });
    await tx.hostAssignment.delete({ where: { id: existingId } });
    // A rotation-made session taken over by hand stays out of the rotation,
    // or emptying it later would let the rotation put the old person back.
    await holdRotationDate(existing, session.user.id, tx);
    return tx.hostAssignment.create({
      data: {
        programSlug: existing.programSlug,
        hubSlug: existing.hubSlug,
        userId: session.user.id,
        sessionDate: existing.sessionDate,
        assignedBy: session.user.id,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      },
    });
  });

  // Symmetric host notifications:
  //   - new host (the manager) gets a confirmation email
  //   - previously assigned host, if any, gets a "no longer hosting" email
  // Resolve program name + manager name once, then dispatch both in after().
  const newHostId = session.user.id;
  const displacedId = previousUserId;
  after(async () => {
    try {
      const program = await db.program.findUnique({
        where:  { slug: created.programSlug },
        select: { name: true },
      });
      const programName = program?.name || created.programSlug;
      const dateText = fmtDate(created.sessionDate);
      // Use the created row's hub (session 129) so reassigns in AV /
      // peer-led hubs send their links back to the right scheduler view.
      const hubSlug = created.hubSlug;

      const newHost = await db.user.findUnique({
        where:  { id: newHostId },
        select: { email: true, firstName: true, lastName: true, preferredName: true },
      });

      if (newHost?.email) {
        await sendHostAssignmentConfirmationEmail({
          to: newHost.email,
          firstName: newHost.firstName,
          programName,
          dateText,
          sessionAt: created.sessionDate,
          hubSlug,
        });
      }

      if (displacedId && displacedId !== newHostId) {
        const displaced = await db.user.findUnique({
          where:  { id: displacedId },
          select: { email: true, firstName: true },
        });
        if (displaced?.email) {
          const byName =
            newHost?.preferredName ||
            [newHost?.firstName, newHost?.lastName].filter(Boolean).join(" ") ||
            "A coordinator";
          await sendHostAssignmentRemovedEmail({
            to: displaced.email,
            firstName: displaced.firstName,
            programName,
            dateText,
            sessionAt: created.sessionDate,
            byName,
            hubSlug,
          });
        }
      }
    } catch (e) {
      console.error("[host-assignment reassign] notification error:", e);
    }
  });

  return Response.json({
    id: created.id,
    programSlug: created.programSlug,
    sessionDate: created.sessionDate?.toISOString() ?? null,
    status: "claimed",
    hostUserId: created.userId,
    hostName: created.user
      ? (created.user.preferredName ||
          [created.user.firstName, created.user.lastName].filter(Boolean).join(" ") ||
          null)
      : null,
  });
}

