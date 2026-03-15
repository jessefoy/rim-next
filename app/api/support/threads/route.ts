/**
 * GET /api/support/threads
 *
 * List support threads with filtering.
 * Query params: status, assignedTo=me, search, resolved (boolean)
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.some((r) => ["SUPPORT", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const assignedTo = searchParams.get("assignedTo");
  const search = searchParams.get("search");

  const where: Prisma.SupportThreadWhereInput = {};

  // Status filter
  if (status) {
    where.status = status as "OPEN" | "CLAIMED" | "WAITING" | "RESOLVED";
  } else {
    // Default: show OPEN + CLAIMED + WAITING (not RESOLVED)
    where.status = { in: ["OPEN", "CLAIMED", "WAITING"] };
  }

  // Assigned to me
  if (assignedTo === "me") {
    where.assignedToId = session.user.id;
  }

  // Search by subject or sender
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { senderName: { contains: search, mode: "insensitive" } },
      { senderEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  const threads = await db.supportThread.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      member: { select: { id: true, firstName: true, lastName: true } },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { bodyText: true, sentAt: true, isOutbound: true },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });

  const serialized = threads.map((t) => {
    const lastMessage = t.messages[0];
    const snippet = lastMessage?.bodyText
      ? lastMessage.bodyText.substring(0, 120).replace(/\n/g, " ")
      : "";

    return {
      id: t.id,
      gmailThreadId: t.gmailThreadId,
      subject: t.subject,
      status: t.status,
      senderEmail: t.senderEmail,
      senderName: t.senderName,
      assignedTo: t.assignedTo
        ? {
            id: t.assignedTo.id,
            firstName: t.assignedTo.firstName,
            lastName: t.assignedTo.lastName,
            preferredName: t.assignedTo.preferredName,
          }
        : null,
      member: t.member
        ? { id: t.member.id, firstName: t.member.firstName, lastName: t.member.lastName }
        : null,
      messageCount: t._count.messages,
      snippet,
      lastMessageAt: t.lastMessageAt.toISOString(),
      lastOutbound: lastMessage?.isOutbound ?? false,
      createdAt: t.createdAt.toISOString(),
    };
  });

  return NextResponse.json(serialized);
}
