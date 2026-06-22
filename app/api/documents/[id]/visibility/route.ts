/**
 * /api/documents/[id]/visibility — set a document's reach.
 *
 * PATCH { visibility: "HUB" | "COORDINATORS" | "COMMUNITY" }
 *
 * Visibility layers on top of hub placement (RIM_Documents.md §7):
 *   HUB          — any member of any hub the doc is placed in (default)
 *   COORDINATORS — only those hubs' coordinators
 *   COMMUNITY    — any active member, hub-independent
 *
 * Gated by canEditDocument (author, or a coordinator of a hub the doc lives in;
 * GUIDING_TEACHER everywhere). Edit rights ignore visibility — a COMMUNITY doc
 * is community-readable, never community-editable.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canEditDocument } from "@/lib/documentAuth";
import { NextResponse } from "next/server";

const VALID = ["HUB", "COORDINATORS", "COMMUNITY"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const visibility = body?.visibility;
  if (!VALID.includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  const doc = await db.hubDocument.findUnique({
    where: { id },
    select: { addedById: true, hubId: true, visibility: true, placements: { select: { hubId: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memberships = await db.hubMember.findMany({
    where: { userId: session.user.id },
    select: { hubId: true, isCoordinator: true },
  });
  if (!canEditDocument(doc, { userId: session.user.id, roles: session.user.roles ?? [], memberships })) {
    return NextResponse.json({ error: "Only the author or a coordinator can change sharing." }, { status: 403 });
  }

  await db.hubDocument.update({ where: { id }, data: { visibility } });
  return NextResponse.json({ visibility });
}
