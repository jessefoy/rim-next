import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/lessons/[slug]/questions
 * Returns the question set for a lesson, with the member's existing responses.
 * Enrollment-gated: member must be enrolled in a course that contains this lesson,
 * OR must be TEACHER/ADMIN (for preview).
 *
 * Returns:
 *   { questionsRequired: boolean, questions: QuestionWithResponse[] }
 *
 * Each question:
 *   { id, text, sortOrder, options: { id, text, sortOrder }[], responseOptionId: string | null }
 * Note: isCorrect is intentionally omitted from options for members.
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
  const isStaff = session.user.roles?.some((r: string) =>
    ["TEACHER", "ADMIN"].includes(r)
  );

  const lesson = await db.lesson.findUnique({
    where: { slug },
    select: {
      id: true,
      questionsRequired: true,
      courses: { select: { courseId: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          text: true,
          sortOrder: true,
          options: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, text: true, sortOrder: true },
          },
        },
      },
    },
  });

  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Staff can preview without enrollment
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

  // Fetch the member's existing responses for this lesson's questions
  const questionIds = lesson.questions.map((q) => q.id);
  const responses = await db.reflectionResponse.findMany({
    where: { userId, questionId: { in: questionIds } },
    select: { questionId: true, optionId: true },
  });
  const responseMap = new Map(responses.map((r) => [r.questionId, r.optionId]));

  const questions = lesson.questions.map((q) => ({
    ...q,
    responseOptionId: responseMap.get(q.id) ?? null,
  }));

  return NextResponse.json({
    questionsRequired: lesson.questionsRequired,
    questions,
  });
}

/**
 * PUT /api/lessons/[slug]/questions
 * Replace the full question set for a lesson (teacher/admin only).
 *
 * Body: { questions: { id?: string, text: string, sortOrder: number, options: { id?: string, text: string, isCorrect: boolean, sortOrder: number }[] }[] }
 *
 * Strategy: delete all existing questions for the lesson, re-create from payload.
 * Simpler than diffing — question count is small (typically 3-8).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isStaff = session.user.roles?.some((r: string) =>
    ["TEACHER", "ADMIN"].includes(r)
  );
  if (!isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  const lesson = await db.lesson.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json() as {
    questions: {
      text: string;
      sortOrder: number;
      options: { text: string; isCorrect: boolean; sortOrder: number }[];
    }[];
  };

  // Delete all existing questions (cascades to options + responses)
  await db.reflectionQuestion.deleteMany({ where: { lessonId: lesson.id } });

  // Re-create
  if (body.questions && body.questions.length > 0) {
    for (const q of body.questions) {
      await db.reflectionQuestion.create({
        data: {
          lessonId: lesson.id,
          text: q.text,
          sortOrder: q.sortOrder,
          options: {
            create: q.options.map((o) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              sortOrder: o.sortOrder,
            })),
          },
        },
      });
    }
  }

  // Return the saved questions (with isCorrect — staff view)
  const saved = await db.reflectionQuestion.findMany({
    where: { lessonId: lesson.id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      text: true,
      sortOrder: true,
      options: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, text: true, isCorrect: true, sortOrder: true },
      },
    },
  });

  return NextResponse.json({ questions: saved });
}
