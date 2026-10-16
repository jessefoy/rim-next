import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canManageHubCoverage } from "@/lib/hubAuth";

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
  const canManage = await canManageHubCoverage(session.user.id, roles, subRequest.assignment.hubSlug);
  if (!canManage && !isOwn) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  // Only while still open: a cover that landed first stands (2026-10-16 audit).
  const closed = await db.subRequest.updateMany({ where: { id, status: "OPEN" }, data: { status: "CANCELLED" } });
  if (closed.count === 0) {
    return Response.json({ error: "This request is already closed: someone covered it, or it was cancelled." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
