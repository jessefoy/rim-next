import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** PATCH /api/hubs/[slug]/tasks/lists/[listId] — update list */
export async function PATCH(
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
  const { name, description, isArchived, order } = body;

  const updated = await db.taskList.update({
    where: { id: listId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description: description || null }),
      ...(isArchived !== undefined && { isArchived }),
      ...(order !== undefined && { order }),
    },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/hubs/[slug]/tasks/lists/[listId] — delete list + all tasks */
export async function DELETE(
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

  const list = await db.taskList.findFirst({ where: { id: listId, hubId: hub.id } });
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  await db.taskList.delete({ where: { id: listId } });

  return NextResponse.json({ ok: true });
}
