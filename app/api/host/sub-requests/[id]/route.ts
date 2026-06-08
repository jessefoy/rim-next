import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isHubCoordinator } from "@/lib/hubAuth";

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// PATCH /api/host/sub-requests/[id] — cancel a sub request
// The host who owns the underlying assignment, a manager, OR a coordinator of
// the assignment's hub can cancel. Coordinator parity with the assign / unclaim
// / reassign paths — coordinators carry responsibility for their team's
// coverage, so they can clear a cover request (the host stays on).
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const roles = session.user.roles ?? [];

  const subRequest = await db.subRequest.findUnique({
    where: { id },
    include: { assignment: { select: { userId: true, hubSlug: true } } },
  });
  if (!subRequest) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (subRequest.status !== "OPEN") {
    return Response.json({ error: "Only open requests can be cancelled" }, { status: 409 });
  }
  const isOwn = subRequest.assignment.userId === session.user.id;
  const canManage =
    isManager(roles) ||
    (await isHubCoordinator(session.user.id, subRequest.assignment.hubSlug));
  if (!canManage && !isOwn) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.subRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  return Response.json({ ok: true });
}
