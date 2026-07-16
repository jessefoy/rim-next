import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
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
  if ((!hub?.conversationsEnabled || !canAccessHub(member, session.user.roles ?? [], hub?.openToAllMembers))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "OPEN";

  // Translate the legacy ?status= param to the canonical archivedAt filter:
  //   "OPEN"   (default) — non-archived threads (active feed)
  //   "CLOSED"           — archived threads (the "Archived" tab in HubConvClient)
  // Trashed threads (deletedAt set) never appear here regardless of param —
  // they live at /trash.
  const archiveFilter =
    statusParam === "CLOSED"
      ? { archivedAt: { not: null } }
      : { archivedAt: null };

  const threads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, deletedAt: null, ...archiveFilter },
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
  if ((!hub?.conversationsEnabled || !canAccessHub(member, session.user.roles ?? [], hub?.openToAllMembers))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, body, category, notifyUserIds } = await req.json();
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

  // Seed subscriptions: author (always), all coordinators of this hub, and
  // any members the author explicitly picked in the "Also notify" panel.
  // The author is the source of truth for *initial* subscribers; once threaded,
  // anyone can be added via reply pickers or self-subscribe.
  const coords = await db.hubMember.findMany({
    where:  { hubId: hub.id, isCoordinator: true, status: "ACTIVE" },
    select: { userId: true },
  });
  const pickedIds: string[] = Array.isArray(notifyUserIds) ? notifyUserIds : [];

  const subRows: Array<{ threadId: string; userId: string; source: string }> = [
    { threadId: thread.id, userId: session.user.id, source: "AUTHOR" },
  ];
  const seen = new Set<string>([session.user.id]);
  for (const c of coords) {
    if (seen.has(c.userId)) continue;
    seen.add(c.userId);
    subRows.push({ threadId: thread.id, userId: c.userId, source: "COORDINATOR_AUTO" });
  }
  for (const uid of pickedIds) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    subRows.push({ threadId: thread.id, userId: uid, source: "ADDED" });
  }
  await db.hubThreadSubscription.createMany({ data: subRows, skipDuplicates: true });

  // Email everyone subscribed (except the author) who's an active hub member
  // with communicationsEnabled. Use after() for fire-and-forget reliability —
  // the .then() pattern from before could be dropped by Vercel teardown.
  const recipientIds = subRows.filter((r) => r.userId !== session.user.id).map((r) => r.userId);
  const authorName = session.user.name || session.user.email?.split("@")[0] || "Someone";
  const threadTitle = title.trim();
  const hubName = hub.name;

  after(async () => {
    if (recipientIds.length === 0) return;
    const eligible = await db.hubMember.findMany({
      where: {
        hubId:                 hub.id,
        userId:                { in: recipientIds },
        status:                "ACTIVE",
        communicationsEnabled: true,
      },
      include: { user: { select: { email: true, firstName: true } } },
    });
    await Promise.allSettled(
      eligible
        .filter((m) => m.user.email)
        .map((m) =>
          sendHubConvNewThreadEmail({
            to: m.user.email!,
            firstName: m.user.firstName,
            authorName,
            hubName,
            hubSlug: slug,
            threadTitle,
            threadId: thread.id,
          })
        )
    );
  });

  return NextResponse.json(thread, { status: 201 });
}
