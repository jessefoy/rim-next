/**
 * DELETE /api/files/[fileId]/conversation/[commentId] — remove a comment.
 * The comment's author can always delete it; beyond that a Space coordinator
 * or GUIDING_TEACHER/ADMIN can moderate (canModerateFileConversation). Gated
 * by authorizeFileRead first (you must be able to see the file), and the
 * comment must belong to this file (no cross-file id).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  authorizeFileRead,
  canModerateFileConversation,
  isCrossSiteRequest,
} from "@/lib/googleFiles";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ fileId: string; commentId: string }> },
) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Do this from within RIM." }, { status: 403 });
  }
  const { fileId, commentId } = await params;

  try {
    const gate = await authorizeFileRead(await auth(), fileId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const { viewer, place } = gate.data;

    const comment = await db.fileComment.findUnique({ where: { id: commentId } });
    // Bind to this file so a valid comment id from another file can't be
    // deleted through this file's (differently-authorized) route.
    if (!comment || comment.googleFileId !== fileId) {
      return NextResponse.json({ error: "That comment wasn't found." }, { status: 404 });
    }
    const isAuthor = comment.authorId === viewer.userId;
    if (!isAuthor && !(await canModerateFileConversation(viewer, place))) {
      return NextResponse.json({ error: "You can't delete this comment." }, { status: 403 });
    }
    await db.fileComment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[files-conversation-delete]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't delete that. Please try again." },
      { status: 502 },
    );
  }
}
