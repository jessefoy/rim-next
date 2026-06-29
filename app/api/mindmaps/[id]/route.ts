import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canEditMindMap } from "@/lib/mindMapAuth";

/** Load the map's access shape + the viewer's memberships once. */
async function loadGateContext(mapId: string, userId: string) {
  const [map, memberships] = await Promise.all([
    db.mindMap.findUnique({
      where: { id: mapId },
      select: { id: true, addedById: true, hubId: true, visibility: true, deletedAt: true },
    }),
    db.hubMember.findMany({ where: { userId }, select: { hubId: true, isCoordinator: true } }),
  ]);
  return { map, memberships };
}

interface IncomingNode {
  id: string;
  label: string;
  note?: string | null;
  x: number;
  y: number;
  parentId?: string | null;
}

/**
 * PATCH /api/mindmaps/[id] — snapshot autosave. Body:
 *   { title?, description?, nodes: [{ id, label, note, x, y, parentId }] }
 * The client owns node ids (crypto.randomUUID() for new ones), so ids are
 * stable across saves — which Slice 3 relies on to anchor a conversation to a
 * node. Replaces the node set in one transaction: upsert present, delete
 * absent. parentId is applied in a second pass (and nulled if it points outside
 * the incoming set) so a self-FK never violates regardless of node order.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { map, memberships } = await loadGateContext(id, session.user.id);
  if (!map || map.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const viewer = { userId: session.user.id, roles: session.user.roles ?? [], memberships };
  if (!canEditMindMap({ ...map, placements: [] }, viewer)) {
    return NextResponse.json({ error: "You can't edit this map." }, { status: 403 });
  }

  const body = await req.json();
  const rawNodes: IncomingNode[] = Array.isArray(body?.nodes) ? body.nodes : [];

  // Sanitize + de-dupe by id; a node needs a non-empty id and label.
  const seen = new Set<string>();
  const nodes: IncomingNode[] = [];
  for (const n of rawNodes) {
    if (!n || typeof n.id !== "string" || !n.id) continue;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    nodes.push({
      id: n.id,
      label: typeof n.label === "string" && n.label.trim() ? n.label.trim() : "Untitled topic",
      note: typeof n.note === "string" && n.note.trim() ? n.note.trim() : null,
      x: Number.isFinite(n.x) ? n.x : 0,
      y: Number.isFinite(n.y) ? n.y : 0,
      parentId: typeof n.parentId === "string" ? n.parentId : null,
    });
  }
  const incomingIds = new Set(nodes.map((n) => n.id));

  await db.$transaction(async (tx) => {
    if (typeof body?.title === "string" || typeof body?.description === "string") {
      await tx.mindMap.update({
        where: { id },
        data: {
          ...(typeof body.title === "string" && body.title.trim() ? { title: body.title.trim() } : {}),
          ...(typeof body.description === "string" ? { description: body.description.trim() || null } : {}),
        },
      });
    }

    // Remove nodes the client dropped.
    await tx.mindMapNode.deleteMany({ where: { mapId: id, id: { notIn: [...incomingIds] } } });

    // Pass 1: upsert content + position with parentId null (avoids self-FK order issues).
    for (const n of nodes) {
      await tx.mindMapNode.upsert({
        where: { id: n.id },
        update: { label: n.label, note: n.note, x: n.x, y: n.y, parentId: null },
        create: { id: n.id, mapId: id, label: n.label, note: n.note, x: n.x, y: n.y },
      });
    }

    // Pass 2: set parentId, but only to a node that exists in this map's new set.
    for (const n of nodes) {
      const parentId = n.parentId && incomingIds.has(n.parentId) && n.parentId !== n.id ? n.parentId : null;
      if (parentId) await tx.mindMapNode.update({ where: { id: n.id }, data: { parentId } });
    }
  });

  const updated = await db.mindMap.findUnique({ where: { id }, select: { updatedAt: true } });
  return NextResponse.json({ ok: true, updatedAt: updated?.updatedAt.toISOString() ?? null });
}

/**
 * DELETE /api/mindmaps/[id] — soft-delete the whole map (sets deletedAt).
 * Author or GUIDING_TEACHER only (canEditMindMap covers author + coordinators;
 * for a standalone map that's the author, which is what we want in Slice 1).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { map } = await loadGateContext(id, session.user.id);
  if (!map || map.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Deleting the resource is an origin act, not a content edit: author or GT.
  const isAuthor = map.addedById === session.user.id;
  const isGT = (session.user.roles ?? []).includes("GUIDING_TEACHER");
  if (!isAuthor && !isGT) {
    return NextResponse.json({ error: "Only the author can delete this map." }, { status: 403 });
  }

  await db.mindMap.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
