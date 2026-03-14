/**
 * /account/hub/[slug]/lessons/[lessonSlug] — Edit lesson
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import LessonEditor from "@/components/LessonEditor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { lessonSlug } = await params;
  const lesson = await db.lesson.findUnique({ where: { slug: lessonSlug }, select: { titleInternal: true } });
  return { title: `Edit: ${lesson?.titleInternal ?? "Lesson"}` };
}

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, roles);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const lesson = await db.lesson.findUnique({ where: { slug: lessonSlug } });
  if (!lesson) notFound();

  // Serialize for client component
  const initialData = {
    id: lesson.id,
    titleInternal: lesson.titleInternal,
    titleDisplayed: lesson.titleDisplayed,
    slug: lesson.slug,
    isSectionTitle: lesson.isSectionTitle,
    body: lesson.body ?? null,
    heroImageUrl: lesson.heroImageUrl ?? "",
    heroImageAlt: lesson.heroImageAlt ?? "",
    audioUrl: lesson.audioUrl ?? "",
    videoUrl: lesson.videoUrl ?? "",
    headerQuote: lesson.headerQuote ?? "",
    quoteSource: lesson.quoteSource ?? "",
    teacherNames: lesson.teacherNames.join(", "),
    resources: (lesson.resources as { name: string; url: string; resourceType: string }[]) ?? [],
  };

  return <LessonEditor hubSlug={slug} initialData={initialData} isEditing />;
}
