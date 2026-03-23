import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** POST /api/hubs/[slug]/tasks/lists — create a task list */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const hub = await db.hub.findUnique({ where: { slug }, select: { id: true } });
  if (!hub) return NextResponse.json({ error: "Hub not found" }, { status: 404 });

  if (!isAdmin) {
    const member = await db.hubMember.findUnique({
      where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    });
    if (!member) return NextResponse.json({ error: "Not a hub member" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description } = body;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Get max order
  const maxOrder = await db.taskList.aggregate({
    where: { hubId: hub.id, isTemplate: false },
    _max: { order: true },
  });

  const list = await db.taskList.create({
    data: {
      hubId: hub.id,
      name,
      description: description || null,
      order: (maxOrder._max.order ?? -1) + 1,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(list, { status: 201 });
}
