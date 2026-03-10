import { auth } from "@/auth";
import { db } from "@/lib/db";

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// PATCH /api/host/sub-requests/[id] — cancel a sub request
// Own request only, unless HOST_MANAGER/ADMIN
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
    include: { assignment: { select: { userId: true } } },
  });
  if (!subRequest) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (subRequest.status !== "OPEN") {
    return Response.json({ error: "Only open requests can be cancelled" }, { status: 409 });
  }
  if (!isManager(roles) && subRequest.assignment.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.subRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  return Response.json({ ok: true });
}
