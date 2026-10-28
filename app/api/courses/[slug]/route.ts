import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasToolAccess } from "@/lib/toolAuth";
import { saveCourse } from "@/lib/contentSaves";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      lessons: {
        include: { lesson: true },
        orderBy: { sortOrder: "asc" },
      },
      programs: true,
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(course);
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
  const result = await saveCourse(slug, await request.json());
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
  const course = await db.course.findUnique({
    where: { slug },
    include: { _count: { select: { programs: true } } },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (course._count.programs > 0) {
    return NextResponse.json(
      { error: "This course is linked to one or more programs." },
      { status: 409 }
    );
  }

  await db.course.delete({ where: { slug } });
  return NextResponse.json({ ok: true });
}
