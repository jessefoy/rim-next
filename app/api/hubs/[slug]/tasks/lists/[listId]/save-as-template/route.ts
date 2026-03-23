import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { InputJsonValue } from "@prisma/client/runtime/library";

/** POST /api/hubs/[slug]/tasks/lists/[listId]/save-as-template — copy list as template */
export async function POST(
  _req: Request,
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

  const list = await db.taskList.findFirst({
    where: { id: listId, hubId: hub.id },
    include: {
      tasks: {
        orderBy: { order: "asc" },
        include: { subtasks: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  // Create template copy
  const template = await db.taskList.create({
    data: {
      hubId: hub.id,
      name: `${list.name} (Template)`,
      description: list.description,
      isTemplate: true,
      order: 0,
      createdById: session.user.id,
    },
  });

  // Copy tasks + subtasks, clearing assignees
  for (const task of list.tasks) {
    const newTask = await db.task.create({
      data: {
        listId: template.id,
        title: task.title,
        body: task.body as InputJsonValue ?? undefined,
        assigneeId: null,
        dueDate: task.dueDate,
        status: "OPEN",
        order: task.order,
        createdById: session.user.id,
      },
    });

    for (const sub of task.subtasks) {
      await db.subtask.create({
        data: {
          taskId: newTask.id,
          title: sub.title,
          body: sub.body as InputJsonValue ?? undefined,
          assigneeId: null,
          dueDate: sub.dueDate,
          status: "OPEN",
          order: sub.order,
          createdById: session.user.id,
        },
      });
    }
  }

  return NextResponse.json(template, { status: 201 });
}
