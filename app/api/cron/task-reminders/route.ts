import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/cron/task-reminders
 * Daily cron (9am UTC via vercel.json). Finds tasks with dueDate = tomorrow,
 * status not DONE, assigneeId set. Creates one TASK_DUE_TOMORROW alert per task per assignee.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  // Find tasks due tomorrow with assignees, not done
  const tasks = await db.task.findMany({
    where: {
      dueDate: { gte: tomorrowStart, lte: tomorrowEnd },
      status: { not: "DONE" },
      assigneeId: { not: null },
    },
    include: {
      list: { include: { hub: { select: { name: true, slug: true } } } },
    },
  });

  // Also check subtasks
  const subtasks = await db.subtask.findMany({
    where: {
      dueDate: { gte: tomorrowStart, lte: tomorrowEnd },
      status: { not: "DONE" },
      assigneeId: { not: null },
    },
    include: {
      task: {
        include: { list: { include: { hub: { select: { name: true, slug: true } } } } },
      },
    },
  });

  let created = 0;

  for (const task of tasks) {
    await db.alert.create({
      data: {
        userId: task.assigneeId!,
        type: "TASK_DUE_TOMORROW",
        message: `"${task.title}" is due tomorrow in ${task.list.hub.name}`,
        linkUrl: `/account/hub/${task.list.hub.slug}/tasks?task=${task.id}`,
      },
    });
    created++;
  }

  for (const sub of subtasks) {
    await db.alert.create({
      data: {
        userId: sub.assigneeId!,
        type: "TASK_DUE_TOMORROW",
        message: `Subtask "${sub.title}" is due tomorrow in ${sub.task.list.hub.name}`,
        linkUrl: `/account/hub/${sub.task.list.hub.slug}/tasks?task=${sub.taskId}`,
      },
    });
    created++;
  }

  return NextResponse.json({ ok: true, alerts: created });
}
