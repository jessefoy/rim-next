import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const teachers = await db.teacher.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, bio: true, photoUrl: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(teachers);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug: rawSlug, bio, photoUrl, isActive } = body;

  if (!name || !rawSlug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const slug = slugify(rawSlug || name);

  const existing = await db.teacher.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A teacher with this slug already exists" }, { status: 409 });
  }

  const teacher = await db.teacher.create({
    data: {
      name,
      slug,
      bio: bio ?? null,
      photoUrl: photoUrl ?? null,
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(teacher, { status: 201 });
}
