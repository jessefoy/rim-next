import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * GET  /api/lessons/[slug]/note — fetch the authenticated member's personal note
 * PATCH /api/lessons/[slug]/note — upsert (create or update) a personal note
 *
 * Both routes require the member to be enrolled in a series containing this lesson.
 */

async function getEnrolledLesson(userId: string, slug: string) {
  const lesson = await db.lesson.findUnique({
    where: { slug },
    select: {
      id: true,
      courses: {
        select: { courseId: true },
      },
    },
  });
  if (!lesson) return null;

  // Check enrollment in any course that contains this lesson
  const courseIds = lesson.courses.map((c) => c.courseId);
  if (courseIds.length === 0) return null;

  const enrollment = await db.seriesEnrollment.findFirst({
    where: { userId, courseId: { in: courseIds } },
    select: { id: true },
  });
  if (!enrollment) return null;

  return lesson;
}

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

  const lesson = await getEnrolledLesson(userId, slug);
  if (!lesson) return NextResponse.json({ error: "Not found or not enrolled" }, { status: 403 });

  const note = await db.lessonNote.findUnique({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
    select: { body: true },
  });

  return NextResponse.json({ body: note?.body ?? null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const userId = session.user.id;

  const lesson = await getEnrolledLesson(userId, slug);
  if (!lesson) return NextResponse.json({ error: "Not found or not enrolled" }, { status: 403 });

  const { body } = await request.json() as { body: object | null };

  await db.lessonNote.upsert({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
    create: {
      userId,
      lessonId: lesson.id,
      body: body ?? Prisma.JsonNull,
    },
    update: {
      body: body ?? Prisma.JsonNull,
    },
  });

  return NextResponse.json({ ok: true });
}
