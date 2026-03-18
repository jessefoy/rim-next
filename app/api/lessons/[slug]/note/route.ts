import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET  /api/lessons/[slug]/note — fetch the member's own note for this lesson
 * PATCH /api/lessons/[slug]/note — upsert (auto-save) the member's note
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

  const lesson = await db.lesson.findUnique({ where: { slug }, select: { id: true } });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const note = await db.lessonNote.findUnique({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
    select: { body: true, updatedAt: true },
  });

  return NextResponse.json({ body: note?.body ?? null, updatedAt: note?.updatedAt ?? null });
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
  const { body } = await request.json();

  const lesson = await db.lesson.findUnique({ where: { slug }, select: { id: true } });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const note = await db.lessonNote.upsert({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
    update: { body: body ?? null },
    create: { userId, lessonId: lesson.id, body: body ?? null },
    select: { updatedAt: true },
  });

  return NextResponse.json({ ok: true, updatedAt: note.updatedAt });
}
