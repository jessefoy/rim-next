/**
 * GET  /api/support/threads/[id] — full thread detail
 * PATCH /api/support/threads/[id] — update status, assignedToId
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyAssigned } from "@/lib/supportNotify";

function hasSupport(roles: string[]) {
  return roles.some((r) => ["SUPPORT", "ADMIN"].includes(r));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupport(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const thread = await db.supportThread.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
          memberStatus: true,
          registrations: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              programTitle: true,
              programSlug: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        include: {
          sentBy: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
          fileAttachments: {
            select: { id: true, gmailAttachmentId: true, filename: true, mimeType: true, size: true },
          },
        },
      },
      notes: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
      },
    },
  });

  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Rewrite CID references in HTML to use our proxy route
  function rewriteCidRefs(
    html: string,
    gmailMessageId: string,
    attachments: any
  ): string {
    if (!attachments || !Array.isArray(attachments)) return html;
    let result = html;
    for (const att of attachments) {
      if (!att.cid || !att.attachmentId) continue;
      const proxyUrl = `/api/support/attachment/${gmailMessageId}/${att.attachmentId}?ct=${encodeURIComponent(att.mimeType || "image/png")}`;
      // Replace cid:xxx references (with or without quotes)
      result = result.replace(
        new RegExp(`(src=["'])cid:${att.cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(["'])`, "gi"),
        `$1${proxyUrl}$2`
      );
    }
    return result;
  }

  // Interleave messages and notes by timestamp for timeline view
  const timeline = [
    ...thread.messages.map((m) => ({
      type: "message" as const,
      id: m.id,
      gmailMessageId: m.gmailMessageId,
      fromEmail: m.fromEmail,
      fromName: m.fromName,
      bodyHtml: rewriteCidRefs(m.bodyHtml, m.gmailMessageId, m.attachments),
      bodyText: m.bodyText,
      sentAt: m.sentAt.toISOString(),
      isOutbound: m.isOutbound,
      sentBy: m.sentBy
        ? {
            name: m.sentBy.preferredName || [m.sentBy.firstName, m.sentBy.lastName].filter(Boolean).join(" ") || "Support",
          }
        : null,
      fileAttachments: m.fileAttachments.map((a) => ({
        id: a.id,
        gmailAttachmentId: a.gmailAttachmentId,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
      })),
    })),
    ...thread.notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      author: {
        name: n.author.preferredName || [n.author.firstName, n.author.lastName].filter(Boolean).join(" ") || "Unknown",
      },
    })),
  ].sort((a, b) => {
    const aTime = "sentAt" in a ? a.sentAt : a.createdAt;
    const bTime = "sentAt" in b ? b.sentAt : b.createdAt;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  return NextResponse.json({
    id: thread.id,
    gmailThreadId: thread.gmailThreadId,
    subject: thread.subject,
    status: thread.status,
    senderEmail: thread.senderEmail,
    senderName: thread.senderName,
    assignee: thread.assignedTo
      ? {
          id: thread.assignedTo.id,
          name: thread.assignedTo.preferredName || [thread.assignedTo.firstName, thread.assignedTo.lastName].filter(Boolean).join(" ") || "Unknown",
        }
      : null,
    member: thread.member
      ? {
          id: thread.member.id,
          name: [thread.member.firstName, thread.member.lastName].filter(Boolean).join(" ") || "Unknown",
          email: thread.member.email,
          memberSince: thread.member.createdAt.toISOString(),
          memberStatus: thread.member.memberStatus,
          registrations: thread.member.registrations.map((r) => ({
            id: r.id,
            programTitle: r.programTitle,
            programSlug: r.programSlug,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
          })),
        }
      : null,
    timeline,
    lastMessageAt: thread.lastMessageAt.toISOString(),
    createdAt: thread.createdAt.toISOString(),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupport(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, assignedToId } = body;

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (assignedToId !== undefined) data.assignedToId = assignedToId || null;

  // Get current thread to detect assignment changes
  const current = await db.supportThread.findUnique({
    where: { id },
    select: { assignedToId: true, subject: true },
  });

  const updated = await db.supportThread.update({
    where: { id },
    data,
    select: { id: true, status: true, assignedToId: true, subject: true },
  });

  // Notify new assignee if assignment changed (fire-and-forget)
  if (
    assignedToId &&
    assignedToId !== current?.assignedToId
  ) {
    notifyAssigned(id, updated.subject, assignedToId, session.user.id).catch(() => {});
  }

  return NextResponse.json(updated);
}
