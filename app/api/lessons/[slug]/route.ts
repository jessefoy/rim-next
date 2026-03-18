import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function canAccessCourseHub(userId: string, roles: string[]): Promise<boolean> {

  if (roles.some((r) => ["ADMIN", "TEACHER"].includes(r))) return true;
  const ua = await db.userHubAccess.findUnique({
    where: { userId_hubSlug: { userId, hubSlug: "courses" } },
  });
  return !!ua;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !await canAccessCourseHub(session.user.id, session.user.roles ?? [])) {
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
  if (!session?.user?.id || !await canAccessCourseHub(session.user.id, session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;
  const body = await request.json();

  const lesson = await db.lesson.findUnique({ where: { slug } });
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.titleInternal !== undefined) updateData.titleInternal = body.titleInternal;
  if (body.titleDisplayed !== undefined) updateData.titleDisplayed = body.titleDisplayed;
  if (body.slug !== undefined) {
    if (body.slug !== slug) {
      const existing = await db.lesson.findUnique({ where: { slug: body.slug } });
      if (existing) {
        return NextResponse.json({ error: "A lesson with this slug already exists" }, { status: 409 });
      }
    }
    updateData.slug = body.slug;
  }
  if (body.accessLevel !== undefined) updateData.accessLevel = body.accessLevel;
  if (body.body !== undefined) updateData.body = body.body || null;
  if (body.heroImageUrl !== undefined) updateData.heroImageUrl = body.heroImageUrl || null;
  if (body.heroImageAlt !== undefined) updateData.heroImageAlt = body.heroImageAlt || null;
  if (body.audioUrl !== undefined) updateData.audioUrl = body.audioUrl || null;
  if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl || null;
  if (body.headerQuote !== undefined) updateData.headerQuote = body.headerQuote || null;
  if (body.quoteSource !== undefined) updateData.quoteSource = body.quoteSource || null;
  if (body.resources !== undefined) updateData.resources = body.resources;
  if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl || null;
  if (body.releaseDate !== undefined) updateData.releaseDate = body.releaseDate ? new Date(body.releaseDate) : null;
  if (body.releaseDelayDays !== undefined) updateData.releaseDelayDays = body.releaseDelayDays != null ? Number(body.releaseDelayDays) : null;

  const updated = await db.lesson.update({
    where: { slug },
    data: updateData,
  });

  // Handle teacher associations
  if (body.teacherIds !== undefined) {
    await db.lessonTeacher.deleteMany({ where: { lessonId: lesson.id } });
    if (Array.isArray(body.teacherIds) && body.teacherIds.length > 0) {
      await db.lessonTeacher.createMany({
        data: body.teacherIds.map((tid: string) => ({
          lessonId: lesson.id,
          teacherId: tid,
        })),
      });
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !await canAccessCourseHub(session.user.id, session.user.roles ?? [])) {
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
