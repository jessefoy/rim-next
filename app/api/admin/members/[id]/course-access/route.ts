import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// POST /api/admin/members/[id]/course-access — grant course access
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { courseSlug } = body as { courseSlug: string };

  if (!courseSlug?.trim()) {
    return NextResponse.json({ error: "courseSlug is required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const grant = await db.courseAccess.upsert({
    where: { userId_courseSlug: { userId: id, courseSlug: courseSlug.trim() } },
    update: { grantedBy: session.user.id },
    create: { userId: id, courseSlug: courseSlug.trim(), grantedBy: session.user.id },
  });

  return NextResponse.json(grant);
}

// DELETE /api/admin/members/[id]/course-access — revoke course access
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const courseSlug = searchParams.get("courseSlug");

  if (!courseSlug) {
    return NextResponse.json({ error: "courseSlug is required" }, { status: 400 });
  }

  try {
    await db.courseAccess.delete({
      where: { userId_courseSlug: { userId: id, courseSlug } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
