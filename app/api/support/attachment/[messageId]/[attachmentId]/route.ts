/**
 * GET /api/support/attachment/[messageId]/[attachmentId]
 *
 * Proxy for Gmail inline/CID-referenced attachments.
 * Fetches the attachment from Gmail API and streams it back
 * with the correct content type.
 *
 * messageId = Gmail message ID (from SupportMessage.gmailMessageId)
 * attachmentId = Gmail attachment ID (from message part body.attachmentId)
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/gmail";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.some((r) => ["SUPPORT", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { messageId, attachmentId } = await params;

  // Ownership check: verify this messageId belongs to a tracked SupportMessage
  const knownMessage = await db.supportMessage.findUnique({
    where: { gmailMessageId: messageId },
    select: { id: true },
  });
  if (!knownMessage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const gmail = await getGmailClient();

    // Fetch attachment data from Gmail API
    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    const data = res.data.data;
    if (!data) {
      return NextResponse.json({ error: "No attachment data" }, { status: 404 });
    }

    // Gmail returns base64url-encoded data
    const buffer = Buffer.from(data, "base64url");

    const url = new URL(_req.url);
    const contentType = url.searchParams.get("ct") || "application/octet-stream";
    const downloadName = url.searchParams.get("dl");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    };

    // If a download filename is provided, set Content-Disposition for download
    if (downloadName) {
      headers["Content-Disposition"] = `attachment; filename="${downloadName}"`;
    }

    return new NextResponse(buffer, { headers });
  } catch (err: any) {
    console.error("Attachment proxy error:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch attachment" },
      { status: 500 }
    );
  }
}
