import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/lessons/[slug]/complete
 * Toggles the lesson complete/incomplete for the authenticated member.
 * Returns { completed: boolean, courseSlug?: string } so the client can
 * check if the whole series is now done and set SeriesEnrollment.completedAt.
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

  // Toggle: if exists → delete (mark incomplete); if absent → create (mark complete)
  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
  });

  if (existing) {
    await db.lessonProgress.delete({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
    });
    return NextResponse.json({ completed: false });
  }

  await db.lessonProgress.create({
    data: { userId, lessonId: lesson.id },
  });

  // If the member is enrolled in a series that contains this lesson,
  // check whether all lessons in that series are now complete.
  // If so, stamp SeriesEnrollment.completedAt.
  if (courseSlug) {
    const course = await db.course.findUnique({
      where: { slug: courseSlug },
      select: {
        id: true,
        lessons: { select: { lessonId: true } },
      },
    });
    if (course) {
      const enrollment = await db.seriesEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
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
          return NextResponse.json({ completed: true, seriesCompleted: true, courseSlug });
        }
      }
    }
  }

  return NextResponse.json({ completed: true });
}
