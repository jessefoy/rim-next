import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canManageMindMapSharing, canRemoveMindMapPlacement } from "@/lib/mindMapAuth";

/** Load the map's access shape + the viewer's memberships (with status). */
async function loadMapAndViewer(mapId: string, userId: string) {
  const [map, memberships] = await Promise.all([
    db.mindMap.findUnique({
      where: { id: mapId },
      select: {
        addedById: true,
        hubId: true,
        visibility: true,
        editPolicy: true,
        deletedAt: true,
        placements: { select: { hubId: true } },
      },
    }),
    db.hubMember.findMany({ where: { userId }, select: { hubId: true, isCoordinator: true, status: true } }),
  ]);
  return { map, memberships };
}

/**
 * POST /api/mindmaps/[id]/placements — share a map into another hub.
 * Origin owns sharing (canManageMindMapSharing). Mirrors the document handler:
 * reject the origin hub, reject duplicates, require the viewer be an ACTIVE
 * member of an ACTIVE target hub.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { map, memberships } = await loadMapAndViewer(id, session.user.id);
  if (!map || map.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const viewer = {
    userId: session.user.id,
    roles: session.user.roles ?? [],
    // ACTIVE only for the gate; the target-hub active check below reads the full list.
    memberships: memberships.filter((m) => m.status === "ACTIVE").map((m) => ({ hubId: m.hubId, isCoordinator: m.isCoordinator })),
  };
  if (!canManageMindMapSharing(map, viewer)) {
    return NextResponse.json({ error: "Only the owner can share this map." }, { status: 403 });
  }

  const { hubId } = await req.json();
  if (typeof hubId !== "string" || !hubId) {
    return NextResponse.json({ error: "hubId is required." }, { status: 400 });
  }
  if (hubId === map.hubId) {
    return NextResponse.json({ error: "This is the map's home hub." }, { status: 400 });
  }
  if (map.placements.some((p) => p.hubId === hubId)) {
    return NextResponse.json({ error: "Already shared into that hub." }, { status: 400 });
  }

  const membership = memberships.find((m) => m.hubId === hubId);
  if (!membership || membership.status !== "ACTIVE") {
    return NextResponse.json({ error: "You can only share into hubs you belong to." }, { status: 403 });
  }
  const hub = await db.hub.findUnique({ where: { id: hubId }, select: { id: true, slug: true, name: true, status: true } });
  if (!hub || hub.status !== "ACTIVE") {
    return NextResponse.json({ error: "Hub not found." }, { status: 404 });
  }

  await db.mindMapPlacement.create({ data: { mapId: id, hubId } });
  return NextResponse.json({ hub: { id: hub.id, slug: hub.slug, name: hub.name } });
}

/**
 * DELETE /api/mindmaps/[id]/placements?hubId=… — remove a placement.
 * Origin side can remove any; a shared-into hub's coordinator can remove only
 * its own placement (canRemoveMindMapPlacement). Idempotent.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hubId = new URL(req.url).searchParams.get("hubId");
  if (!hubId) return NextResponse.json({ error: "hubId is required." }, { status: 400 });

  const { map, memberships } = await loadMapAndViewer(id, session.user.id);
  if (!map || map.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const viewer = {
    userId: session.user.id,
    roles: session.user.roles ?? [],
    // ACTIVE only for the gate; the target-hub active check below reads the full list.
    memberships: memberships.filter((m) => m.status === "ACTIVE").map((m) => ({ hubId: m.hubId, isCoordinator: m.isCoordinator })),
  };
  if (!canRemoveMindMapPlacement(map, viewer, hubId)) {
    return NextResponse.json({ error: "You can't remove this placement." }, { status: 403 });
  }

  await db.mindMapPlacement.deleteMany({ where: { mapId: id, hubId } });
  return NextResponse.json({ ok: true });
}
