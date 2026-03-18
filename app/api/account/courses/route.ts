import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/account/courses
 * Returns all series the authenticated member is enrolled in, with progress data.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const enrollments = await db.seriesEnrollment.findMany({
    where: { userId, course: { isActive: true } },
    include: {
      course: {
        include: {
          lessons: {
            include: { lesson: { select: { slug: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  // Fetch progress for all lessons across all enrollments
  const allLessonIds = enrollments.flatMap((e) => e.course.lessons.map((cl) => cl.lessonId));
  const progressRecords =
    allLessonIds.length > 0
      ? await db.lessonProgress.findMany({
          where: { userId, lessonId: { in: allLessonIds } },
          select: { lessonId: true },
        })
      : [];
  const completedSet = new Set(progressRecords.map((p) => p.lessonId));

  const serialized = enrollments.map((e) => {
    const lessonIds = e.course.lessons.map((cl) => cl.lessonId);
    const completedCount = lessonIds.filter((id) => completedSet.has(id)).length;
    const firstLesson = e.course.lessons[0]?.lesson ?? null;
    const firstIncomplete = e.course.lessons.find((cl) => !completedSet.has(cl.lessonId));

    return {
      courseId: e.courseId,
      courseSlug: e.course.slug,
      courseTitle: e.course.title,
      courseSubheading: e.course.subheading ?? null,
      enrolledAt: e.enrolledAt.toISOString(),
      completedAt: e.completedAt?.toISOString() ?? null,
      enrollmentSource: e.enrollmentSource as string,
      totalLessons: lessonIds.length,
      completedLessons: completedCount,
      firstLessonSlug: firstLesson?.slug ?? null,
      nextLessonSlug: firstIncomplete?.lesson?.slug ?? null,
    };
  });

  return NextResponse.json(serialized);
}
