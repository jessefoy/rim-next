import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasToolAccess } from "@/lib/toolAuth";
import { saveLesson } from "@/lib/contentSaves";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;
  const lesson = await db.lesson.findUnique({
    where: { slug },
    include: {
      courses: {
        include: { course: { select: { id: true, title: true, slug: true } } },
      },
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(lesson);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;
  // The save itself (lib/contentSaves.ts) is shared with the RIM Guide.
  const result = await saveLesson(slug, await request.json());
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;
  const lesson = await db.lesson.findUnique({
    where: { slug },
    include: { _count: { select: { courses: true } } },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (lesson._count.courses > 0) {
    return NextResponse.json(
      { error: "Remove this lesson from all courses before deleting." },
      { status: 409 }
    );
  }

  await db.lesson.delete({ where: { slug } });
  return NextResponse.json({ ok: true });
}
