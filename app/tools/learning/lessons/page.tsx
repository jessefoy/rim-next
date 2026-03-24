/**
 * /tools/learning/lessons — Lesson list
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import LessonListClient from "@/components/LessonListClient";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Course Manager — Lessons" };
}

export default async function LessonsListPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const lessons = await db.lesson.findMany({
    orderBy: { titleInternal: "asc" },
    include: {
      courses: {
        include: { course: { select: { title: true, slug: true } } },
      },
    },
  });

  const serialized = lessons.map((l) => ({
    id: l.id,
    titleInternal: l.titleInternal,
    titleDisplayed: l.titleDisplayed,
    slug: l.slug,
    series: l.courses.map((cl) => ({ title: cl.course.title, slug: cl.course.slug })),
  }));

  return <LessonListClient lessons={serialized} />;
}
