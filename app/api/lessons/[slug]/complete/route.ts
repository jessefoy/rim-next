import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/lessons/[slug]/complete
 * Toggles the lesson complete/incomplete for the authenticated member.
 *
 * Body: { courseSlug?: string }
 * - If courseSlug is provided, checks that a SeriesEnrollment exists (403 if not).
 * - Toggle: LessonProgress exists → delete (incomplete); absent → create (complete).
 * - After toggling, updates SeriesEnrollment.completedAt:
 *   - On complete: if all lessons now done → set completedAt = now()
 *   - On incomplete: if completedAt was set → clear it (null)
 * Returns { completed: boolean, seriesCompleted: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const userId = session.user.id;

  const lesson = await db.lesson.findUnique({
    where: { slug },
    select: { id: true, courses: { select: { courseId: true } } },
  });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { courseSlug } = await request.json().catch(() => ({})) as { courseSlug?: string };

  // Resolve course if courseSlug provided — also gate on enrollment
  let course: { id: string; lessons: { lessonId: string }[]; completionNote: string | null } | null = null;
  if (courseSlug) {
    course = await db.course.findUnique({
      where: { slug: courseSlug },
      select: {
        id: true,
        lessons: { select: { lessonId: true } },
        completionNote: true,
      },
    });

    if (course) {
      const enrollment = await db.seriesEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
        select: { id: true },
      });
      if (!enrollment) {
        return NextResponse.json({ error: "Not enrolled in this series" }, { status: 403 });
      }
    }
  }

  // Toggle: if exists → delete (mark incomplete); if absent → create (mark complete)
  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
  });

  if (existing) {
    // Mark incomplete
    await db.lessonProgress.delete({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
    });

    // Clear completedAt if the series was previously marked complete
    if (course) {
      await db.seriesEnrollment.updateMany({
        where: { userId, courseId: course.id, completedAt: { not: null } },
        data: { completedAt: null },
      });
    }

    return NextResponse.json({ completed: false, seriesCompleted: false });
  }

  // Mark complete
  await db.lessonProgress.create({
    data: { userId, lessonId: lesson.id },
  });

  // Check if all lessons in the series are now complete
  if (course) {
    const enrollment = await db.seriesEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { completedAt: true },
    });

    if (enrollment && !enrollment.completedAt) {
      const lessonIds = course.lessons.map((cl) => cl.lessonId);
      const progressCount = await db.lessonProgress.count({
        where: { userId, lessonId: { in: lessonIds } },
      });
      if (progressCount === lessonIds.length) {
        await db.seriesEnrollment.update({
          where: { userId_courseId: { userId, courseId: course.id } },
          data: { completedAt: new Date() },
        });
        return NextResponse.json({
          completed: true,
          seriesCompleted: true,
          courseSlug,
          completionNote: course.completionNote ?? null,
        });
      }
    }
  }

  return NextResponse.json({ completed: true, seriesCompleted: false });
}
