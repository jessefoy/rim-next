import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN", "TEACHER"].includes(r))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const courses = await db.course.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      _count: { select: { lessons: true } },
    },
  });

  return NextResponse.json(courses);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN", "TEACHER"].includes(r))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { title, slug, subheading, description, accessLevel, hideFromMemberProfile, sortOrder, isActive } = body;

  if (!title || !slug) {
    return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await db.course.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A course with this slug already exists" }, { status: 409 });
  }

  const course = await db.course.create({
    data: {
      title,
      slug,
      subheading: subheading || null,
      description: description || null,
      accessLevel: accessLevel || "ALL_MEMBERS",
      hideFromMemberProfile: hideFromMemberProfile ?? false,
      sortOrder: sortOrder != null ? Number(sortOrder) : null,
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(course, { status: 201 });
}
