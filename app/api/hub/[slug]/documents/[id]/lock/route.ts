/**
 * POST /api/hub/[slug]/documents/[id]/lock — Toggle document lock.
 * Only the author, ADMIN, or GUIDING_TEACHER can lock/unlock.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const canModerate = (session.user.roles ?? []).some((role) => role === "ADMIN" || role === "GUIDING_TEACHER");
  if (!hub || (!canAccessHub(member, session.user.roles ?? []))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the author or admin can toggle lock
  if (doc.addedById !== session.user.id && !canModerate) {
    return NextResponse.json({ error: "Only the author can lock/unlock this document" }, { status: 403 });
  }

  const updated = await db.hubDocument.update({
    where: { id },
    data: { isLocked: !doc.isLocked },
    select: { isLocked: true, updatedAt: true },
  });

  return NextResponse.json({ ...updated, updatedAt: updated.updatedAt.toISOString() });
}
