/**
 * /api/documents/[id]/placements — cross-hub sharing (HubDocumentPlacement).
 *
 * One canonical HubDocument can be *placed into* several hubs — it surfaces in
 * each hub's Documents list (badged), never duplicated (RIM_Documents.md §7).
 *
 * POST   { hubId }       — share the doc into a hub
 * DELETE ?hubId=…        — un-share from a hub (removes the placement only;
 *                          never touches the document)
 *
 * Model:
 *   - Managing sharing requires canEditDocument (author / coordinator of a hub
 *     the doc lives in / GUIDING_TEACHER).
 *   - You can only share INTO a hub you're an active member of — no spraying
 *     docs into teams you're not on.
 *   - The create path rejects hubId === document.hubId (the origin is never a
 *     placement) and a hub it's already placed in.
 *   - Origin owns the lifecycle: archive/delete live with the origin hub; a
 *     placed-in hub's only management action is removing its own placement.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canEditDocument } from "@/lib/documentAuth";
import { NextResponse } from "next/server";

async function loadDocAndViewer(id: string, userId: string, roles: string[]) {
  const doc = await db.hubDocument.findUnique({
    where: { id },
    select: { addedById: true, hubId: true, visibility: true, placements: { select: { hubId: true } } },
  });
  if (!doc) return { doc: null as null, memberships: [] as { hubId: string; isCoordinator: boolean; status: string }[] };
  const memberships = await db.hubMember.findMany({
    where: { userId },
    select: { hubId: true, isCoordinator: true, status: true },
  });
  return { doc, memberships };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const hubId: string = body?.hubId ?? "";
  if (!hubId) return NextResponse.json({ error: "hubId is required" }, { status: 400 });

  const { doc, memberships } = await loadDocAndViewer(id, session.user.id, session.user.roles ?? []);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditDocument(doc, { userId: session.user.id, roles: session.user.roles ?? [], memberships })) {
    return NextResponse.json({ error: "Only the author or a coordinator can share this." }, { status: 403 });
  }

  // The origin hub is never a placement; never double-list it.
  if (hubId === doc.hubId) {
    return NextResponse.json({ error: "This is the document's home hub." }, { status: 400 });
  }
  if (doc.placements.some((p) => p.hubId === hubId)) {
    return NextResponse.json({ error: "Already shared with that hub." }, { status: 409 });
  }

  // You can only share into a hub you're an active member of.
  const membership = memberships.find((m) => m.hubId === hubId);
  if (!membership || membership.status !== "ACTIVE") {
    return NextResponse.json({ error: "You can only share into hubs you belong to." }, { status: 403 });
  }

  const hub = await db.hub.findUnique({ where: { id: hubId }, select: { id: true, slug: true, name: true, status: true } });
  if (!hub || hub.status !== "ACTIVE") return NextResponse.json({ error: "Hub not found" }, { status: 404 });

  await db.hubDocumentPlacement.create({ data: { documentId: id, hubId } });
  return NextResponse.json({ hub: { id: hub.id, slug: hub.slug, name: hub.name } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hubId = new URL(req.url).searchParams.get("hubId") ?? "";
  if (!hubId) return NextResponse.json({ error: "hubId is required" }, { status: 400 });

  const { doc, memberships } = await loadDocAndViewer(id, session.user.id, session.user.roles ?? []);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditDocument(doc, { userId: session.user.id, roles: session.user.roles ?? [], memberships })) {
    return NextResponse.json({ error: "Only the author or a coordinator can un-share this." }, { status: 403 });
  }

  // Idempotent — deleting a placement that isn't there is fine.
  await db.hubDocumentPlacement.deleteMany({ where: { documentId: id, hubId } });
  return NextResponse.json({ ok: true });
}
