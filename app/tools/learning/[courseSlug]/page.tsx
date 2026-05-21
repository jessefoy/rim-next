/**
 * /tools/learning/[courseSlug] — Edit course + manage lessons
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import CourseEditor from "@/components/CourseEditor";


export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const course = await db.course.findUnique({ where: { slug: courseSlug }, select: { title: true } });
  return { title: `Edit: ${course?.title ?? "Course"}` };
}

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const [course, categories] = await Promise.all([
    db.course.findUnique({
      where: { slug: courseSlug },
      include: {
        lessons: {
          include: {
            lesson: {
              select: { id: true, titleInternal: true, titleDisplayed: true, slug: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    db.courseCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, sortOrder: true },
    }),
  ]);

  if (!course) notFound();

  const initialData = {
    id: course.id,
    title: course.title,
    slug: course.slug,
    subheading: course.subheading ?? "",
    description: course.description ?? null,
    // Orthogonal-flag access model (session 123).
    allowSelfEnroll: course.allowSelfEnroll,
    accessRestrictionMessage: course.accessRestrictionMessage ?? "",
    requiredRoles: course.requiredRoles as string[],
    // Landing-page content
    heroImage: course.heroImage ?? "",
    pullQuote: course.pullQuote ?? "",
    pullQuoteSource: course.pullQuoteSource ?? "",
    danaText: course.danaText ?? "",
    // Category
    categoryId: course.categoryId ?? "",
    // Dana model — Program-parallel (session 123, slice 5)
    danaMode: course.danaMode ?? "none",
    suggestedDana: course.suggestedDana != null ? String(course.suggestedDana) : "",
    danaBaseAmount: course.danaBaseAmount != null ? String(course.danaBaseAmount) : "",
    danaFixedAmount: course.danaFixedAmount != null ? String(course.danaFixedAmount) : "",
    danaMessage: course.danaMessage ?? null,
    // Existing flags
    isOnboarding: course.isOnboarding,
    publishOnPublicCatalog: course.publishOnPublicCatalog,
    hideFromMemberProfile: course.hideFromMemberProfile,
    sortOrder: course.sortOrder != null ? String(course.sortOrder) : "",
    isActive: course.isActive,
    completionNote: course.completionNote ?? null,
    lessons: course.lessons.map((cl) => ({
      lessonId: cl.lessonId,
      sortOrder: cl.sortOrder,
      groupLabel: cl.groupLabel ?? "",
      lesson: {
        id: cl.lesson.id,
        titleInternal: cl.lesson.titleInternal,
        titleDisplayed: cl.lesson.titleDisplayed,
        slug: cl.lesson.slug,
      },
    })),
  };

  return (
    <div>
      <CourseEditor initialData={initialData} categories={categories} isEditing />
    </div>
  );
}
