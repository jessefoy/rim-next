/**
 * /account/hub/[slug]/lessons/[lessonSlug] — Edit lesson
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import LessonEditor from "@/components/LessonEditor";
import ManualHelpIcon from "@/components/ManualHelpIcon";

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

  const [lesson, initialQuestions] = await Promise.all([
    db.lesson.findUnique({
      where: { slug: lessonSlug },
      include: {
        teachers: {
          include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
          orderBy: { order: "asc" },
        },
        courses: {
          include: {
            course: { select: { dripEnabled: true, dripIntervalDays: true, title: true } },
          },
        },
      },
    }),
    db.reflectionQuestion.findMany({
      where: { lesson: { slug: lessonSlug } },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        body: true,
        sortOrder: true,
        options: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, text: true, isCorrect: true, sortOrder: true },
        },
      },
    }),
  ]);
  if (!lesson) notFound();

  // Serialize for client component
  const initialData = {
    id: lesson.id,
    titleInternal: lesson.titleInternal,
    titleDisplayed: lesson.titleDisplayed,
    slug: lesson.slug,
    accessLevel: lesson.accessLevel as "ALL_MEMBERS" | "REGISTRATION_REQUIRED",
    body: lesson.body ?? null,
    heroImageUrl: lesson.heroImageUrl ?? "",
    heroImageAlt: lesson.heroImageAlt ?? "",
    audioUrl: lesson.audioUrl ?? "",
    videoUrl: lesson.videoUrl ?? "",
    headerQuote: lesson.headerQuote ?? "",
    quoteSource: lesson.quoteSource ?? "",
    resources: (lesson.resources as { name: string; url: string; resourceType: string }[]) ?? [],
    teachers: lesson.teachers.map((lt) => ({
      id: lt.user.id,
      name: [lt.user.preferredName || lt.user.firstName, lt.user.lastName].filter(Boolean).join(" "),
    })),
    releaseDelayDays: lesson.releaseDelayDays ?? null,
    durationMinutes: lesson.durationMinutes ?? null,
    reflectionPrompt: lesson.reflectionPrompt ?? null,
    questionsRequired: lesson.questionsRequired,
    initialQuestions: initialQuestions.map((q) => ({ ...q, body: q.body ?? null })),
    parentDripInfo: lesson.courses
      .filter((cl) => cl.course.dripEnabled)
      .map((cl) => ({
        seriesTitle: cl.course.title,
        intervalDays: cl.course.dripIntervalDays,
      })),
  };

  return (
    <div style={{ position: "relative" }}>
      <ManualHelpIcon manualSlug="course-hub-lessons" />
      <LessonEditor hubSlug={slug} initialData={initialData} isEditing />
    </div>
  );
}
