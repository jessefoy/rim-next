import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, canManageTrash } from "@/lib/hubAuth";

/**
 * POST /api/hub/[slug]/documents/[id]/restore — restore from trash.
 *
 * Restricted to trash-managers (ADMIN, GUIDING_TEACHER, hub coordinators).
 * Clears deletedAt + deletedById. Archive state (if any) is preserved.
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
    return NextResponse.json({ error: "Only admin, guiding teacher, or coordinator can restore" }, { status: 403 });
  }

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.deletedAt) return NextResponse.json({ ok: true }); // idempotent

  await db.hubDocument.update({
    where: { id },
    data:  { deletedAt: null, deletedById: null },
  });

  return NextResponse.json({ ok: true, restored: true });
}
