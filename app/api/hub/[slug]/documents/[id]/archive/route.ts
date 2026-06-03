import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { canAccessHub, effectiveCoordinator, getHubMembership } from "@/lib/hubAuth";

/**
 * POST /api/hub/[slug]/documents/[id]/archive — toggle archive state.
 *
 * Body: { archived: boolean } — true to archive, false to unarchive.
 *
 * Archive means the document is hidden from the main list but visible to
 * every hub member under an "Archived" filter. Read-only when archived.
 * Author or coordinator can toggle.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!canAccessHub(member, session.user.roles ?? [])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.deletedAt) return NextResponse.json({ error: "Document is in trash" }, { status: 400 });

  const isAuthor = doc.addedById === session.user.id;
  const isCoord  = effectiveCoordinator(member, session.user.roles ?? []);
  if (!isAuthor && !isCoord) {
    return NextResponse.json({ error: "Only the author or a coordinator can archive" }, { status: 403 });
  }

  const { archived } = await req.json();
  const willArchive = !!archived;

  const updated = await db.hubDocument.update({
    where: { id },
    data: willArchive
      ? { archivedAt: new Date(), archivedById: session.user.id }
      : { archivedAt: null, archivedById: null },
  });

  return NextResponse.json({
    ok: true,
    archivedAt: updated.archivedAt?.toISOString() ?? null,
  });
}
