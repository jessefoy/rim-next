import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { InputJsonValue } from "@prisma/client/runtime/library";

/** POST /api/hubs/[slug]/tasks/lists/from-template/[templateId] — stamp a template into a live list */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; templateId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, templateId } = await params;
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

  const template = await db.taskList.findFirst({
    where: { id: templateId, hubId: hub.id, isTemplate: true },
    include: {
      tasks: {
        orderBy: { order: "asc" },
        include: { subtasks: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const body = await req.json();
  const { name, referenceDate } = body;

  // Find earliest dueDate in template for offset calculation
  let earliestDate: Date | null = null;
  if (referenceDate) {
    for (const task of template.tasks) {
      if (task.dueDate && (!earliestDate || task.dueDate < earliestDate)) {
        earliestDate = task.dueDate;
      }
      for (const sub of task.subtasks) {
        if (sub.dueDate && (!earliestDate || sub.dueDate < earliestDate)) {
          earliestDate = sub.dueDate;
        }
      }
    }
  }

  const refDate = referenceDate ? new Date(referenceDate) : null;

  function offsetDate(original: Date | null): Date | null {
    if (!original || !earliestDate || !refDate) return null;
    const diffMs = original.getTime() - earliestDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const result = new Date(refDate);
    result.setDate(result.getDate() + diffDays);
    return result;
  }

  // Get max order for new list
  const maxOrder = await db.taskList.aggregate({
    where: { hubId: hub.id, isTemplate: false },
    _max: { order: true },
  });

  const newList = await db.taskList.create({
    data: {
      hubId: hub.id,
      name: name || template.name.replace(" (Template)", ""),
      description: template.description,
      isTemplate: false,
      order: (maxOrder._max.order ?? -1) + 1,
      createdById: session.user.id,
    },
  });

  for (const task of template.tasks) {
    const newTask = await db.task.create({
      data: {
        listId: newList.id,
        title: task.title,
        body: task.body as InputJsonValue ?? undefined,
        assigneeId: null,
        dueDate: offsetDate(task.dueDate),
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
          dueDate: offsetDate(sub.dueDate),
          status: "OPEN",
          order: sub.order,
          createdById: session.user.id,
        },
      });
    }
  }

  return NextResponse.json(newList, { status: 201 });
}
