import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasToolAccess } from "@/lib/toolAuth";
import { flagsFromAccessLevel } from "@/lib/courseAccess";

/**
 * GET /api/courses — Public browse endpoint.
 *
 * Returns active, non-onboarding courses the visitor can see. Visibility
 * rules use the orthogonal flags (session 123): a course is visible if
 * it has no role gate, OR the visitor holds at least one required role
 * (ADMIN bypasses). The legacy accessLevel enum is no longer consulted.
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

  // Filter by visibility — requiredRoles gates visibility + self-enroll
  // (per RIM_Offering_Model.md). An empty requiredRoles array means
  // visible to anyone who can otherwise reach the course.
  const visibleCourses = courses.filter((c) => {
    if (c.requiredRoles.length === 0) return true;
    if (isAdmin) return true;
    return c.requiredRoles.some((r) => userRoles.includes(r));
  });

  const result = visibleCourses.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    subheading: c.subheading ?? null,
    accessLevel: c.accessLevel as string, // legacy — still echoed for clients during transition
    allowSelfEnroll: c.allowSelfEnroll,
    selfEnrollDanaRequired: c.selfEnrollDanaRequired,
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
  const {
    title, slug, subheading, description, accessLevel,
    allowSelfEnroll, selfEnrollDanaRequired, accessRestrictionMessage,
    heroImage, pullQuote, pullQuoteSource, danaText,
    requiredRoles,
    hideFromMemberProfile, sortOrder, isActive, publishOnPublicCatalog,
  } = body;

  if (!title || !slug) {
    return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await db.course.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A course with this slug already exists" }, { status: 409 });
  }

  // The editor (post-slice-3) sends the new orthogonal flags directly.
  // For requests that still send accessLevel (older clients or programmatic
  // creates), derive the flags via flagsFromAccessLevel. Flag values
  // explicitly present in the body win over the derived defaults.
  const resolvedAccessLevel = accessLevel || "ALL_MEMBERS";
  const derived = flagsFromAccessLevel(resolvedAccessLevel);
  const resolvedAllowSelfEnroll = allowSelfEnroll ?? derived.allowSelfEnroll;
  const resolvedSelfEnrollDanaRequired = selfEnrollDanaRequired ?? derived.selfEnrollDanaRequired;

  const course = await db.course.create({
    data: {
      title,
      slug,
      subheading: subheading || null,
      description: description || null,
      accessLevel: resolvedAccessLevel,
      allowSelfEnroll: resolvedAllowSelfEnroll,
      selfEnrollDanaRequired: resolvedSelfEnrollDanaRequired,
      accessRestrictionMessage: accessRestrictionMessage || null,
      heroImage: heroImage || null,
      pullQuote: pullQuote || null,
      pullQuoteSource: pullQuoteSource || null,
      danaText: danaText || null,
      requiredRoles: Array.isArray(requiredRoles) ? requiredRoles : [],
      hideFromMemberProfile: hideFromMemberProfile ?? false,
      sortOrder: sortOrder != null ? Number(sortOrder) : null,
      isActive: isActive ?? true,
      publishOnPublicCatalog: publishOnPublicCatalog ?? false,
    },
  });

  return NextResponse.json(course, { status: 201 });
}
