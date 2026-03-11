import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator } from "@/lib/hubAuth";

// POST /api/hub/[slug]/announcements/[id]/thread
// Create a conversation thread from an announcement (coordinator only)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    requireCoordinator(member.isCoordinator, session.user.roles ?? []);
  } catch {
    return NextResponse.json({ error: "Coordinators only" }, { status: 403 });
  }

  const ann = await db.hubAnnouncement.findFirst({ where: { id, hubId: hub.id } });
  if (!ann) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ann.linkedThreadId) return NextResponse.json({ error: "Thread already exists", threadId: ann.linkedThreadId }, { status: 409 });

  // Create thread then link it on the announcement
  const thread = await db.hubConversationThread.create({
    data: {
      hubId:                hub.id,
      authorId:             session.user.id,
      title:                ann.title,
      category:             hub.conversationCategories[0] ?? "General",
      sourceAnnouncementId: ann.id,
    },
  });

  await db.hubAnnouncement.update({ where: { id }, data: { linkedThreadId: thread.id } });

  return NextResponse.json({ threadId: thread.id }, { status: 201 });
}
