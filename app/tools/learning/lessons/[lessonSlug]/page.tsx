/**
 * /tools/learning/lessons/[lessonSlug] — Edit lesson
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import LessonEditor from "@/components/LessonEditor";

import { renderContentBodyAsync } from "@/lib/renderRichContentServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonSlug: string }>;
}) {
  const { lessonSlug } = await params;
  const lesson = await db.lesson.findUnique({ where: { slug: lessonSlug }, select: { titleInternal: true } });
  return { title: `Edit: ${lesson?.titleInternal ?? "Lesson"}` };
}

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ lessonSlug: string }>;
}) {
  const { lessonSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

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
            course: { select: { title: true } },
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

  const legacyBodyHtml = lesson.body && !Array.isArray(lesson.body)
    ? await renderContentBodyAsync(lesson.body)
    : null;

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
    durationMinutes: lesson.durationMinutes ?? null,
    reflectionPrompt: lesson.reflectionPrompt ?? null,
    questionsRequired: lesson.questionsRequired,
    initialQuestions: initialQuestions.map((q) => ({ ...q, body: q.body ?? null })),
  };

  return (
    <div>
      <LessonEditor initialData={initialData} isEditing legacyBodyHtml={legacyBodyHtml ?? undefined} />
    </div>
  );
}
