/**
 * GET  /api/support/threads/[id] — full thread detail
 * PATCH /api/support/threads/[id] — update status, assignedToId
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

  // Interleave messages and notes by timestamp for timeline view
  const timeline = [
    ...thread.messages.map((m) => ({
      type: "message" as const,
      id: m.id,
      fromEmail: m.fromEmail,
      fromName: m.fromName,
      bodyHtml: m.bodyHtml,
      bodyText: m.bodyText,
      sentAt: m.sentAt.toISOString(),
      isOutbound: m.isOutbound,
      sentBy: m.sentBy
        ? {
            id: m.sentBy.id,
            firstName: m.sentBy.firstName,
            lastName: m.sentBy.lastName,
            preferredName: m.sentBy.preferredName,
          }
        : null,
    })),
    ...thread.notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      author: {
        id: n.author.id,
        firstName: n.author.firstName,
        lastName: n.author.lastName,
        preferredName: n.author.preferredName,
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
    assignedTo: thread.assignedTo
      ? {
          id: thread.assignedTo.id,
          firstName: thread.assignedTo.firstName,
          lastName: thread.assignedTo.lastName,
          preferredName: thread.assignedTo.preferredName,
        }
      : null,
    member: thread.member
      ? {
          id: thread.member.id,
          firstName: thread.member.firstName,
          lastName: thread.member.lastName,
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

  const updated = await db.supportThread.update({
    where: { id },
    data,
    select: { id: true, status: true, assignedToId: true },
  });

  return NextResponse.json(updated);
}
