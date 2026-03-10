import { auth } from "@/auth";
import { db } from "@/lib/db";

function hasHubAccess(roles: string[]) {
  return roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
}

// PATCH /api/host/replies/[id] — edit own reply body
// Body: { body }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasHubAccess(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { body: newBody } = (body ?? {}) as { body?: string };

  if (!newBody?.trim()) {
    return Response.json({ error: "Reply body is required" }, { status: 400 });
  }

  const reply = await db.hostReply.findUnique({ where: { id } });
  if (!reply) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (reply.authorId !== session.user.id) {
    return Response.json({ error: "You can only edit your own replies" }, { status: 403 });
  }

  await db.hostReply.update({
    where: { id },
    data: { body: newBody.trim(), edited: true, editedAt: new Date() },
  });

  return Response.json({ ok: true });
}
