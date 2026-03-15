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

    // Infer content type from the data (or default to octet-stream)
    // We'll accept a query param for content type since Gmail doesn't return it here
    const contentType =
      new URL(_req.url).searchParams.get("ct") || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400", // cache 24h
      },
    });
  } catch (err: any) {
    console.error("Attachment proxy error:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch attachment" },
      { status: 500 }
    );
  }
}
