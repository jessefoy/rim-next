import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { hasToolAccess } from "@/lib/toolAuth";

/**
 * /api/courses/categories — Course category CRUD.
 *
 * GET    — public, returns categories with at least one visible course
 * GET ?all=true — auth (TEACHER/ADMIN), returns ALL categories incl. unused
 * POST   — auth (TEACHER/ADMIN), { name, sortOrder? }
 * PATCH  — auth (TEACHER/ADMIN), { id, name? sortOrder? }
 * DELETE — auth (TEACHER/ADMIN), ?id=… — refuses if any course is linked
 *
 * Slugs are auto-generated from name on create; not user-editable. Renames
 * preserve the slug to keep any future external links stable.
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const wantAll = url.searchParams.get("all") === "true";

  if (wantAll) {
    // Admin view — every category, including empty ones, with their counts.
    const session = await auth();
    if (
      !session?.user?.id ||
      !(await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const cats = await db.courseCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        _count: { select: { courses: true } },
      },
    });
    return NextResponse.json(cats);
  }

  // Public path — only categories that have at least one visible course.
  const cats = await db.courseCategory.findMany({
    where: {
      courses: {
        some: { isActive: true, isOnboarding: false },
      },
    },
    select: { id: true, name: true, slug: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(cats);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (
    !session?.user?.id ||
    !(await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let slug = slugify(name);
  if (!slug) slug = `category-${Date.now()}`;

  // Slug uniqueness — append a numeric suffix if collision.
  const existing = await db.courseCategory.findUnique({ where: { slug } });
  if (existing) {
    let n = 2;
    let candidate = `${slug}-${n}`;
    while (await db.courseCategory.findUnique({ where: { slug: candidate } })) {
      n++;
      candidate = `${slug}-${n}`;
    }
    slug = candidate;
  }

  const created = await db.courseCategory.create({
    data: {
      name,
      slug,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    },
    select: { id: true, name: true, slug: true, sortOrder: true },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (
    !session?.user?.id ||
    !(await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    data.name = trimmed;
  }
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await db.courseCategory.update({
    where: { id },
    data,
    select: { id: true, name: true, slug: true, sortOrder: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (
    !session?.user?.id ||
    !(await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }

  // Refuse to delete a category that still has courses assigned — the admin
  // should reassign them first (or empty the field). Mirrors Program's
  // category-deletion guard.
  const linked = await db.course.count({ where: { categoryId: id } });
  if (linked > 0) {
    return NextResponse.json(
      {
        error: `This category has ${linked} course${linked === 1 ? "" : "s"} assigned. Reassign them first.`,
      },
      { status: 409 }
    );
  }

  await db.courseCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
