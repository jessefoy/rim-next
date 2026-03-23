import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** POST /api/hubs/[slug]/tasks/[taskId]/subtasks — create subtask */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; taskId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, taskId } = await params;
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

  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { list: { select: { hubId: true } } },
  });
  if (!task || task.list.hubId !== hub.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await req.json();
  const { title } = body;
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const maxOrder = await db.subtask.aggregate({
    where: { taskId },
    _max: { order: true },
  });

  const subtask = await db.subtask.create({
    data: {
      taskId,
      title,
      order: (maxOrder._max.order ?? -1) + 1,
      createdById: session.user.id,
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(subtask, { status: 201 });
}
