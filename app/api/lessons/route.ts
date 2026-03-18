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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !await canAccessCourseHub(session.user.id, session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const lessons = await db.lesson.findMany({
    orderBy: { titleInternal: "asc" },
    include: {
      courses: {
        include: { course: { select: { title: true } } },
      },
    },
  });

  return NextResponse.json(lessons);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !await canAccessCourseHub(session.user.id, session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const {
    titleInternal, titleDisplayed, slug, accessLevel,
    body: lessonBody, heroImageUrl, heroImageAlt, audioUrl, videoUrl,
    headerQuote, quoteSource, resources, durationMinutes, reflectionPrompt,
  } = body;

  if (!titleInternal || !titleDisplayed || !slug) {
    return NextResponse.json({ error: "Internal title, displayed title, and slug are required" }, { status: 400 });
  }

  const existing = await db.lesson.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A lesson with this slug already exists" }, { status: 409 });
  }

  const lesson = await db.lesson.create({
    data: {
      titleInternal,
      titleDisplayed,
      slug,
      accessLevel: accessLevel ?? "ALL_MEMBERS",
      body: lessonBody || null,
      heroImageUrl: heroImageUrl || null,
      heroImageAlt: heroImageAlt || null,
      audioUrl: audioUrl || null,
      videoUrl: videoUrl || null,
      headerQuote: headerQuote || null,
      quoteSource: quoteSource || null,
      resources: resources ?? null,
      durationMinutes: durationMinutes != null ? Number(durationMinutes) : null,
      reflectionPrompt: reflectionPrompt || null,
    },
  });

  return NextResponse.json(lesson, { status: 201 });
}
