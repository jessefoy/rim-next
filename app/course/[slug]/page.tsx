import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { renderFormattedText } from "@/lib/renderRichContent";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await db.course.findUnique({ where: { slug }, select: { title: true } });
  return { title: `${course?.title ?? "Series"} — Rooted In Mindfulness` };
}

// ── Media-type icons ──────────────────────────────────────────────────────────

function AudioIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="14" y2="17" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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

  const lessonItems = course.lessons;

  return (
    <div className="crs-page">

      {/* ── Header ── */}
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

      {/* ── Lesson list ── */}
      {lessonItems.length > 0 ? (
        <div className="crs-lessons">
          <div className="crs-toc">
            {lessonItems.map((cl, i) => {
              const hasAudio = !!cl.lesson.audioUrl;
              const hasVideo = !!cl.lesson.videoUrl;
              const mediaType = hasAudio ? "audio" : hasVideo ? "video" : "text";

              return (
                <div key={cl.lessonId}>
                  {cl.groupLabel && (
                    <p className="crs-toc__section">{cl.groupLabel}</p>
                  )}
                  <Link
                    href={`/lessons/${cl.lesson.slug}?course=${course.slug}`}
                    className="crs-toc__item"
                  >
                    <span className="crs-toc__num">{i + 1}</span>
                    <span className="crs-toc__title">{cl.lesson.titleDisplayed}</span>
                    <span className={`crs-toc__icon-wrap crs-toc__icon-wrap--${mediaType}`} aria-label={mediaType}>
                      {hasAudio ? <AudioIcon /> : hasVideo ? <VideoIcon /> : <TextIcon />}
                    </span>
                  </Link>
                </div>
              );
            })}
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
