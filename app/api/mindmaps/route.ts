import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/mindmaps — create a new standalone mind map (Slice 1).
 * Any active member may create; the map is private to them until placed into a
 * hub (Slice 2). Seeds one root topic so the canvas opens with something to
 * grow from. Returns { id } — the client navigates to /account/mindmaps/[id].
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title = "Untitled mind map";
  try {
    const body = await req.json();
    if (typeof body?.title === "string" && body.title.trim()) title = body.title.trim();
  } catch {
    // no body — keep the default title
  }

  const map = await db.mindMap.create({
    data: {
      addedById: session.user.id,
      title,
      nodes: {
        create: [{ label: "Untitled topic", x: 0, y: 0 }],
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: map.id }, { status: 201 });
}
