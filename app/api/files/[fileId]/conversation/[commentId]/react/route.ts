/**
 * POST /api/files/[fileId]/conversation/[commentId]/react — toggle the
 * viewer's reaction { emoji } on a comment. Only the five supported emojis are
 * accepted; reactions is { emoji: [userId, …] }. Gated by authorizeFileRead
 * (see the file → react on its conversation).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  authorizeFileRead,
  FILE_REACTION_EMOJIS,
  isCrossSiteRequest,
} from "@/lib/googleFiles";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fileId: string; commentId: string }> },
) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Do this from within RIM." }, { status: 403 });
  }
  const { fileId, commentId } = await params;

  let body: { emoji?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!(FILE_REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    return NextResponse.json({ error: "That reaction isn't available." }, { status: 400 });
  }

  try {
    const gate = await authorizeFileRead(await auth(), fileId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const { viewer } = gate.data;

    const comment = await db.fileComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.googleFileId !== fileId) {
      return NextResponse.json({ error: "That comment wasn't found." }, { status: 404 });
    }

    const reactions = { ...((comment.reactions as Record<string, string[]>) ?? {}) };
    const current = new Set(reactions[emoji] ?? []);
    if (current.has(viewer.userId)) current.delete(viewer.userId);
    else current.add(viewer.userId);
    if (current.size === 0) delete reactions[emoji];
    else reactions[emoji] = [...current];

    await db.fileComment.update({ where: { id: commentId }, data: { reactions } });
    return NextResponse.json({ reactions });
  } catch (e) {
    console.error("[files-conversation-react]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't save that reaction. Please try again." },
      { status: 502 },
    );
  }
}
