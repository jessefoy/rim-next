import { auth } from "@/auth";
import { db } from "@/lib/db";

function hasHubAccess(roles: string[]) {
  return roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
}

const ALLOWED_EMOJIS = ["👍", "❤️", "🙏", "💡", "😊"];

// POST /api/host/replies/[id]/react — add an emoji reaction
// Body: { emoji }
export async function POST(
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
  const { emoji } = (body ?? {}) as { emoji?: string };

  if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
    return Response.json({ error: "Invalid emoji" }, { status: 400 });
  }

  const reply = await db.hostReply.findUnique({ where: { id } });
  if (!reply) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const current = (reply.reactions as Record<string, number>) ?? {};
  const updated = { ...current, [emoji]: (current[emoji] ?? 0) + 1 };

  await db.hostReply.update({
    where: { id },
    data: { reactions: updated },
  });

  return Response.json({ ok: true, reactions: updated });
}
