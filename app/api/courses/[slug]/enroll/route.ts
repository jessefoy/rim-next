import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { EnrollmentSource } from "@prisma/client";

/**
 * POST   /api/courses/[slug]/enroll — free self-enroll in a course.
 * DELETE /api/courses/[slug]/enroll — unenroll (only allowed for SELF enrollments).
 *
 * Self-enroll gate (session 123, orthogonal-flags model):
 *   - course.allowSelfEnroll must be true
 *   - course.selfEnrollDanaRequired must be false (dana goes through Checkout — slice 4)
 *   - if course.requiredRoles is non-empty, user must hold at least one (ADMIN bypass)
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
  const userRoles = session.user.roles ?? [];
  const isAdmin = userRoles.includes("ADMIN");

  const course = await db.course.findUnique({
    where: { slug, isActive: true },
    select: {
      id: true,
      allowSelfEnroll: true,
      selfEnrollDanaRequired: true,
      requiredRoles: true,
    },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!course.allowSelfEnroll) {
    return NextResponse.json(
      { error: "This course doesn't support self-enrollment." },
      { status: 403 }
    );
  }

  if (course.selfEnrollDanaRequired) {
    return NextResponse.json(
      { error: "This course requires dana before enrollment. Use the checkout flow." },
      { status: 400 }
    );
  }

  if (course.requiredRoles.length > 0 && !isAdmin) {
    const hasRole = course.requiredRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return NextResponse.json(
        { error: "This course is offered to specific community members." },
        { status: 403 }
      );
    }
  }

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
