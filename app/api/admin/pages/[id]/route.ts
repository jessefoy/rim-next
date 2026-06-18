import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles ?? [];
  return roles.includes("ADMIN");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    content: page.content,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    updatedAt: page.updatedAt.toISOString(),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;

  const data: Prisma.PageUpdateInput = {};

  if (typeof raw.title === "string") {
    const t = raw.title.trim();
    if (!t) return NextResponse.json({ error: "Title can't be empty." }, { status: 400 });
    data.title = t;
  }
  if (typeof raw.status === "string") {
    if (raw.status !== "DRAFT" && raw.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    data.status = raw.status;
  }
  if (raw.content !== undefined) {
    const c = raw.content as { sections?: unknown } | null;
    if (!c || typeof c !== "object" || !Array.isArray(c.sections)) {
      return NextResponse.json({ error: "Invalid page content." }, { status: 400 });
    }
    data.content = raw.content as Prisma.InputJsonValue;
  }
  if (typeof raw.seoTitle === "string") {
    data.seoTitle = raw.seoTitle.trim() || null;
  }
  if (typeof raw.seoDescription === "string") {
    data.seoDescription = raw.seoDescription.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await db.page.update({
      where: { id },
      data,
      select: { id: true, updatedAt: true },
    });
    return NextResponse.json({ ok: true, id: updated.id, updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[admin/pages PUT] update failed", err);
    return NextResponse.json({ error: "Couldn't save. Please try again." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await db.page.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[admin/pages DELETE] delete failed", err);
    return NextResponse.json({ error: "Couldn't delete. Please try again." }, { status: 500 });
  }
}
