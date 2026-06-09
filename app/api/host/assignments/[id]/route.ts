import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { sendHostAssignmentConfirmationEmail, sendHostAssignmentRemovedEmail } from "@/lib/email";
import { DEFAULT_HOSTING_HUB_SLUG } from "@/lib/programHub";
import { isHubCoordinator } from "@/lib/hubAuth";

function fmtDate(d: Date | null): string | null {
  return d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : null;
}

function hasHubAccess(roles: string[]) {
  return roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
}
function isManagerRole(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// PATCH /api/host/assignments/[id]
// Body: { action: "claim" | "unclaim" }
// claim:   HOST/HOST_MANAGER/ADMIN can claim an unclaimed session
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
    // Claiming an open session: hub-team system role OR coordinator of this hub.
    if (!hasHubAccess(roles) && !(await isHubCoordinator(session.user.id, assignment.hubSlug))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (assignment.userId) {
      return Response.json(
        { error: "This session is already claimed." },
        { status: 409 }
      );
    }
    await db.hostAssignment.update({
      where: { id },
      data: { userId: session.user.id, assignedBy: session.user.id },
    });
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
            hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG,
          });
        }
      } catch (e) {
        console.error("[host-assignment claim] confirmation email error:", e);
      }
    });
    return Response.json({ ok: true, status: "claimed" });
  }

  // unclaim — owner removes themselves, OR a manager/hub-coordinator removes
  // anyone in their hub. Coordinator parity with the assign path (session 140):
  // a coordinator who can put someone on a session can take them off it. Scoped
  // to THIS assignment's hub so a coordinator only manages their own team.
  const isOwn = assignment.userId === session.user.id;
  const canManage =
    isManagerRole(roles) ||
    (await isHubCoordinator(session.user.id, assignment.hubSlug));
  if (!canManage && !isOwn) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const removedUserId = assignment.userId;

  // Cancel open sub requests
  await db.subRequest.updateMany({
    where: { assignmentId: id, status: "OPEN" },
    data: { status: "CANCELLED" },
  });

  await db.hostAssignment.update({
    where: { id },
    data: { userId: null },
  });

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
            byName,
            hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG,
          });
        }
      } catch (e) {
        console.error("[host-assignment unclaim] removal email error:", e);
      }
    });
  }

  return Response.json({ ok: true, status: "unclaimed" });
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
  const canManage =
    isManagerRole(roles) ||
    (await isHubCoordinator(session.user.id, assignment.hubSlug));
  const isOwn = assignment.userId !== null && assignment.userId === session.user.id;

  if (!canManage && !isOwn) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
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
  });

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
            byName,
            hubSlug: assignment.hubSlug || DEFAULT_HOSTING_HUB_SLUG,
          });
        }
      } catch (e) {
        console.error("[host-assignment delete] removal email error:", e);
      }
    });
  }

  return Response.json({ ok: true });
}
