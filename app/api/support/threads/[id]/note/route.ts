/**
 * POST /api/support/threads/[id]/note
 *
 * Create an internal note on a support thread.
 * Notes are Tiptap JSON (stored as Json in Prisma).
 * Only visible to support team, never sent to the customer.
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyNewNote } from "@/lib/supportNotify";

function hasSupport(roles: string[]) {
  return roles.some((r) => ["SUPPORT", "ADMIN"].includes(r));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupport(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { body } = await req.json();

  if (!body) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  // Verify thread exists + get assignee info
  const thread = await db.supportThread.findUnique({
    where: { id },
    select: { id: true, subject: true, assignedToId: true },
  });

  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const note = await db.supportNote.create({
    data: {
      threadId: id,
      authorId: session.user.id,
      body,
    },
  });

  // Notify assigned user about the note (fire-and-forget)
  notifyNewNote(
    id,
    thread.subject,
    session.user.name || "Someone",
    thread.assignedToId,
    session.user.id
  ).catch(() => {});

  return NextResponse.json({
    id: note.id,
    createdAt: note.createdAt.toISOString(),
  });
}
