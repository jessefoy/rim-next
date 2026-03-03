import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { sanityClient } from "@/lib/sanity";
import { courseBySlugQuery, allCourseSlugsQuery, programsLinkedToCourseQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import { db } from "@/lib/db";
import SeriesListItem from "@/components/SeriesListItem";

export const dynamic = "force-dynamic";

type Lesson = {
  lessonTitleDisplayed: string;
  slug: { current: string };
  isSectionTitle?: boolean;
  includesAudio?: boolean;
};

type Course = {
  _id: string;
  name: string;
  subheading?: string;
  accessLevel?: string; // "members" | "registration_required"
  mainContentDescription?: unknown[];
  lessons?: Lesson[];
};

export async function generateStaticParams() {
  // Access-gated — disable static pre-rendering
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await sanityClient.fetch<Course | null>(courseBySlugQuery, { slug });
  return { title: `${course?.name ?? "Course"} — Rooted In Mindfulness` };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  // proxy.ts handles the redirect for unauthenticated users, but guard here too
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const course = await sanityClient.fetch<Course | null>(courseBySlugQuery, { slug });
  if (!course) notFound();

  const accessLevel = course.accessLevel ?? "members";

  // ── Access check ──────────────────────────────────────────────────────────
  let hasAccess = accessLevel === "members"; // any logged-in user

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
      <>
        <div className="course-header">
          <div className="f-container-regular">
            <div className="f-header-wrapper-left">
              <div className="f-margin-bottom-24">
                <h1 className="course-title">{course.name}</h1>
              </div>
            </div>
          </div>
        </div>
        <div className="content-container" style={{ padding: "48px 24px" }}>
          <p style={{ marginBottom: 16 }}>
            Access to this course requires registration for the associated program.
          </p>
          <Link href="/community-programs" style={{ color: "var(--rim-blue)" }}>
            View programs →
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Course header: fafafa gradient background, blue title ── */}
      <div className="course-header">
        <div className="f-container-regular">
          <div className="f-header-wrapper-left">
            {course.subheading && (
              <div className="f-margin-bottom-08">
                <h5 className="course-type">{course.subheading}</h5>
              </div>
            )}
            <div className="f-margin-bottom-24">
              <h1 className="course-title">{course.name}</h1>
            </div>
            {course.mainContentDescription && (
              <div className="text-block-65 w-richtext">
                <PortableText value={course.mainContentDescription as any} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Lessons section ── */}
      {course.lessons && course.lessons.length > 0 && (
        <div className="course-lessons">
          <div className="content-container">
            <div className="series-list-section">
              <div className="program-details-content no-bottom-margin">
                <h2 className="text-center bottom-margin-30">Lessons</h2>
                <div className="series-list-wrapper">
                  {course.lessons.map((lesson, i) => (
                    <SeriesListItem
                      key={i}
                      title={lesson.lessonTitleDisplayed}
                      href={lesson.isSectionTitle ? undefined : `/lessons/${lesson.slug.current}`}
                      isSectionTitle={lesson.isSectionTitle}
                      includesAudio={lesson.includesAudio}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
