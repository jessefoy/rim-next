import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles ?? [];
  return roles.includes("ADMIN");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const pages = await db.page.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, status: true, updatedAt: true },
  });
  return NextResponse.json({
    pages: pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  const slug =
    typeof raw.slug === "string" && raw.slug.trim() ? slugify(raw.slug) : slugify(title);
  if (!slug) {
    return NextResponse.json({ error: "Couldn't derive a slug from the title." }, { status: 400 });
  }

  const existing = await db.page.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: "A page with that slug already exists.", existingId: existing.id },
      { status: 409 }
    );
  }

  try {
    const page = await db.page.create({
      data: {
        slug,
        title,
        status: "DRAFT",
        content: { version: 1, sections: [] } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: page.id }, { status: 201 });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "A page with that slug already exists." }, { status: 409 });
    }
    console.error("[admin/pages POST] create failed", err);
    return NextResponse.json({ error: "Couldn't create the page. Please try again." }, { status: 500 });
  }
}
