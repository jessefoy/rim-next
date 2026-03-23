import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** PATCH /api/hubs/[slug]/tasks/subtasks/[subtaskId] — update subtask */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; subtaskId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, subtaskId } = await params;
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

  const subtask = await db.subtask.findUnique({
    where: { id: subtaskId },
    include: { task: { include: { list: { select: { hubId: true } } } } },
  });
  if (!subtask || subtask.task.list.hubId !== hub.id) {
    return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
  }

  const body = await req.json();
  const { title, body: subtaskBody, assigneeId, dueDate, status, order } = body;

  const updated = await db.subtask.update({
    where: { id: subtaskId },
    data: {
      ...(title !== undefined && { title }),
      ...(subtaskBody !== undefined && { body: subtaskBody }),
      ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(status !== undefined && { status }),
      ...(order !== undefined && { order }),
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/hubs/[slug]/tasks/subtasks/[subtaskId] — delete subtask */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; subtaskId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, subtaskId } = await params;
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

  const subtask = await db.subtask.findUnique({
    where: { id: subtaskId },
    include: { task: { include: { list: { select: { hubId: true } } } } },
  });
  if (!subtask || subtask.task.list.hubId !== hub.id) {
    return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
  }

  await db.subtask.delete({ where: { id: subtaskId } });
  return NextResponse.json({ ok: true });
}
