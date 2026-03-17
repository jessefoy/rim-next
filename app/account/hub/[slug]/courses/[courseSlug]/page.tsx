/**
 * /account/hub/[slug]/courses/[courseSlug] — Edit course + manage lessons
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import CourseEditor from "@/components/CourseEditor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const course = await db.course.findUnique({ where: { slug: courseSlug }, select: { title: true } });
  return { title: `Edit: ${course?.title ?? "Course"}` };
}

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ slug: string; courseSlug: string }>;
}) {
  const { slug, courseSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, roles);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const course = await db.course.findUnique({
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
  });

  if (!course) notFound();

  // Serialize for client component — explicit construction, no Prisma spread
  const initialData = {
    id: course.id,
    title: course.title,
    slug: course.slug,
    subheading: course.subheading ?? "",
    description: course.description ?? null,
    accessLevel: course.accessLevel as "MEMBERS" | "REGISTRATION_REQUIRED",
    hideFromMemberProfile: course.hideFromMemberProfile,
    sortOrder: course.sortOrder != null ? String(course.sortOrder) : "",
    isActive: course.isActive,
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

  return <CourseEditor hubSlug={slug} initialData={initialData} isEditing />;
}
