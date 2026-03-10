import { auth } from "@/auth";
import { db } from "@/lib/db";

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
  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
  const isOwn = assignment.userId === session.user.id;

  if (!isManager && !isOwn) {
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
