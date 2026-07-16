/**
 * POST /api/files/[fileId]/conversation — add a comment { body } to a file's
 * discussion (RIM_GoogleWorkspace.md, file-detail slice).
 *
 * Rides authorizeFileRead: commenting requires the same access as reading the
 * file, so a held draft's conversation is private to its creator/moderators
 * just like the draft. Comments are plain text; React escapes them on render.
 * The response returns the full updated list so the client reconciles without
 * a separate fetch (initial comments are server-rendered on the detail page).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  authorizeFileRead,
  isCrossSiteRequest,
  listFileComments,
  logFileAction,
} from "@/lib/googleFiles";

export const dynamic = "force-dynamic";

const MAX_COMMENT_LENGTH = 5000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  if (isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Post this from within RIM." }, { status: 403 });
  }
  const { fileId } = await params;

  let body: { body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Write something first." }, { status: 400 });
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: "That comment is too long." }, { status: 400 });
  }

  try {
    const gate = await authorizeFileRead(await auth(), fileId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const { viewer, place } = gate.data;

    await db.fileComment.create({
      data: { googleFileId: fileId, authorId: viewer.userId, body: text },
    });
    await logFileAction({
      userId: viewer.userId,
      action: "comment",
      googleFileId: fileId,
      hubId: place.hubId,
      detail: { place: place.key },
    });
    return NextResponse.json({ comments: await listFileComments(fileId) });
  } catch (e) {
    console.error("[files-conversation-post]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't post that. Please try again." },
      { status: 502 },
    );
  }
}
