/**
 * POST /api/support/threads/[id]/reply
 *
 * Send a reply via Gmail and record it as a SupportMessage.
 * From: support@rootedinmindfulness.org (the connected OAuth account).
 * Signature is appended from SupportSignature if the user has one.
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail";

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
  const { bodyHtml, bodyText } = await req.json();

  if (!bodyHtml && !bodyText) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  // Get thread + last message for threading headers
  const thread = await db.supportThread.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { gmailMessageId: true },
      },
    },
  });

  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  // Get sender's signature
  const signature = await db.supportSignature.findUnique({
    where: { userId: session.user.id },
  });

  // Build signature HTML
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

  const fullHtml = (bodyHtml || `<p>${bodyText}</p>`) + signatureHtml;
  const fullText = (bodyText || bodyHtml?.replace(/<[^>]+>/g, "") || "") +
    (signature
      ? `\n\n--\n${signature.name}\n${signature.role ? signature.role + "\n" : ""}${signature.tagline}\nRooted in Mindfulness · rootedinmindfulness.org`
      : "");

  // Get Gmail credential for From address
  const credential = await db.gmailCredential.findFirst();
  if (!credential) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 500 });
  }

  // Build email with threading headers
  const lastMessageId = thread.messages[0]?.gmailMessageId;
  const subject = thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`;

  const emailLines = [
    `From: ${credential.email}`,
    `To: ${thread.senderEmail}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=utf-8`,
  ];

  // Thread the reply using In-Reply-To and References
  if (lastMessageId) {
    // Gmail message IDs need to be wrapped in angle brackets for email headers
    const msgRef = `<${lastMessageId}@mail.gmail.com>`;
    emailLines.push(`In-Reply-To: ${msgRef}`);
    emailLines.push(`References: ${msgRef}`);
  }

  emailLines.push("", fullHtml);

  const rawEmail = emailLines.join("\r\n");
  const encodedEmail = Buffer.from(rawEmail).toString("base64url");

  // Send via Gmail API
  const gmail = await getGmailClient();
  const sendRes = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedEmail,
      threadId: thread.gmailThreadId,
    },
  });

  const sentMessageId = sendRes.data.id;
  if (!sentMessageId) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  // Record the outbound message
  const now = new Date();
  const message = await db.supportMessage.create({
    data: {
      gmailMessageId: sentMessageId,
      threadId: id,
      fromEmail: credential.email,
      fromName: signature?.name ?? "RIM Support",
      bodyHtml: fullHtml,
      bodyText: fullText,
      sentAt: now,
      isOutbound: true,
      sentById: session.user.id,
    },
  });

  // Update thread: lastMessageAt + auto-set WAITING if currently CLAIMED
  const updateData: Record<string, unknown> = { lastMessageAt: now };
  if (thread.status === "CLAIMED" || thread.status === "OPEN") {
    updateData.status = "WAITING";
  }
  // Auto-assign to sender if unassigned
  if (!thread.assignedToId) {
    updateData.assignedToId = session.user.id;
    updateData.status = "WAITING";
  }

  await db.supportThread.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    id: message.id,
    gmailMessageId: sentMessageId,
    sentAt: now.toISOString(),
  });
}
