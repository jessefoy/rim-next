import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/courses/[slug]/enroll  — enroll in a series
 * DELETE /api/courses/[slug]/enroll — unenroll (removes enrollment record)
 */

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const userId = session.user.id;

  const course = await db.course.findUnique({
    where: { slug, isActive: true },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrollment = await db.seriesEnrollment.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    update: {}, // already enrolled — no-op
    create: { userId, courseId: course.id },
  });

  return NextResponse.json({ enrolled: true, enrolledAt: enrollment.enrolledAt });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const userId = session.user.id;

  const course = await db.course.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.seriesEnrollment.deleteMany({
    where: { userId, courseId: course.id },
  });

  return NextResponse.json({ enrolled: false });
}
