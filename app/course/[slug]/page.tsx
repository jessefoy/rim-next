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
        <div className="crs-hero">
          <div className="crs-hero__inner">
            <h1 className="crs-hero__title">{course.title}</h1>
          </div>
        </div>
        <div className="crs-body">
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
      {/* ── Hero ── */}
      <div className="crs-hero">
        <div className="crs-hero__inner">
          {course.subheading && (
            <p className="crs-hero__label">{course.subheading}</p>
          )}
          <h1 className="crs-hero__title">{course.title}</h1>
          {course.description && (
            <div
              className="crs-hero__desc"
              dangerouslySetInnerHTML={{ __html: renderFormattedText(course.description) }}
            />
          )}
        </div>
      </div>

      {/* ── Lesson list ── */}
      {lessonItems.length > 0 && (
        <div className="crs-body">
          <h2 className="crs-body__heading">Lessons</h2>
          <div className="crs-list">
            {lessonItems.map((cl, i) => (
              <div key={cl.lessonId}>
                {/* Section label (groupLabel) */}
                {cl.groupLabel && (
                  <div className="crs-section-label">{cl.groupLabel}</div>
                )}
                {/* Lesson row */}
                <Link
                  href={`/lessons/${cl.lesson.slug}?course=${course.slug}`}
                  className="crs-item"
                >
                  <span className="crs-item__num">{i + 1}</span>
                  <span className="crs-item__title">{cl.lesson.titleDisplayed}</span>
                  <span className="crs-item__meta">
                    {cl.lesson.audioUrl && <span className="crs-item__badge">🎧 Audio</span>}
                    {cl.lesson.videoUrl && <span className="crs-item__badge">▶ Video</span>}
                  </span>
                  <span className="crs-item__arrow">→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {lessonItems.length === 0 && (
        <div className="crs-body">
          <p className="crs-empty">No lessons have been added to this series yet.</p>
        </div>
      )}
    </div>
  );
}
