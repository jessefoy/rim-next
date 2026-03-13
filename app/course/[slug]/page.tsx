import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import ReactMarkdown from "react-markdown";
import SeriesListItem from "@/components/SeriesListItem";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  // Access-gated — disable static pre-rendering
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await db.course.findUnique({ where: { slug }, select: { title: true } });
  return { title: `${course?.title ?? "Course"} — Rooted In Mindfulness` };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  // proxy.ts handles the redirect for unauthenticated users, but guard here too
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug, isActive: true },
    include: {
      lessons: {
        include: { lesson: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!course) notFound();

  // ── Access check ──────────────────────────────────────────────────────────
  let hasAccess = course.accessLevel === "MEMBERS"; // any logged-in user

  if (!hasAccess && course.accessLevel === "REGISTRATION_REQUIRED" && session.user.id) {
    // Check 1: active registration for any program linked to this course
    const programCourses = await db.programCourse.findMany({
      where: { courseId: course.id },
      select: { programId: true },
    });
    const programIds = programCourses.map((pc) => pc.programId);

    if (programIds.length > 0) {
      const reg = await db.registration.findFirst({
        where: {
          userId: session.user.id,
          programId: { in: programIds },
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
                <h1 className="course-title">{course.title}</h1>
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

  const lessons = course.lessons.map((cl) => cl.lesson);

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
              <h1 className="course-title">{course.title}</h1>
            </div>
            {course.description && (
              <div className="text-block-65 w-richtext">
                <ReactMarkdown>{course.description}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Lessons section ── */}
      {lessons.length > 0 && (
        <div className="course-lessons">
          <div className="content-container">
            <div className="series-list-section">
              <div className="program-details-content no-bottom-margin">
                <h2 className="text-center bottom-margin-30">Lessons</h2>
                <div className="series-list-wrapper">
                  {lessons.map((lesson, i) => (
                    <SeriesListItem
                      key={i}
                      title={lesson.titleDisplayed}
                      href={lesson.isSectionTitle ? undefined : `/lessons/${lesson.slug}`}
                      isSectionTitle={lesson.isSectionTitle}
                      includesAudio={!!lesson.audioUrl}
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
