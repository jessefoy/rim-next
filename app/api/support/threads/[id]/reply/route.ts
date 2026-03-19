/**
 * POST /api/support/threads/[id]/reply
 *
 * Send a reply via Gmail and record it as a SupportMessage.
 * From: support@rootedinmindfulness.org (the connected OAuth account).
 * Signature is appended from SupportSignature if the user has one.
 * Supports file attachments via Vercel Blob URLs.
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";

function hasSupport(roles: string[]) {
  return roles.some((r) => ["SUPPORT", "ADMIN"].includes(r));
}

/** Escape user-controlled strings before interpolating into email HTML. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Validate that a URL is a legitimate Vercel Blob URL (prevents SSRF). */
function isSafeBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB per attachment

interface AttachmentInput {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
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
  const { body: bodyJson, bodyHtml: legacyBodyHtml, bodyText, attachments } = await req.json() as {
    body?: any;
    bodyHtml?: string;
    bodyText?: string;
    attachments?: AttachmentInput[];
  };

  if (!bodyJson && !legacyBodyHtml && !bodyText) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  // Render body to HTML: new BlockNote JSON path or legacy HTML path
  const bodyHtml = bodyJson
    ? await renderFormattedTextAsync(bodyJson)
    : (legacyBodyHtml ?? null);

  // Get thread + last message for threading headers
  const thread = await db.supportThread.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      status: true,
      senderEmail: true,
      gmailThreadId: true,
      assignedToId: true,
      deletedAt: true,
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { gmailMessageId: true },
      },
    },
  });

  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  if (thread.deletedAt) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  // Get sender's signature
  const signature = await db.supportSignature.findUnique({
    where: { userId: session.user.id },
  });

  // Build signature HTML — escape fields to prevent XSS via stored signature content
  let signatureHtml = "";
  if (signature) {
    const safeName = escapeHtml(signature.name);
    const safeRole = signature.role ? escapeHtml(signature.role) : "";
    const safeTagline = escapeHtml(signature.tagline);
    signatureHtml = `
      <br><br>
      <div style="color:#666;font-size:14px;border-top:1px solid #ddd;padding-top:12px;margin-top:12px;">
        <strong>${safeName}</strong><br>
        ${safeRole ? `${safeRole}<br>` : ""}
        ${safeTagline}<br>
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

  // Build email
  const lastMessageId = thread.messages[0]?.gmailMessageId;
  const subject = thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`;
  const hasAttachments = attachments && attachments.length > 0;
  const boundary = `----RIM_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  let rawEmail: string;

  if (hasAttachments) {
    // Multipart MIME with attachments
    const headerLines = [
      `From: ${credential.email}`,
      `To: ${thread.senderEmail}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ];

    if (lastMessageId) {
      const msgRef = `<${lastMessageId}@mail.gmail.com>`;
      headerLines.push(`In-Reply-To: ${msgRef}`);
      headerLines.push(`References: ${msgRef}`);
    }

    // Body part
    const parts = [
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(fullHtml).toString("base64"),
    ];

    // Download and attach each file from Vercel Blob
    for (const att of attachments) {
      // SSRF guard: only fetch from known Vercel Blob domain
      if (!isSafeBlobUrl(att.url)) continue;
      const fileRes = await fetch(att.url);
      if (!fileRes.ok) continue;
      // Size guard: reject oversized files before buffering
      const contentLength = fileRes.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_ATTACHMENT_BYTES) continue;
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
    // Simple email without attachments
    const emailLines = [
      `From: ${credential.email}`,
      `To: ${thread.senderEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
    ];

    if (lastMessageId) {
      const msgRef = `<${lastMessageId}@mail.gmail.com>`;
      emailLines.push(`In-Reply-To: ${msgRef}`);
      emailLines.push(`References: ${msgRef}`);
    }

    emailLines.push("", fullHtml);
    rawEmail = emailLines.join("\r\n");
  }

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

  // Store outbound file attachments as SupportAttachment records
  if (hasAttachments) {
    await db.supportAttachment.createMany({
      data: attachments.map((a) => ({
        messageId: message.id,
        gmailAttachmentId: `blob:${a.url}`, // Track Blob URL as reference
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
      })),
    });
  }

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
