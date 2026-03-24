import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";
import { sendHubConvNewThreadEmail } from "@/lib/email";

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
    orderBy: [
      { isPinned: "desc" },
      { pinnedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
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

  const { title, body, category } = await req.json();
  if (!title?.trim() || !body) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  const thread = await db.hubConversationThread.create({
    data: {
      hubId:    hub.id,
      authorId: session.user.id,
      title:    title.trim(),
      body,
      category: category || "General",
      status:   "OPEN",
    },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count:  { select: { replies: true } },
    },
  });

  // Fire-and-forget: notify coordinators
  const authorName = session.user.name || session.user.email?.split("@")[0] || "Someone";
  db.hubMember.findMany({
    where: { hubId: hub.id, isCoordinator: true, userId: { not: session.user.id } },
    include: { user: { select: { email: true, firstName: true } } },
  }).then((coords) => {
    for (const coord of coords) {
      if (coord.user.email) {
        sendHubConvNewThreadEmail({
          to: coord.user.email,
          firstName: coord.user.firstName,
          authorName,
          hubName: hub.name,
          hubSlug: slug,
          threadTitle: title.trim(),
          threadId: thread.id,
        }).catch(() => {});
      }
    }
  }).catch(() => {});

  return NextResponse.json(thread, { status: 201 });
}
