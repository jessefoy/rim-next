import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** PATCH /api/hubs/[slug]/tasks/[taskId] — update task */
export async function PATCH(
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

  // Verify task belongs to this hub
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { list: { select: { hubId: true } } },
  });
  if (!task || task.list.hubId !== hub.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await req.json();
  const { title, body: taskBody, assigneeId, dueDate, status, order } = body;

  // Check if assignee is changing — for notification
  const assigneeChanged = assigneeId !== undefined && assigneeId !== task.assigneeId && assigneeId !== null;

  const updated = await db.task.update({
    where: { id: taskId },
    data: {
      ...(title !== undefined && { title }),
      ...(taskBody !== undefined && { body: taskBody }),
      ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(status !== undefined && { status }),
      ...(order !== undefined && { order }),
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      subtasks: {
        orderBy: { order: "asc" },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  // Create notification if assigned to someone else
  if (assigneeChanged && assigneeId !== session.user.id) {
    const hubRecord = await db.hub.findUnique({ where: { id: hub.id }, select: { name: true } });
    await db.alert.create({
      data: {
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        message: `You were assigned "${updated.title}" in ${hubRecord?.name ?? "a hub"}`,
        linkUrl: `/account/hub/${slug}/tasks?task=${taskId}`,
      },
    });
  }

  return NextResponse.json(updated);
}

/** DELETE /api/hubs/[slug]/tasks/[taskId] — delete task + subtasks */
export async function DELETE(
  _req: Request,
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

  await db.task.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
