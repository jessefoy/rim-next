import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, canManageTrash } from "@/lib/hubAuth";

/**
 * POST /api/hub/[slug]/conversations/[id]/permanent-delete — hard delete a thread.
 *
 * Restricted to trash-managers (ADMIN, GUIDING_TEACHER, hub coordinators).
 * Precondition: the thread must already be in the trash (deletedAt set).
 * Cascade deletes handle replies + subscriptions.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const roles = session.user.roles ?? [];
  const isCoord = member?.isCoordinator ?? false;
  if (!canManageTrash(roles, isCoord)) {
    return NextResponse.json({ error: "Only admin, guiding teacher, or coordinator can permanently delete" }, { status: 403 });
  }

  const thread = await db.hubConversationThread.findFirst({ where: { id, hubId: hub.id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!thread.deletedAt) {
    return NextResponse.json({ error: "Thread must be in trash before it can be permanently deleted" }, { status: 400 });
  }

  await db.hubConversationThread.delete({ where: { id } });
  return NextResponse.json({ ok: true, permanentlyDeleted: true });
}
