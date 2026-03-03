import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { sanityClient } from "@/lib/sanity";
import {
  courseBySlugQuery,
  allCourseSlugsQuery,
  programsLinkedToCourseQuery,
} from "@/lib/queries";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type CourseLesson = {
  lessonTitleDisplayed: string;
  slug: { current: string };
  isSectionTitle?: boolean;
  includesAudio?: boolean;
};

type Course = {
  _id: string;
  name: string;
  slug: { current: string };
  subheading?: string;
  accessLevel?: string; // "members" | "registration_required"
  mainContentDescription?: unknown[];
  lessons?: CourseLesson[];
};

export async function generateStaticParams() {
  // courses are dynamic (access-gated) — disable static pre-rendering
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await sanityClient.fetch<Course | null>(courseBySlugQuery, { slug });
  return { title: `${course?.name ?? "Course"} — Rooted In Mindfulness` };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  // proxy.ts handles redirect to /login for unauthenticated users,
  // but guard here too in case of direct server render
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const course = await sanityClient.fetch<Course | null>(courseBySlugQuery, { slug });
  if (!course) notFound();

  const accessLevel = course.accessLevel ?? "members";

  // ── Access check ──────────────────────────────────────────────────────────
  let hasAccess = accessLevel === "members"; // all logged-in users

  if (!hasAccess && accessLevel === "registration_required" && session.user.id) {
    // Check 1: active registration for any program linked to this course
    const linkedPrograms = await sanityClient.fetch<{ slug: string }[]>(
      programsLinkedToCourseQuery,
      { courseSlug: slug }
    );
    const programSlugs = linkedPrograms.map((p) => p.slug).filter(Boolean);

    if (programSlugs.length > 0) {
      const reg = await db.registration.findFirst({
        where: {
          userId: session.user.id,
          programSlug: { in: programSlugs },
          status: { in: ["REGISTERED", "APPROVED"] },
        },
        select: { id: true },
      });
      if (reg) hasAccess = true;
    }

    // Check 2: manual admin grant
    if (!hasAccess) {
      const grant = await db.courseAccess.findUnique({
        where: { userId_courseSlug: { userId: session.user.id, courseSlug: slug } },
        select: { id: true },
      });
      if (grant) hasAccess = true;
    }
  }

  if (!hasAccess) {
    return (
      <div className="co-page">
        <div className="co-content">
          <header className="co-header">
            <p className="lp-label">Online Course Materials</p>
            <h1 className="co-title">{course.name}</h1>
          </header>
          <div className="co-no-access">
            <p className="co-no-access__text">
              Access to this course requires registration for the associated program.
            </p>
            <Link href="/community-programs" className="co-no-access__link">
              View programs →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const lessons = course.lessons ?? [];

  return (
    <div className="co-page">
      <div className="co-content">

        {/* ── Header ── */}
        <header className="co-header">
          <p className="lp-label">Online Course Materials</p>
          <h1 className="co-title">{course.name}</h1>
          {course.subheading && (
            <p className="co-subheading">{course.subheading}</p>
          )}
        </header>

        {/* ── Lessons list ── */}
        {lessons.length > 0 && (
          <div className="co-lessons">
            {lessons.map((lesson, i) => {
              if (lesson.isSectionTitle) {
                return (
                  <p key={i} className="co-section-title">
                    {lesson.lessonTitleDisplayed}
                  </p>
                );
              }
              return (
                <Link
                  key={i}
                  href={`/lessons/${lesson.slug.current}`}
                  className="co-lesson"
                >
                  <span className="co-lesson__title">{lesson.lessonTitleDisplayed}</span>
                  {lesson.includesAudio && (
                    <span className="co-lesson__badge">Audio</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {lessons.length === 0 && (
          <p className="co-empty">No lessons have been added to this course yet.</p>
        )}

      </div>
    </div>
  );
}
