import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { renderFormattedText } from "@/lib/renderRichContent";
import EnrollButton from "@/components/EnrollButton";
import { isLessonAvailable, computeAvailableDate, formatAvailableDate } from "@/lib/drip";

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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const userId = session.user.id!;

  const course = await db.course.findUnique({
    where: { slug, isActive: true },
    include: {
      lessons: {
        include: {
          lesson: {
            select: {
              id: true, slug: true, titleDisplayed: true,
              audioUrl: true, videoUrl: true,
              releaseDate: true, releaseDelayDays: true,
            }
          }
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!course) notFound();

  // ── Access check ──────────────────────────────────────────────────────────
  let hasAccess = course.accessLevel === "ALL_MEMBERS";

  const userRoles = session.user.roles ?? [];
  const isAdmin = userRoles.includes("ADMIN");

  if (!hasAccess && course.accessLevel === "REGISTRATION_REQUIRED") {
    const programCourses = await db.programCourse.findMany({
      where: { courseId: course.id },
      select: { programId: true },
    });
    const programIds = programCourses.map((pc) => pc.programId);

    if (programIds.length > 0) {
      const reg = await db.registration.findFirst({
        where: {
          userId,
          programId: { in: programIds },
          status: { in: ["REGISTERED", "APPROVED"] },
        },
        select: { id: true },
      });
      if (reg) hasAccess = true;
    }

    if (!hasAccess) {
      const grant = await db.courseAccess.findUnique({
        where: { userId_courseSlug: { userId, courseSlug: slug } },
        select: { id: true },
      });
      if (grant) hasAccess = true;
    }
  }

  if (!hasAccess && course.accessLevel === "ROLE_REQUIRED") {
    if (isAdmin || course.requiredRoles.some((r) => userRoles.includes(r))) {
      hasAccess = true;
    }
    if (!hasAccess) {
      const grant = await db.courseAccess.findUnique({
        where: { userId_courseSlug: { userId, courseSlug: slug } },
        select: { id: true },
      });
      if (grant) hasAccess = true;
    }
  }

  if (!hasAccess) {
    const isRoleGated = course.accessLevel === "ROLE_REQUIRED";
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
            {isRoleGated
              ? "Access to this series is restricted to specific community roles."
              : "Access to this series requires registration for the associated program."}
          </p>
          {!isRoleGated && (
            <Link href="/community-programs" className="crs-gate__link">
              View programs →
            </Link>
          )}
        </div>
      </div>
    );
  }

  const lessonItems = course.lessons;

  // ── Progress & enrollment ──────────────────────────────────────────────────
  const lessonIds = lessonItems.map((cl) => cl.lessonId);

  const [progressRecords, enrollment] = await Promise.all([
    lessonIds.length > 0
      ? db.lessonProgress.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: { lessonId: true },
        })
      : [],
    db.seriesEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { enrolledAt: true, completedAt: true, enrollmentSource: true },
    }),
  ]);

  const completedIds = new Set(progressRecords.map((p) => p.lessonId));
  const completedCount = completedIds.size;
  const totalCount = lessonItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ── Drip availability ──────────────────────────────────────────────────────
  const now = new Date();
  const lessonAvailability = new Map<string, boolean>(); // lessonId → available

  if (course.dripEnabled) {
    lessonItems.forEach((cl, index) => {
      const available = isLessonAvailable(
        {
          id: cl.lesson.id,
          releaseDate: cl.lesson.releaseDate,
          releaseDelayDays: cl.lesson.releaseDelayDays,
        },
        index,
        { dripEnabled: course.dripEnabled, dripIntervalDays: course.dripIntervalDays },
        enrollment ? { enrolledAt: enrollment.enrolledAt } : null,
        now
      );
      lessonAvailability.set(cl.lessonId, available);
    });
  } else {
    lessonItems.forEach((cl) => lessonAvailability.set(cl.lessonId, true));
  }

  // Find the first incomplete AND available lesson for "Continue →"
  const firstIncomplete = lessonItems.find(
    (cl) => !completedIds.has(cl.lessonId) && (lessonAvailability.get(cl.lessonId) !== false)
  );
  const isFullyComplete = totalCount > 0 && completedCount === totalCount;

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

      {/* ── Enrollment + Progress ── */}
      {lessonItems.length > 0 && (
        <div className="crs-meta-bar">
          <EnrollButton
            courseSlug={slug}
            initialEnrolled={!!enrollment}
            enrollmentSource={enrollment?.enrollmentSource ?? undefined}
          />

          {enrollment && (
            <div className="crs-progress">
              <div className="crs-progress__bar-wrap">
                <div
                  className="crs-progress__bar"
                  style={{ width: `${progressPct}%` }}
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <span className="crs-progress__label">
                {isFullyComplete
                  ? "Series complete"
                  : `${completedCount} of ${totalCount} complete`}
              </span>
            </div>
          )}

          {/* Continue / Start button — only shown when enrolled */}
          {enrollment && !isFullyComplete && firstIncomplete && (
            <Link
              href={`/lessons/${firstIncomplete.lesson.slug}?course=${slug}`}
              className="crs-continue-btn"
            >
              {completedCount === 0 ? "Start series →" : "Continue →"}
            </Link>
          )}
        </div>
      )}

      {/* ── Lesson list ── */}
      {lessonItems.length > 0 ? (
        <div className="crs-lessons">
          <div className="crs-toc">
            {lessonItems.map((cl, i) => {
              const hasAudio = !!cl.lesson.audioUrl;
              const hasVideo = !!cl.lesson.videoUrl;
              const mediaType = hasAudio ? "audio" : hasVideo ? "video" : "text";
              const isComplete = completedIds.has(cl.lessonId);
              const available = lessonAvailability.get(cl.lessonId) !== false;

              if (!available) {
                const availDate = enrollment
                  ? computeAvailableDate(
                      {
                        id: cl.lesson.id,
                        releaseDate: cl.lesson.releaseDate,
                        releaseDelayDays: cl.lesson.releaseDelayDays,
                      },
                      i,
                      { dripEnabled: course.dripEnabled, dripIntervalDays: course.dripIntervalDays },
                      { enrolledAt: enrollment.enrolledAt }
                    )
                  : null;

                return (
                  <div key={cl.lessonId}>
                    {cl.groupLabel && (
                      <p className="crs-toc__section">{cl.groupLabel}</p>
                    )}
                    <div
                      className="crs-toc__item crs-toc__item--locked"
                      title={availDate ? `Available ${formatAvailableDate(availDate)}` : "Not yet available"}
                    >
                      <span className="crs-toc__num crs-toc__num--locked">🔒</span>
                      <span className="crs-toc__title crs-toc__title--locked">{cl.lesson.titleDisplayed}</span>
                      {availDate && (
                        <span className="crs-toc__available-date">Available {formatAvailableDate(availDate)}</span>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={cl.lessonId}>
                  {cl.groupLabel && (
                    <p className="crs-toc__section">{cl.groupLabel}</p>
                  )}
                  <Link
                    href={`/lessons/${cl.lesson.slug}?course=${course.slug}`}
                    className={`crs-toc__item${isComplete ? " crs-toc__item--complete" : ""}`}
                  >
                    <span className={`crs-toc__num${isComplete ? " crs-toc__num--complete" : ""}`}>
                      {isComplete ? <CheckIcon /> : i + 1}
                    </span>
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
