/**
 * /tools/learning/lessons — Lesson list
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { hasToolAccess } from "@/lib/toolAuth";
import { db } from "@/lib/db";
import LessonListClient from "@/components/LessonListClient";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Course Manager - Lessons" };
}

export default async function LessonsListPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await hasToolAccess(session.user.id, session.user.roles ?? [], ["TEACHER"], "learning"))) notFound();

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
