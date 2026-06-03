import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { canAccessHub, effectiveCoordinator, getHubMembership } from "@/lib/hubAuth";
import { sendHubDocumentCreatedEmail, sendHubDocumentUpdatedEmail } from "@/lib/email";

const BASE_URL = (process.env.NEXTAUTH_URL ?? "").trim().replace(/\/$/, "");

// GET /api/hub/[slug]/documents/[id]/notify
// Returns hub members eligible for notification and the set of userIds
// already notified for this document. Used to populate the Notify panel.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!hub || (!canAccessHub(member, session.user.roles ?? []))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Eligible: active hub members with communicationsEnabled, excluding self
  const hubMembers = await db.hubMember.findMany({
    where: {
      hubId:                 hub.id,
      status:                "ACTIVE",
      communicationsEnabled: true,
      userId:                { not: session.user.id },
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });

  // All notifications for this document — caller groups by eventType.
  // Ordered ascending so reducing on userId+eventType keeps the FIRST send
  // (the earliest notification is what the user gets credit for).
  const notificationRows = await db.hubDocumentNotification.findMany({
    where:  { documentId: id },
    select: { userId: true, eventType: true, notifiedAt: true },
    orderBy: { notifiedAt: "asc" },
  });
  const notifications = notificationRows.map((n) => ({
    userId:     n.userId,
    eventType:  n.eventType,
    notifiedAt: n.notifiedAt.toISOString(),
  }));

  const members = hubMembers.map((m) => ({
    id:           m.userId,
    firstName:    m.user.firstName,
    lastName:     m.user.lastName,
    preferredName: m.user.preferredName,
  }));

  return NextResponse.json({ members, notifications });
}

// POST /api/hub/[slug]/documents/[id]/notify
// Sends notifications to the specified userIds. Author or coordinator only.
// Body: { userIds: string[], eventType: "created" | "updated" }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!canAccessHub(member, session.user.roles ?? [])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.hubDocument.findFirst({ where: { id, hubId: hub.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only author or coordinator can send notifications
  const isAuthor = doc.addedById === session.user.id;
  const isCoord  = effectiveCoordinator(member, session.user.roles ?? []);
  if (!isAuthor && !isCoord) {
    return NextResponse.json({ error: "Only the author or a coordinator can send notifications" }, { status: 403 });
  }

  const { userIds, eventType = "created" } = await req.json();
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds required" }, { status: 400 });
  }

  const authorName = session.user.name || session.user.email?.split("@")[0] || "Someone";
  const docUrl = `${BASE_URL}/account/hub/${slug}/documents/${id}`;

  const normalizedEventType = eventType === "updated" ? "updated" : "created";

  after(async () => {
    const eligible = await db.hubMember.findMany({
      where: {
        hubId:                 hub.id,
        userId:                { in: userIds, not: session.user.id },
        status:                "ACTIVE",
        communicationsEnabled: true,
      },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });

    if (eligible.length === 0) return;

    // Dedup against existing (documentId, userId, eventType) — Basecamp pattern:
    // once you've gotten a "created" alert for this doc, you never get another.
    const existing = await db.hubDocumentNotification.findMany({
      where: {
        documentId: id,
        userId:     { in: eligible.map((m) => m.userId) },
        eventType:  normalizedEventType,
      },
      select: { userId: true },
    });
    const alreadyNotified = new Set(existing.map((n) => n.userId));
    const toNotify = eligible.filter((m) => !alreadyNotified.has(m.userId));

    if (toNotify.length === 0) return;

    await db.hubDocumentNotification.createMany({
      data: toNotify.map((m) => ({
        documentId: id,
        userId:     m.userId,
        eventType:  normalizedEventType,
      })),
    });

    const sendFn = normalizedEventType === "updated" ? sendHubDocumentUpdatedEmail : sendHubDocumentCreatedEmail;

    await Promise.allSettled(
      toNotify
        .filter((m) => m.user.email)
        .map((m) =>
          sendFn({
            to:         m.user.email!,
            firstName:  m.user.firstName,
            authorName,
            hubName:    hub.name,
            docLabel:   doc.label,
            docUrl,
          })
        )
    );
  });

  return NextResponse.json({ ok: true, count: userIds.length });
}
