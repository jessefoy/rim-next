import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, canManageTrash } from "@/lib/hubAuth";
import { cleanupAllBlobs } from "@/lib/blobCleanup";

/**
 * POST /api/hub/[slug]/documents/[id]/permanent-delete — hard delete.
 *
 * Restricted to trash-managers (ADMIN, GUIDING_TEACHER, hub coordinators).
 * Required precondition: the document must already be in the trash
 * (deletedAt is set). This is the second stage of the two-stage delete —
 * a deliberate, gated action.
 *
 * Cascades blob cleanup before the row is removed. Cascade deletes on
 * HubDocumentNotification handle related rows.
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

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.deletedAt) {
    return NextResponse.json({ error: "Document must be in trash before it can be permanently deleted" }, { status: 400 });
  }

  // Clean up any blob images before deleting the document
  if (doc.body) cleanupAllBlobs(doc.body); // fire-and-forget

  await db.hubDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true, permanentlyDeleted: true });
}
