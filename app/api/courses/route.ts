import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasToolAccess } from "@/lib/toolAuth";

/**
 * GET /api/courses — Public browse endpoint.
 * Returns all active, non-onboarding courses visible to the current user.
 * Auth optional: ROLE_REQUIRED courses filtered by user's roles.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const userRoles = session?.user?.roles ?? [];
  const isAdmin = userRoles.includes("ADMIN");

  const courses = await db.course.findMany({
    where: { isActive: true, isOnboarding: false },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      _count: { select: { lessons: true } },
    },
  });

  // Filter by access level
  const visibleCourses = courses.filter((c) => {
    if (c.accessLevel === "ALL_MEMBERS") return true;
    if (c.accessLevel === "REGISTRATION_REQUIRED") return true;
    if (c.accessLevel === "ROLE_REQUIRED") {
      return isAdmin || c.requiredRoles.some((r) => userRoles.includes(r));
    }
    return true;
  });

  const result = visibleCourses.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    subheading: c.subheading ?? null,
    accessLevel: c.accessLevel as string,
    requiredRoles: c.requiredRoles,
    categoryId: c.categoryId ?? null,
    category: c.category ?? null,
    lessonCount: c._count.lessons,
  }));

  // Suppress unused variable warning
  void userId;

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !(await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { title, slug, subheading, description, accessLevel, hideFromMemberProfile, sortOrder, isActive } = body;

  if (!title || !slug) {
    return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await db.course.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A course with this slug already exists" }, { status: 409 });
  }

  const course = await db.course.create({
    data: {
      title,
      slug,
      subheading: subheading || null,
      description: description || null,
      accessLevel: accessLevel || "ALL_MEMBERS",
      hideFromMemberProfile: hideFromMemberProfile ?? false,
      sortOrder: sortOrder != null ? Number(sortOrder) : null,
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(course, { status: 201 });
}
