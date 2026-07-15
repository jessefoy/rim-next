import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";

/**
 * GET — returns the subscriber list for this thread and the eligible hub
 * members (active, communicationsEnabled, excluding self) so the "Also notify"
 * panel can disable already-subscribed people.
 *
 * Response: { members, subscriptions: { userId, source, subscribedAt }[],
 *             currentUserSubscribed: boolean }
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!hub || (!canAccessHub(member, session.user.roles ?? [], hub?.openToAllMembers))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thread = await db.hubConversationThread.findFirst({ where: { id, hubId: hub.id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [hubMembers, subRows] = await Promise.all([
    db.hubMember.findMany({
      where: {
        hubId:                 hub.id,
        status:                "ACTIVE",
        communicationsEnabled: true,
        userId:                { not: session.user.id },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    }),
    db.hubThreadSubscription.findMany({
      where:  { threadId: id },
      select: { userId: true, source: true, subscribedAt: true },
      orderBy: { subscribedAt: "asc" },
    }),
  ]);

  const subscriptions = subRows.map((s) => ({
    userId:       s.userId,
    source:       s.source,
    subscribedAt: s.subscribedAt.toISOString(),
  }));
  const currentUserSubscribed = subRows.some((s) => s.userId === session.user.id);

  const members = hubMembers.map((m) => ({
    id:            m.userId,
    firstName:     m.user.firstName,
    lastName:      m.user.lastName,
    preferredName: m.user.preferredName,
  }));

  return NextResponse.json({ members, subscriptions, currentUserSubscribed });
}

/**
 * POST — self-subscribe the current user (idempotent).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!hub || (!canAccessHub(member, session.user.roles ?? [], hub?.openToAllMembers))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thread = await db.hubConversationThread.findFirst({ where: { id, hubId: hub.id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.hubThreadSubscription.upsert({
    where:  { threadId_userId: { threadId: id, userId: session.user.id } },
    update: {},
    create: { threadId: id, userId: session.user.id, source: "SELF" },
  });

  return NextResponse.json({ subscribed: true });
}

/**
 * DELETE — unsubscribe the current user (idempotent).
 * Authors can unsubscribe themselves too; they'll stop receiving reply emails
 * but the thread still belongs to them. (Matches Basecamp.)
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!hub || (!canAccessHub(member, session.user.roles ?? [], hub?.openToAllMembers))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.hubThreadSubscription.deleteMany({
    where: { threadId: id, userId: session.user.id },
  });

  return NextResponse.json({ subscribed: false });
}
