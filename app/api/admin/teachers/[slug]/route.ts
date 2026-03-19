import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;

  const teacher = await db.teacher.findUnique({
    where: { slug },
    select: {
      id: true, name: true, slug: true, bio: true, photoUrl: true, isActive: true, createdAt: true,
      userId: true,
      user: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const linkedMemberName = teacher.user
    ? [teacher.user.preferredName || teacher.user.firstName, teacher.user.lastName].filter(Boolean).join(" ")
    : null;

  return NextResponse.json({ ...teacher, linkedMemberName });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;
  const body = await request.json();

  const teacher = await db.teacher.findUnique({ where: { slug } });
  if (!teacher) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.slug !== undefined) {
    if (body.slug !== slug) {
      const existing = await db.teacher.findUnique({ where: { slug: body.slug } });
      if (existing) {
        return NextResponse.json({ error: "A teacher with this slug already exists" }, { status: 409 });
      }
    }
    updateData.slug = body.slug;
  }
  if (body.bio !== undefined) updateData.bio = body.bio ?? null;
  if (body.photoUrl !== undefined) updateData.photoUrl = body.photoUrl ?? null;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if ("userId" in body) updateData.userId = body.userId ?? null;

  const updated = await db.teacher.update({
    where: { slug },
    data: updateData,
  });

  return NextResponse.json(updated);
}
