/**
 * GET  /api/programs-pg/categories — List all categories (REGISTRAR | ADMIN)
 * POST /api/programs-pg/categories — Create a category (ADMIN only)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const categories = await db.programCategory.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden — ADMIN only" }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  const existing = await db.programCategory.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A category with this slug already exists" }, { status: 409 });
  }

  const category = await db.programCategory.create({
    data: {
      name,
      slug,
      hideFromProgramsPage: body.hideFromProgramsPage ?? false,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
