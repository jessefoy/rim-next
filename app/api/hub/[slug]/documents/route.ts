import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership } from "@/lib/hubAuth";

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
    where:   { hubId: hub.id },
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents, documentCategories: hub.documentCategories });
}

// POST /api/hub/[slug]/documents — any hub member can create
// Accepts external link docs ({ label, url, fileType, ... }) or native docs ({ label, body, isNative: true })
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

  const { label, url, description, fileType, category, newCategory, body, isNative } = await req.json();

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

  return NextResponse.json(doc, { status: 201 });
}
