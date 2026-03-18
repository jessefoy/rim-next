import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/lessons/[slug]/progress
 * Returns whether the authenticated member has completed this lesson.
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

  const lesson = await db.lesson.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const progress = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
  });

  return NextResponse.json({ completed: !!progress });
}
