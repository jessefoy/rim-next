import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasToolAccess } from "@/lib/toolAuth";

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
  const body = await request.json();

  const course = await db.course.findUnique({ where: { slug } });
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Handle lesson order update — accepts { id, groupLabel? }[] or legacy string[]
  if (body.lessonOrder && Array.isArray(body.lessonOrder)) {
    await db.courseLesson.deleteMany({ where: { courseId: course.id } });
    await db.courseLesson.createMany({
      data: body.lessonOrder.map(
        (item: string | { id: string; groupLabel?: string | null }, i: number) => ({
          courseId: course.id,
          lessonId: typeof item === "string" ? item : item.id,
          sortOrder: i,
          groupLabel: typeof item === "string" ? null : (item.groupLabel || null),
        })
      ),
    });
  }

  // Handle field updates
  const { lessonOrder, ...fields } = body;
  const updateData: Record<string, unknown> = {};

  if (fields.title !== undefined) updateData.title = fields.title;
  if (fields.slug !== undefined) {
    // Check uniqueness if slug is changing
    if (fields.slug !== slug) {
      const existing = await db.course.findUnique({ where: { slug: fields.slug } });
      if (existing) {
        return NextResponse.json({ error: "A course with this slug already exists" }, { status: 409 });
      }
    }
    updateData.slug = fields.slug;
  }
  if (fields.subheading !== undefined) updateData.subheading = fields.subheading || null;
  if (fields.description !== undefined) updateData.description = fields.description || null;
  if (fields.accessLevel !== undefined) updateData.accessLevel = fields.accessLevel;
  if (fields.hideFromMemberProfile !== undefined) updateData.hideFromMemberProfile = fields.hideFromMemberProfile;
  if (fields.sortOrder !== undefined) updateData.sortOrder = fields.sortOrder != null ? Number(fields.sortOrder) : null;
  if (fields.isActive !== undefined) updateData.isActive = fields.isActive;
  if (fields.isOnboarding !== undefined) updateData.isOnboarding = fields.isOnboarding;
  if (fields.requiredRoles !== undefined) {
    if (fields.accessLevel === "ROLE_REQUIRED" || course.accessLevel === "ROLE_REQUIRED") {
      if (fields.accessLevel !== "ROLE_REQUIRED" && fields.accessLevel !== undefined) {
        // Switching away from ROLE_REQUIRED — clear requiredRoles
        updateData.requiredRoles = [];
      } else {
        if (!Array.isArray(fields.requiredRoles) || fields.requiredRoles.length === 0) {
          return NextResponse.json(
            { error: "At least one role is required when access level is Role Required" },
            { status: 400 }
          );
        }
        updateData.requiredRoles = fields.requiredRoles;
      }
    } else {
      updateData.requiredRoles = [];
    }
  }
  // If switching away from ROLE_REQUIRED without explicit requiredRoles, clear them
  if (fields.accessLevel !== undefined && fields.accessLevel !== "ROLE_REQUIRED" && fields.requiredRoles === undefined) {
    updateData.requiredRoles = [];
  }

  if (fields.completionNote !== undefined) updateData.completionNote = fields.completionNote || null;

  const updated = await db.course.update({
    where: { slug },
    data: updateData,
    include: {
      lessons: {
        include: { lesson: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json(updated);
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
