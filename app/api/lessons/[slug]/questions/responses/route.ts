import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * DELETE /api/lessons/[slug]/questions/responses
 * Delete all ReflectionResponse records for the current user scoped to
 * questions belonging to this lesson. Called by the Retake action.
 * Enrollment-gated (staff bypass).
 */
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

  const lesson = await db.lesson.findUnique({
    where: { slug },
    select: { id: true, courses: { select: { courseId: true } } },
  });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Enrollment gate (staff bypass)
  const isStaff = session.user.roles?.some((r: string) =>
    ["TEACHER", "ADMIN"].includes(r)
  );
  if (!isStaff) {
    const courseIds = lesson.courses.map((cl) => cl.courseId);
    if (courseIds.length > 0) {
      const enrollment = await db.seriesEnrollment.findFirst({
        where: { userId, courseId: { in: courseIds } },
        select: { id: true },
      });
      if (!enrollment) {
        return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
      }
    }
  }

  // ReflectionResponse has no direct relation to Lesson; resolve via question IDs first
  const questions = await db.reflectionQuestion.findMany({
    where: { lessonId: lesson.id },
    select: { id: true },
  });
  const questionIds = questions.map((q) => q.id);

  if (questionIds.length > 0) {
    await db.reflectionResponse.deleteMany({
      where: { userId, questionId: { in: questionIds } },
    });
  }

  return NextResponse.json({ ok: true });
}
