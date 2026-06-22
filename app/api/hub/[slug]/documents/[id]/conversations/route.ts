import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { canAccessDocument } from "@/lib/documentAuth";
import { sendHubConvNewThreadEmail } from "@/lib/email";

// GET /api/hub/[slug]/documents/[id]/conversations — list threads for a document
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id: docId } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!canAccessHub(member, session.user.roles ?? [])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.hubDocument.findUnique({
    where:  { id: docId },
    select: { hubId: true, label: true, addedById: true, visibility: true, placements: { select: { hubId: true } } },
  });
  if (!doc || doc.hubId !== hub.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Doc-level access: a COORDINATORS-visibility doc's comments must 404 for a
  // non-coordinator, even of the origin hub (reads the threads, and posts to them).
  if (!canAccessDocument(doc, {
    userId:      session.user.id,
    roles:       session.user.roles ?? [],
    memberships: member ? [{ hubId: hub.id, isCoordinator: member.isCoordinator }] : [],
  })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const threads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, documentId: docId, deletedAt: null },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ threads, documentLabel: doc.label });
}

// POST /api/hub/[slug]/documents/[id]/conversations — create a thread on a document
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id: docId } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!canAccessHub(member, session.user.roles ?? [])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.hubDocument.findUnique({
    where:  { id: docId },
    select: { hubId: true, label: true, addedById: true, visibility: true, placements: { select: { hubId: true } } },
  });
  if (!doc || doc.hubId !== hub.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Doc-level access: a COORDINATORS-visibility doc's comments must 404 for a
  // non-coordinator, even of the origin hub (reads the threads, and posts to them).
  if (!canAccessDocument(doc, {
    userId:      session.user.id,
    roles:       session.user.roles ?? [],
    memberships: member ? [{ hubId: hub.id, isCoordinator: member.isCoordinator }] : [],
  })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { title, body, notifyUserIds } = await req.json();
  if (!title?.trim() || !body) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  const thread = await db.hubConversationThread.create({
    data: {
      hubId:      hub.id,
      authorId:   session.user.id,
      title:      title.trim(),
      body,
      documentId: docId,
      status:     "OPEN",
    },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count: { select: { replies: true } },
    },
  });

  // Seed subscriptions: author + coordinators + explicitly picked members
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

  const recipientIds = subRows.filter((r) => r.userId !== session.user.id).map((r) => r.userId);
  const authorName   = session.user.name || session.user.email?.split("@")[0] || "Someone";
  const threadTitle  = title.trim();
  const hubName      = hub.name;
  const documentLabel = doc.label;

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
            to:            m.user.email!,
            firstName:     m.user.firstName,
            authorName,
            hubName,
            hubSlug:       slug,
            threadTitle,
            threadId:      thread.id,
            documentTitle: documentLabel,
          })
        )
    );
  });

  return NextResponse.json(thread, { status: 201 });
}
