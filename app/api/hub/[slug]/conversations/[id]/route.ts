import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator, canManageTrash, effectiveCoordinator } from "@/lib/hubAuth";

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

  // Trashed threads are only visible to trash-managers.
  if (thread.deletedAt) {
    const roles = session.user.roles ?? [];
    const isCoord = member?.isCoordinator ?? false;
    if (!canManageTrash(roles, isCoord)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
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
  // Trashed threads are read-only — must be restored first.
  if (thread.deletedAt) {
    return NextResponse.json({ error: "This thread is in the trash — restore it first" }, { status: 400 });
  }

  const body = await req.json();
  const { action, status, title, body: newBody } = body;

  // Edit — author OR coordinator can edit title/body
  if (action === "edit") {
    const isAuthor = thread.authorId === session.user.id;
    const isCoordinator = effectiveCoordinator(member, session.user.roles ?? []);
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

  // Pin/Unpin are coordinator-only — structural moderation.
  if (action === "pin" || action === "unpin") {
    try {
      requireCoordinator(member?.isCoordinator ?? false, session.user.roles ?? []);
    } catch {
      return NextResponse.json({ error: "Coordinators only" }, { status: 403 });
    }
    const updated = await db.hubConversationThread.update({
      where: { id },
      data:  action === "pin"
        ? { isPinned: true, pinnedAt: new Date() }
        : { isPinned: false, pinnedAt: null },
      include: {
        author: { select: { firstName: true, lastName: true, preferredName: true } },
        _count:  { select: { replies: true } },
      },
    });
    return NextResponse.json(updated);
  }

  // Status change (Archive / Unarchive) is author OR coordinator. Closing a
  // thread is the archive concept for conversations — the author should be
  // able to wind down their own thread, not just coordinators.
  const isAuthor = thread.authorId === session.user.id;
  const isCoordinator = effectiveCoordinator(member, session.user.roles ?? []);
  if (!isAuthor && !isCoordinator) {
    return NextResponse.json({ error: "Only the author or a coordinator can change status" }, { status: 403 });
  }

  // Translate status to archivedAt + keep status in sync. archivedAt is the
  // canonical archive marker (session 115 unification); status is written
  // in lockstep so legacy clients that read it continue to work.
  const willArchive = status === "CLOSED";
  const updated = await db.hubConversationThread.update({
    where: { id },
    data: willArchive
      ? { status: "CLOSED", archivedAt: new Date(), archivedById: session.user.id }
      : { status: "OPEN",   archivedAt: null,       archivedById: null },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count:  { select: { replies: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/hub/[slug]/conversations/[id]
// Soft-delete (sends to manager trash). Author or coordinator. Idempotent.
//
// Three-stage lifecycle: Active → Archived (archivedAt set) → Trash.
// A thread MUST be archived first before it can be soft-deleted — this is
// the deliberate-staging design. The UI hides the Delete menu item unless
// the thread is archived; this server check is the enforcement.
//
// Permanent removal: POST /api/hub/[slug]/conversations/[id]/permanent-delete
// (managers only).
export async function DELETE(
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

  const thread = await db.hubConversationThread.findFirst({ where: { id, hubId: hub.id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (thread.deletedAt) return NextResponse.json({ ok: true }); // idempotent

  // Enforce archive-first: thread must be archived before deletion.
  if (!thread.archivedAt) {
    return NextResponse.json({ error: "Archive this thread first, then delete it." }, { status: 400 });
  }

  const isAuthor = thread.authorId === session.user.id;
  const isCoord  = effectiveCoordinator(member, session.user.roles ?? []);
  if (!isAuthor && !isCoord) {
    return NextResponse.json({ error: "Only the author or a coordinator can delete" }, { status: 403 });
  }

  await db.hubConversationThread.update({
    where: { id },
    data:  { deletedAt: new Date(), deletedById: session.user.id },
  });
  return NextResponse.json({ ok: true, trashed: true });
}
