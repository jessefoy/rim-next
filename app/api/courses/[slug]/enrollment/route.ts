import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/courses/[slug]/enrollment
 * Returns the current member's enrollment state for this course.
 * Requires auth. Returns null if not enrolled.
 */
export async function GET(
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
    select: { id: true, lessons: { select: { lessonId: true } } },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrollment = await db.seriesEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  });

  if (!enrollment) return NextResponse.json(null);

  const totalCount = course.lessons.length;
  const completedCount =
    totalCount > 0
      ? await db.lessonProgress.count({
          where: { userId, lessonId: { in: course.lessons.map((l) => l.lessonId) } },
        })
      : 0;

  return NextResponse.json({
    enrolled: true,
    enrollmentSource: enrollment.enrollmentSource,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    completedCount,
    totalCount,
  });
}
