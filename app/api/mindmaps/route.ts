import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessHub } from "@/lib/hubAuth";

/**
 * POST /api/mindmaps — create a new mind map.
 * Any active member may create. With `hubId` (the hub-module "New"), the hub is
 * the map's origin — the viewer must be able to access that hub. Without it, a
 * hubless personal/project map (the directory "New"). Seeds one root topic.
 * Returns { id } — the client navigates to /account/mindmaps/[id].
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title = "Untitled mind map";
  let hubId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.title === "string" && body.title.trim()) title = body.title.trim();
    if (typeof body?.hubId === "string" && body.hubId) hubId = body.hubId;
  } catch {
    // no body — defaults
  }

  // Origin in a hub: the creator must be able to access that (active) hub.
  if (hubId) {
    const [hub, member] = await Promise.all([
      db.hub.findUnique({ where: { id: hubId }, select: { id: true, status: true } }),
      db.hubMember.findFirst({ where: { hubId, userId: session.user.id }, select: { id: true } }),
    ]);
    if (!hub || hub.status !== "ACTIVE") {
      return NextResponse.json({ error: "Hub not found." }, { status: 404 });
    }
    if (!canAccessHub(member, session.user.roles ?? [])) {
      return NextResponse.json({ error: "You can't create a map in this hub." }, { status: 403 });
    }
  }

  const map = await db.mindMap.create({
    data: {
      addedById: session.user.id,
      title,
      hubId,
      nodes: {
        create: [{ label: "Untitled topic", x: 0, y: 0 }],
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: map.id }, { status: 201 });
}
