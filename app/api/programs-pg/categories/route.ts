/**
 * GET    /api/programs-pg/categories — List all categories in sort order
 * POST   /api/programs-pg/categories — Create a category (auto slug + sortOrder)
 * PATCH  /api/programs-pg/categories — Update a category's kind (and name)
 * DELETE /api/programs-pg/categories — Delete a category (reassigns programs to null)
 * Requires REGISTRAR or ADMIN role.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isValidKind } from "@/lib/programKind";

function requireRole(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return roles.includes("ADMIN") || roles.includes("REGISTRAR");
}

export async function GET() {
  const session = await auth();
  if (!requireRole(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const categories = await db.programCategory.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!requireRole(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, kind } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (kind != null && !isValidKind(kind)) {
    return NextResponse.json({ error: "Unknown category kind" }, { status: 400 });
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const existing = await db.programCategory.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "A category with this slug already exists" }, { status: 409 });

  const maxOrder = await db.programCategory.aggregate({ _max: { sortOrder: true } });
  const nextOrder = (maxOrder._max.sortOrder ?? 0) + 1;

  const category = await db.programCategory.create({
    data: { name: name.trim(), slug, sortOrder: nextOrder, kind: kind ?? null },
  });

  return NextResponse.json(category, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!requireRole(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, kind, name } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (kind !== undefined && kind !== null && !isValidKind(kind)) {
    return NextResponse.json({ error: "Unknown category kind" }, { status: 400 });
  }

  const data: { kind?: string | null; name?: string } = {};
  if (kind !== undefined) data.kind = kind ?? null;
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const category = await db.programCategory.update({ where: { id }, data });
  return NextResponse.json(category);
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!requireRole(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Check if any programs are assigned to this category
  const programCount = await db.program.count({ where: { categoryId: id, archivedAt: null } });
  if (programCount > 0) {
    return NextResponse.json({
      error: `This category has ${programCount} program${programCount !== 1 ? "s" : ""} assigned to it. Reassign them to another category first.`,
    }, { status: 409 });
  }

  await db.programCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
