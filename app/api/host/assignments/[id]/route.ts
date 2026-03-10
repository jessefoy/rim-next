import { auth } from "@/auth";
import { db } from "@/lib/db";

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// DELETE /api/host/assignments/[id] — remove an assignment (HOST_MANAGER/ADMIN)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const assignment = await db.hostAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // If there are open sub requests on this assignment, cancel them first
  await db.subRequest.updateMany({
    where: { assignmentId: id, status: "OPEN" },
    data: { status: "CANCELLED" },
  });

  await db.hostAssignment.delete({ where: { id } });
  return Response.json({ ok: true });
}
