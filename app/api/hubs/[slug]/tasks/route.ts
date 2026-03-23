import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** GET /api/hubs/[slug]/tasks — all non-template, non-archived lists with tasks+subtasks */
export async function GET(
  _req: Request,
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

  const lists = await db.taskList.findMany({
    where: { hubId: hub.id, isTemplate: false, isArchived: false },
    orderBy: { order: "asc" },
    include: {
      tasks: {
        orderBy: { order: "asc" },
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
      },
    },
  });

  return NextResponse.json(lists);
}
