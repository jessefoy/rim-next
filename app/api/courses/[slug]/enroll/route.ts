import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { EnrollmentSource } from "@prisma/client";

/**
 * POST /api/courses/[slug]/enroll  — enroll in a series
 * DELETE /api/courses/[slug]/enroll — unenroll (only allowed for SELF enrollments)
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
    create: { userId, courseId: course.id, enrollmentSource: EnrollmentSource.SELF },
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

  // Check enrollment source before deleting
  const existing = await db.seriesEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { enrollmentSource: true },
  });

  if (!existing) return NextResponse.json({ enrolled: false });

  if (existing.enrollmentSource !== EnrollmentSource.SELF) {
    return NextResponse.json(
      { error: "This enrollment can only be removed by an administrator." },
      { status: 403 }
    );
  }

  await db.seriesEnrollment.deleteMany({
    where: { userId, courseId: course.id },
  });

  return NextResponse.json({ enrolled: false });
}
