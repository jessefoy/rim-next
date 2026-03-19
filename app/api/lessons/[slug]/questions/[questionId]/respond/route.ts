import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/lessons/[slug]/questions/[questionId]/respond
 * Upsert a member's answer for a reflection question.
 * Enrollment-gated.
 *
 * Body: { optionId: string }
 * Returns: { isCorrect: boolean, correctOptionId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; questionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, questionId } = await params;
  const userId = session.user.id;

  // Verify lesson exists
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

  // Verify question belongs to this lesson
  const question = await db.reflectionQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      lessonId: true,
      options: { select: { id: true, isCorrect: true } },
    },
  });
  if (!question || question.lessonId !== lesson.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { optionId } = await request.json() as { optionId: string };

  // Verify option belongs to this question
  const option = question.options.find((o) => o.id === optionId);
  if (!option) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  // Upsert response
  await db.reflectionResponse.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId, optionId },
    update: { optionId },
  });

  const correctOption = question.options.find((o) => o.isCorrect);

  return NextResponse.json({
    isCorrect: option.isCorrect,
    correctOptionId: correctOption?.id ?? null,
  });
}
