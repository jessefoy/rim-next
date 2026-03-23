import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** POST /api/hubs/[slug]/tasks/lists/[listId]/tasks — create a task */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; listId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, listId } = await params;
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

  const list = await db.taskList.findFirst({ where: { id: listId, hubId: hub.id } });
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  const body = await req.json();
  const { title } = body;
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const maxOrder = await db.task.aggregate({
    where: { listId },
    _max: { order: true },
  });

  const task = await db.task.create({
    data: {
      listId,
      title,
      order: (maxOrder._max.order ?? -1) + 1,
      createdById: session.user.id,
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      subtasks: true,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
