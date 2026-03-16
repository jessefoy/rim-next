/**
 * POST /api/support/compose
 *
 * Send a new email via Gmail and create a SupportThread + SupportMessage.
 * From: support@rootedinmindfulness.org
 * Supports file attachments via Vercel Blob URLs.
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail";

function hasSupport(roles: string[]) {
  return roles.some((r) => ["SUPPORT", "ADMIN"].includes(r));
}

interface AttachmentInput {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupport(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { to, subject, bodyHtml, attachments } = await req.json() as {
    to: string;
    subject: string;
    bodyHtml: string;
    attachments?: AttachmentInput[];
  };

  if (!to || !subject || !bodyHtml) {
    return NextResponse.json({ error: "To, subject, and body are required" }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Get sender's signature
  const signature = await db.supportSignature.findUnique({
    where: { userId: session.user.id },
  });

  let signatureHtml = "";
  if (signature) {
    signatureHtml = `
      <br><br>
      <div style="color:#666;font-size:14px;border-top:1px solid #ddd;padding-top:12px;margin-top:12px;">
        <strong>${signature.name}</strong><br>
        ${signature.role ? `${signature.role}<br>` : ""}
        ${signature.tagline}<br>
        Rooted in Mindfulness · rootedinmindfulness.org
      </div>
    `;
  }

  const fullHtml = bodyHtml + signatureHtml;
  const fullText = bodyHtml.replace(/<[^>]+>/g, "") +
    (signature
      ? `\n\n--\n${signature.name}\n${signature.role ? signature.role + "\n" : ""}${signature.tagline}\nRooted in Mindfulness · rootedinmindfulness.org`
      : "");

  // Get Gmail credential
  const credential = await db.gmailCredential.findFirst();
  if (!credential) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 500 });
  }

  const hasAttachments = attachments && attachments.length > 0;
  const boundary = `----RIM_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  let rawEmail: string;

  if (hasAttachments) {
    const headerLines = [
      `From: ${credential.email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ];

    const parts = [
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(fullHtml).toString("base64"),
    ];

    for (const att of attachments) {
      const fileRes = await fetch(att.url);
      if (!fileRes.ok) continue;
      const buf = Buffer.from(await fileRes.arrayBuffer());
      parts.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        buf.toString("base64"),
      );
    }

    parts.push(`--${boundary}--`);
    rawEmail = headerLines.join("\r\n") + "\r\n\r\n" + parts.join("\r\n");
  } else {
    const emailLines = [
      `From: ${credential.email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      "",
      fullHtml,
    ];
    rawEmail = emailLines.join("\r\n");
  }

  const encodedEmail = Buffer.from(rawEmail).toString("base64url");

  // Send via Gmail API
  const gmail = await getGmailClient();
  const sendRes = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedEmail },
  });

  const sentMessageId = sendRes.data.id;
  const gmailThreadId = sendRes.data.threadId;

  if (!sentMessageId || !gmailThreadId) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  // Member matching
  const member = await db.user.findUnique({
    where: { email: to.toLowerCase() },
    select: { id: true },
  });

  // Create SupportThread + SupportMessage
  const now = new Date();
  const thread = await db.supportThread.create({
    data: {
      gmailThreadId,
      subject,
      senderEmail: to.toLowerCase(),
      senderName: null,
      memberId: member?.id ?? null,
      assignedToId: session.user.id,
      status: "WAITING",
      lastMessageAt: now,
      lastSyncedAt: now,
    },
  });

  const message = await db.supportMessage.create({
    data: {
      gmailMessageId: sentMessageId,
      threadId: thread.id,
      fromEmail: credential.email,
      fromName: signature?.name ?? "RIM Support",
      bodyHtml: fullHtml,
      bodyText: fullText,
      sentAt: now,
      isOutbound: true,
      sentById: session.user.id,
    },
  });

  // Store outbound file attachments
  if (hasAttachments) {
    await db.supportAttachment.createMany({
      data: attachments.map((a) => ({
        messageId: message.id,
        gmailAttachmentId: `blob:${a.url}`,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
      })),
    });
  }

  return NextResponse.json({
    threadId: thread.id,
    messageId: message.id,
    gmailMessageId: sentMessageId,
  });
}
