import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { sendHostAssignmentConfirmationEmail } from "@/lib/email";
import { DEFAULT_HOSTING_HUB_SLUG } from "@/lib/programHub";

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
// unclaim: owner (or manager) can unclaim — sets userId=null, cancels open sub requests
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!hasHubAccess(roles)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

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

  if (action === "claim") {
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

  // unclaim
  const isOwn = assignment.userId === session.user.id;
  if (!isManagerRole(roles) && !isOwn) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cancel open sub requests
  await db.subRequest.updateMany({
    where: { assignmentId: id, status: "OPEN" },
    data: { status: "CANCELLED" },
  });

  await db.hostAssignment.update({
    where: { id },
    data: { userId: null },
  });

  return Response.json({ ok: true, status: "unclaimed" });
}

// DELETE /api/host/assignments/[id]
// HOST_MANAGER/ADMIN can delete any assignment.
// HOST can delete their own assignment.
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
  const manager = isManagerRole(roles);
  const isOwn = assignment.userId !== null && assignment.userId === session.user.id;

  if (!manager && !isOwn) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cancel open sub requests on this assignment first
  await db.subRequest.updateMany({
    where: { assignmentId: id, status: "OPEN" },
    data: { status: "CANCELLED" },
  });

  await db.hostAssignment.delete({ where: { id } });
  return Response.json({ ok: true });
}
