import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator } from "@/lib/hubAuth";

// GET /api/hub/[slug]/conversations/[id] — thread detail + replies
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thread = await db.hubConversationThread.findUnique({
    where: { id },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      replies: {
        include: { author: { select: { firstName: true, lastName: true, preferredName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!thread || thread.hubId !== hub.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(thread);
}

// PATCH /api/hub/[slug]/conversations/[id]
//   action: "edit"            — author or coordinator: update title + body
//   action: "pin" | "unpin"   — coordinator: toggle pin
//   {status: "OPEN"|"CLOSED"} — coordinator: change status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thread = await db.hubConversationThread.findUnique({ where: { id } });
  if (!thread || thread.hubId !== hub.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { action, status, title, body: newBody } = body;

  // Edit — author OR coordinator can edit title/body
  if (action === "edit") {
    const isAuthor = thread.authorId === session.user.id;
    const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;
    if (!isAuthor && !isCoordinator) {
      return NextResponse.json({ error: "Only the author can edit this post." }, { status: 403 });
    }
    const updated = await db.hubConversationThread.update({
      where: { id },
      data: {
        ...(typeof title === "string" && title.trim() && { title: title.trim() }),
        ...(newBody !== undefined && { body: newBody }),
        edited: true,
        editedAt: new Date(),
      },
      include: {
        author: { select: { firstName: true, lastName: true, preferredName: true } },
        _count:  { select: { replies: true } },
      },
    });
    return NextResponse.json(updated);
  }

  // Everything below is coordinator-only
  try {
    requireCoordinator(member?.isCoordinator ?? false, session.user.roles ?? []);
  } catch {
    return NextResponse.json({ error: "Coordinators only" }, { status: 403 });
  }

  if (action === "pin") {
    const updated = await db.hubConversationThread.update({
      where: { id },
      data:  { isPinned: true, pinnedAt: new Date() },
      include: {
        author: { select: { firstName: true, lastName: true, preferredName: true } },
        _count:  { select: { replies: true } },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "unpin") {
    const updated = await db.hubConversationThread.update({
      where: { id },
      data:  { isPinned: false, pinnedAt: null },
      include: {
        author: { select: { firstName: true, lastName: true, preferredName: true } },
        _count:  { select: { replies: true } },
      },
    });
    return NextResponse.json(updated);
  }

  const updated = await db.hubConversationThread.update({
    where: { id },
    data:  { status },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count:  { select: { replies: true } },
    },
  });

  return NextResponse.json(updated);
}
