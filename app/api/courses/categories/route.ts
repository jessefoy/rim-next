import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/courses/categories — Public.
 * Returns all CourseCategory records that have at least one active, non-onboarding course.
 */
export async function GET() {
  const cats = await db.courseCategory.findMany({
    where: {
      courses: {
        some: { isActive: true, isOnboarding: false },
      },
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(cats);
}
