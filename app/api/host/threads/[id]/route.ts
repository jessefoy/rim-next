import { auth } from "@/auth";
import { db } from "@/lib/db";

function hasHubAccess(roles: string[]) {
  return roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
}
function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// GET /api/host/threads/[id] — thread detail + replies
export async function GET(
  _req: Request,
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

  const thread = await db.hostThread.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      replies: {
        include: {
          author: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!thread) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    id: thread.id,
    title: thread.title,
    body: thread.body,
    category: thread.category,
    status: thread.status,
    author: thread.author,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    replies: thread.replies.map((r) => ({
      id: r.id,
      body: r.body,
      author: r.author,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

// PATCH /api/host/threads/[id] — close or archive (HOST_MANAGER/ADMIN only)
// Body: { status: "CLOSED" | "ARCHIVED" | "OPEN" }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden — HOST_MANAGER or ADMIN required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (status !== "OPEN" && status !== "CLOSED" && status !== "ARCHIVED") {
    return Response.json(
      { error: "status must be OPEN, CLOSED, or ARCHIVED" },
      { status: 400 }
    );
  }

  const thread = await db.hostThread.findUnique({ where: { id } });
  if (!thread) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.hostThread.update({
    where: { id },
    data: { status },
  });

  return Response.json({ id: updated.id, status: updated.status, ok: true });
}
