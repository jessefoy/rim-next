import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";

// GET /api/hub/[slug]/conversations — list threads
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "OPEN";

  const threads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, status },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count:  { select: { replies: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(threads);
}

// POST /api/hub/[slug]/conversations — create thread (any member)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, body, sourceAnnouncementId } = await req.json();
  if (!title?.trim() || !body) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  // If sourced from an announcement, verify no thread yet
  if (sourceAnnouncementId) {
    const ann = await db.hubAnnouncement.findUnique({ where: { id: sourceAnnouncementId } });
    if (ann?.linkedThreadId) {
      return NextResponse.json({ error: "Thread already exists for this announcement" }, { status: 409 });
    }
  }

  const thread = await db.hubConversationThread.create({
    data: {
      hubId:                hub.id,
      authorId:             session.user.id,
      title:                title.trim(),
      body,
      status:               "OPEN",
      sourceAnnouncementId: sourceAnnouncementId ?? null,
    },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count:  { select: { replies: true } },
    },
  });

  // Link announcement → thread
  if (sourceAnnouncementId) {
    await db.hubAnnouncement.update({
      where: { id: sourceAnnouncementId },
      data:  { linkedThreadId: thread.id },
    });
  }

  return NextResponse.json(thread, { status: 201 });
}
