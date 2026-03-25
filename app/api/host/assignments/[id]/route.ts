import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getHubNotificationRecipients } from "@/lib/toolAuth";

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
    const updated = await db.hostAssignment.update({
      where: { id },
      data: { userId: session.user.id, assignedBy: session.user.id },
    });

    // Background: notify all hub members
    void (async () => {
      try {
        const claimer = await db.user.findUnique({
          where: { id: session.user.id },
          select: { firstName: true, lastName: true, email: true },
        });
        const claimerName =
          [claimer?.firstName, claimer?.lastName].filter(Boolean).join(" ") ||
          claimer?.email ||
          "Someone";

        const sessionLabel = updated.sessionDate
          ? updated.sessionDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          : null;

        const recipients = await getHubNotificationRecipients("host-team", {
          excludeUserId: session.user.id,
        });

        await db.alert.createMany({
          data: recipients.map((u) => ({
            userId: u.id,
            type: "SUB_REQUEST" as const, // reuse generic type — distinct message
            message: `${claimerName} claimed${sessionLabel ? ` the ${sessionLabel}` : " a"} session for ${updated.programSlug}`,
            linkUrl: "/tools/schedule",
          })),
          skipDuplicates: true,
        });
      } catch (e) {
        console.error("[assignments/claim] notification error:", e);
      }
    })();

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

  // Background: notify all hub members
  void (async () => {
    try {
      const requester = await db.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true, email: true },
      });
      const requesterName =
        [requester?.firstName, requester?.lastName].filter(Boolean).join(" ") ||
        requester?.email ||
        "Someone";

      const sessionLabel = assignment.sessionDate
        ? assignment.sessionDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : null;

      const recipients = await getHubNotificationRecipients("host-team", {
        excludeUserId: session.user.id,
      });

      await db.alert.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          type: "UNASSIGNED_SESSION" as const,
          message: `${requesterName} removed themselves from${sessionLabel ? ` the ${sessionLabel}` : " a"} session for ${assignment.programSlug}`,
          linkUrl: "/tools/schedule",
        })),
        skipDuplicates: true,
      });
    } catch (e) {
      console.error("[assignments/unclaim] notification error:", e);
    }
  })();

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
