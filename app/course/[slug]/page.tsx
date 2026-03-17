import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { renderFormattedText } from "@/lib/renderRichContent";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  // Access-gated — disable static pre-rendering
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await db.course.findUnique({ where: { slug }, select: { title: true } });
  return { title: `${course?.title ?? "Series"} — Rooted In Mindfulness` };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
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
  let hasAccess = course.accessLevel === "MEMBERS";

  if (!hasAccess && course.accessLevel === "REGISTRATION_REQUIRED" && session.user.id) {
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
      <div className="crs-page">
        <header className="crs-header">
          <div className="crs-header__inner">
            <p className="crs-label">A Teaching Series</p>
            <h1 className="crs-title">{course.title}</h1>
          </div>
        </header>
        <hr className="crs-rule" />
        <div className="crs-gate">
          <p className="crs-gate__msg">
            Access to this series requires registration for the associated program.
          </p>
          <Link href="/community-programs" className="crs-gate__link">
            View programs →
          </Link>
        </div>
      </div>
    );
  }

  const lessonItems = course.lessons; // CourseLesson[] with .lesson + .groupLabel

  return (
    <div className="crs-page">

      {/* ── Header — mirrors lp-header style ── */}
      <header className="crs-header">
        <div className="crs-header__inner">
          <p className="crs-label">
            {course.subheading || "A Teaching Series"}
          </p>
          <h1 className="crs-title">{course.title}</h1>
          {course.description && (
            <div
              className="crs-desc"
              dangerouslySetInnerHTML={{ __html: renderFormattedText(course.description) }}
            />
          )}
        </div>
      </header>

      <hr className="crs-rule" />

      {/* ── Lesson table of contents ── */}
      {lessonItems.length > 0 ? (
        <div className="crs-lessons">
          <div className="crs-toc">
            {lessonItems.map((cl, i) => (
              <div key={cl.lessonId}>
                {cl.groupLabel && (
                  <div className="crs-toc__section">{cl.groupLabel}</div>
                )}
                <Link
                  href={`/lessons/${cl.lesson.slug}?course=${course.slug}`}
                  className="crs-toc__item"
                >
                  <span className="crs-toc__num">{i + 1}</span>
                  <span className="crs-toc__title">{cl.lesson.titleDisplayed}</span>
                  {(cl.lesson.audioUrl || cl.lesson.videoUrl) && (
                    <span className="crs-toc__badges">
                      {cl.lesson.audioUrl && <span className="crs-toc__badge">Audio</span>}
                      {cl.lesson.videoUrl && <span className="crs-toc__badge">Video</span>}
                    </span>
                  )}
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="crs-lessons">
          <p className="crs-empty">No lessons have been added to this series yet.</p>
        </div>
      )}

    </div>
  );
}
