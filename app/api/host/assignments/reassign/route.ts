import { auth } from "@/auth";
import { db } from "@/lib/db";

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// POST /api/host/assignments/reassign
// HOST_MANAGER or ADMIN only. Swaps the current assignee (if any) for the
// requester on the given session.
//
// Body: { programSlug, sessionDate, currentAssignmentId? }
//   - If currentAssignmentId is provided, the old HostAssignment is deleted
//     (its open sub-requests are cancelled first). The previously assigned
//     host, if any, is notified.
//   - A fresh HostAssignment is created with userId = current user.
//
// Regular HOST uses the sub-request system for coverage transfers — this
// endpoint is reserved for managerial overrides.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!isManager(roles)) {
    return Response.json(
      { error: "Only Host Managers and Admins can reassign sessions." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.programSlug) {
    return Response.json({ error: "programSlug is required" }, { status: 400 });
  }

  const { programSlug, sessionDate, currentAssignmentId } = body as {
    programSlug: string;
    sessionDate?: string | null;
    currentAssignmentId?: string | null;
  };

  const parsedDate = sessionDate ? new Date(sessionDate) : null;

  let previousUserId: string | null = null;

  if (currentAssignmentId) {
    const existing = await db.hostAssignment.findUnique({
      where: { id: currentAssignmentId },
    });
    if (!existing) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }
    previousUserId = existing.userId ?? null;

    if (previousUserId === session.user.id) {
      return Response.json(
        { error: "You're already hosting this session." },
        { status: 409 },
      );
    }

    await db.subRequest.updateMany({
      where: { assignmentId: existing.id, status: "OPEN" },
      data: { status: "CANCELLED" },
    });

    await db.hostAssignment.delete({ where: { id: existing.id } });
  }

  const created = await db.hostAssignment.create({
    data: {
      programSlug,
      userId: session.user.id,
      sessionDate: parsedDate,
      assignedBy: session.user.id,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
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

