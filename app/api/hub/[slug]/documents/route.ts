import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";
import { sendHubDocumentCreatedEmail } from "@/lib/email";

const BASE_URL = (process.env.NEXTAUTH_URL ?? "").trim().replace(/\/$/, "");

// GET /api/hub/[slug]/documents
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const documents = await db.hubDocument.findMany({
    // Trash never surfaces here — see /api/hub/[slug]/trash for managers.
    where:   { hubId: hub.id, deletedAt: null },
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents, documentCategories: hub.documentCategories });
}

// POST /api/hub/[slug]/documents — any hub member can create
// Accepts external link docs ({ label, url, fileType, ... }), native docs ({ label, body, isNative: true }),
// or uploaded file docs ({ label, url, fileType: "PDF", ... }).
// Optional: notifyUserIds — array of userId strings to notify after creation.
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

  const { label, url, description, fileType, category, newCategory, body, isNative, notifyUserIds } = await req.json();

  if (!label?.trim()) {
    return NextResponse.json({ error: "Label required" }, { status: 400 });
  }
  if (!isNative && !url?.trim()) {
    return NextResponse.json({ error: "Label and URL required" }, { status: 400 });
  }

  // Handle "add new category" inline flow
  let resolvedCategory: string | null = category ?? null;
  if (newCategory?.trim()) {
    resolvedCategory = newCategory.trim();
    await db.hub.update({
      where: { id: hub.id },
      data:  { documentCategories: { push: resolvedCategory as string } },
    });
  }

  const doc = await db.hubDocument.create({
    data: {
      hubId:       hub.id,
      addedById:   session.user.id,
      label:       label.trim(),
      url:         isNative ? null : (url?.trim() ?? null),
      description: description?.trim() || null,
      fileType:    isNative ? "DOC" : (fileType ?? "LINK"),
      category:    resolvedCategory,
      body:        isNative ? (body ?? null) : null,
      isNative:    isNative ?? false,
    },
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
  });

  // Fire notifications after response
  const validUserIds: string[] = Array.isArray(notifyUserIds) ? notifyUserIds : [];
  if (validUserIds.length > 0) {
    const authorName = session.user.name || session.user.email?.split("@")[0] || "Someone";
    const docUrl = `${BASE_URL}/account/hub/${slug}/documents/${doc.id}`;

    after(async () => {
      // Verify recipients are active hub members with communicationsEnabled
      const eligible = await db.hubMember.findMany({
        where: {
          hubId:                 hub.id,
          userId:                { in: validUserIds, not: session.user.id },
          status:                "ACTIVE",
          communicationsEnabled: true,
        },
        include: { user: { select: { id: true, email: true, firstName: true } } },
      });

      if (eligible.length === 0) return;

      // Defensive dedup against (docId, userId, "created") — protects against
      // accidental double-submits and keeps the contract identical to the
      // standalone /notify path.
      const existing = await db.hubDocumentNotification.findMany({
        where: {
          documentId: doc.id,
          userId:     { in: eligible.map((m) => m.userId) },
          eventType:  "created",
        },
        select: { userId: true },
      });
      const alreadyNotified = new Set(existing.map((n) => n.userId));
      const toNotify = eligible.filter((m) => !alreadyNotified.has(m.userId));

      if (toNotify.length === 0) return;

      await db.hubDocumentNotification.createMany({
        data: toNotify.map((m) => ({
          documentId: doc.id,
          userId:     m.userId,
          eventType:  "created",
        })),
      });

      await Promise.allSettled(
        toNotify
          .filter((m) => m.user.email)
          .map((m) =>
            sendHubDocumentCreatedEmail({
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
  }

  return NextResponse.json(doc, { status: 201 });
}
