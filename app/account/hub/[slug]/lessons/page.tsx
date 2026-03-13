/**
 * /account/hub/[slug]/lessons — Lesson list (Lessons tab)
 * Server component. Fetches all lessons from Postgres.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import LessonListClient from "@/components/LessonListClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Lessons` };
}

export default async function LessonsListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, roles);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const lessons = await db.lesson.findMany({
    orderBy: { titleInternal: "asc" },
    include: {
      courses: {
        include: { course: { select: { title: true } } },
      },
    },
  });

  const serialized = lessons.map((l) => ({
    id: l.id,
    titleInternal: l.titleInternal,
    titleDisplayed: l.titleDisplayed,
    slug: l.slug,
    courses: l.courses.map((cl) => cl.course.title),
  }));

  return <LessonListClient hubSlug={slug} lessons={serialized} />;
}
