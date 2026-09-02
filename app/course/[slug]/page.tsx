import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import EnrollButton from "@/components/EnrollButton";
import EnrollDanaButton from "@/components/EnrollDanaButton";
import {
  getCourseAccessState,
  defaultRestrictionMessage,
  type CourseAccessState,
} from "@/lib/courseAccess";

// Shared include — one source of truth for the Course shape the page renders,
// so the helper signatures stay in sync with the actual query.
const courseDetailInclude = Prisma.validator<Prisma.CourseInclude>()({
  category: { select: { id: true, name: true, slug: true } },
  lessons: {
    include: {
      lesson: {
        select: {
          id: true,
          slug: true,
          titleDisplayed: true,
          audioUrl: true,
          videoUrl: true,
          teachers: {
            select: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  preferredName: true,
                  teacherProfile: { select: { slug: true, isPublic: true } },
                },
              },
              order: true,
            },
            orderBy: { order: "asc" },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  },
});

type CourseDetail = Prisma.CourseGetPayload<{ include: typeof courseDetailInclude }>;

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    select: { title: true, subheading: true },
  });
  return {
    title: `${course?.title ?? "Course"} — Rooted In Mindfulness`,
    description: course?.subheading ?? undefined,
  };
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

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ dana?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const userRoles = session?.user?.roles ?? [];

  // Load the course + its lesson preview (titles are visible to non-enrolled
  // visitors per RIM_Offering_Model.md "Lesson preview — show titles").
  const course = await db.course.findUnique({
    where: { slug, isActive: true },
    include: courseDetailInclude,
  });
  if (!course) notFound();

  // Compute the visitor's state once — all rendering branches off of this.
  const state = await getCourseAccessState({
    userId,
    userRoles,
    course: {
      id: course.id,
      slug: course.slug,
      allowSelfEnroll: course.allowSelfEnroll,
      selfEnrollDanaRequired: course.selfEnrollDanaRequired,
      requiredRoles: course.requiredRoles,
    },
  });

  // Aggregate teacher names from lessons (Course has no direct teacher relation;
  // facilitators bubble up from the lesson list).
  const teacherMap = new Map<string, { name: string; slug: string | null }>();
  for (const cl of course.lessons) {
    for (const lt of cl.lesson.teachers) {
      if (!teacherMap.has(lt.user.id)) {
        const name = [lt.user.preferredName || lt.user.firstName, lt.user.lastName].filter(Boolean).join(" ");
        const profileSlug = lt.user.teacherProfile?.isPublic ? lt.user.teacherProfile.slug : null;
        if (name) teacherMap.set(lt.user.id, { name, slug: profileSlug });
      }
    }
  }
  const teacherList = Array.from(teacherMap.values());
  const teacherByline =
    teacherList.length === 0
      ? null
      : teacherList.length === 1
      ? `Taught by ${teacherList[0].name}`
      : teacherList.length === 2
      ? `Taught by ${teacherList[0].name} and ${teacherList[1].name}`
      : `Taught by ${teacherList.slice(0, -1).map((t) => t.name).join(", ")}, and ${teacherList[teacherList.length - 1].name}`;

  const descriptionHtml = course.description
    ? await renderFormattedTextAsync(course.description)
    : "";

  // The enrolled view is the existing TOC + progress experience.
  if (state.kind === "enrolled") {
    return renderEnrolledView({
      course,
      userId: userId!,
      enrollmentSource: state.source,
      descriptionHtml,
      teacherByline,
    });
  }

  // Everyone else gets the landing page. The CTA varies by state.
  return renderLandingView({
    course,
    state,
    descriptionHtml,
    teacherList,
    teacherByline,
    danaResult: resolvedSearch?.dana,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-enrollment landing — public surface. Six states share this layout;
// only the CTA slot changes. Mirrors /programs/[slug] in shape.
// ─────────────────────────────────────────────────────────────────────────────

function renderLandingView({
  course,
  state,
  descriptionHtml,
  teacherList,
  teacherByline,
  danaResult,
}: {
  course: CourseDetail;
  state: CourseAccessState;
  descriptionHtml: string;
  teacherList: { name: string; slug: string | null }[];
  teacherByline: string | null;
  danaResult: string | undefined;
}) {
  const totalLessons = course.lessons.length;
  const heroImage = course.heroImage || "/images/Bodhi-Leaves.jpg";

  return (
    <div className="crs-page crs-page--landing">
      {/* ── Hero ── */}
      <header
        className="crs-hero"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="crs-hero__inner">
          {course.category && (
            <Link href="/courses" className="crs-hero__category">
              {course.category.name}
            </Link>
          )}
          <h1 className="crs-hero__title">{course.title}</h1>
          {course.subheading && (
            <p className="crs-hero__subheading">{course.subheading}</p>
          )}
        </div>
      </header>

      {/* ── Content column ── */}
      <div className="lp-content">

        {/* Dana result banners — shown after Stripe redirects back */}
        {danaResult === "success" && (
          <div className="pg-dana-result pg-dana-result--success">
            ✓ Thank you. Your dana offering has been received. You&rsquo;re enrolled.
          </div>
        )}
        {danaResult === "cancelled" && (
          <div className="pg-dana-result pg-dana-result--cancelled">
            Your dana offering was cancelled. You can return any time to enroll.
          </div>
        )}

        {/* Pull quote — same float-up pattern as Programs */}
        {course.pullQuote && (
          <figure className="pg-quote">
            <blockquote className="pg-quote__text">{course.pullQuote}</blockquote>
            {course.pullQuoteSource && (
              <figcaption className="pg-quote__source">~ {course.pullQuoteSource}</figcaption>
            )}
          </figure>
        )}

        {/* Description */}
        {descriptionHtml && (
          <div
            className="prog-description rim-content rim-content--program"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        )}

        {/* About this course — lesson count, self-paced framing, teacher byline, dana ask */}
        <section className="pg-details-section">
          <h3 className="pg-section-heading">About this course:</h3>

          <div className="pg-detail-row">
            <span className="pg-detail-row__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </span>
            <span className="pg-detail-row__text">
              {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} · self-paced
            </span>
          </div>

          {teacherByline && (
            <div className="pg-detail-row">
              <span className="pg-detail-row__icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <span className="pg-detail-row__text">{teacherByline}</span>
            </div>
          )}

          {course.danaText && (
            <div className="pg-detail-row">
              <span className="pg-detail-row__icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </span>
              <span className="pg-detail-row__text">{course.danaText}</span>
            </div>
          )}

          {/* ── CTA row — state-aware ── */}
          <div className="pg-detail-row pg-detail-row--cta">
            <span className="pg-detail-row__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            </span>
            <span className="pg-detail-row__text">
              {renderCta(state, course)}
            </span>
          </div>
        </section>

        {/* In this course — titles only, not clickable */}
        {course.lessons.length > 0 && (
          <section className="crs-preview">
            <h3 className="pg-section-heading">In this course:</h3>
            <ol className="crs-preview__list">
              {course.lessons.map((cl, i) => (
                <li key={cl.lessonId} className="crs-preview__item">
                  <span className="crs-preview__num">{i + 1}</span>
                  <span className="crs-preview__title">{cl.lesson.titleDisplayed}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Facilitators */}
        {teacherList.length > 0 && (
          <section className="pg-facilitators-section">
            <h3 className="pg-section-heading">Facilitators:</h3>
            <div className="pg-facilitators">
              {teacherList.map((t, i) =>
                t.slug ? (
                  <Link key={i} href={`/teachers/${t.slug}`} className="pg-facilitator pg-facilitator--link">{t.name}</Link>
                ) : (
                  <span key={i} className="pg-facilitator">{t.name}</span>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function renderCta(
  state: CourseAccessState,
  course: {
    slug: string;
    accessRestrictionMessage: string | null;
    danaMode: string;
    suggestedDana: number | null;
    danaBaseAmount: number | null;
    danaFixedAmount: number | null;
  }
) {
  switch (state.kind) {
    case "anonymous": {
      // Sign-in code flow first; come back to this page after sign-in.
      const callback = `/course/${course.slug}`;
      return (
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(callback)}`}
          className="pg-detail-cta__link"
        >
          Sign in to enroll →
        </Link>
      );
    }

    case "can_self_enroll_free":
      return (
        <EnrollButton
          courseSlug={course.slug}
          initialEnrolled={false}
        />
      );

    case "can_self_enroll_dana": {
      // Map the course's danaMode to the button's prop. The "none" case
      // never reaches here (state would have been can_self_enroll_free).
      const mode =
        course.danaMode === "fixed"
          ? "fixed"
          : course.danaMode === "base_plus_dana"
          ? "base_plus_dana"
          : "voluntary";
      return (
        <EnrollDanaButton
          courseSlug={course.slug}
          danaMode={mode}
          suggestedDana={course.suggestedDana}
          danaBaseAmount={course.danaBaseAmount}
          danaFixedAmount={course.danaFixedAmount}
        />
      );
    }

    case "role_gated": {
      const msg = course.accessRestrictionMessage || defaultRestrictionMessage(state);
      return <span className="pg-detail-cta__text">{msg}</span>;
    }

    case "bundled_only": {
      if (state.liveCohort) {
        return (
          <Link
            href={`/programs/${state.liveCohort.programSlug}`}
            className="pg-detail-cta__link"
          >
            Register for the live cohort: {state.liveCohort.programName} →
          </Link>
        );
      }
      const msg = course.accessRestrictionMessage || defaultRestrictionMessage(state);
      return <span className="pg-detail-cta__text">{msg}</span>;
    }

    // Enrolled is handled by renderEnrolledView, never reaches here.
    case "enrolled":
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrolled view — existing TOC + progress UI. Members who completed enrollment
// (any path) land here.
// ─────────────────────────────────────────────────────────────────────────────

async function renderEnrolledView({
  course,
  userId,
  enrollmentSource,
  descriptionHtml,
  teacherByline,
}: {
  course: CourseDetail;
  userId: string;
  enrollmentSource: "SERIES" | "ACCESS_GRANT" | "PROGRAM";
  descriptionHtml: string;
  teacherByline: string | null;
}) {
  const allLessonItems = course.lessons;
  const lessonIds = allLessonItems.map((cl) => cl.lessonId);

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
  const totalCount = allLessonItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const firstIncomplete = allLessonItems.find((cl) => !completedIds.has(cl.lessonId));
  const isFullyComplete = totalCount > 0 && completedCount === totalCount;

  // Group lessons by sectionLabel for the rendered TOC.
  const displayItems = allLessonItems.map((cl) => ({
    cl,
    sectionLabel: cl.groupLabel || null,
  }));

  // The EnrollButton is only meaningful when the enrollment is a SeriesEnrollment.
  // Access grants and Program registrations create implicit access — there's
  // nothing to "leave."
  const hasSeriesEnrollment = enrollmentSource === "SERIES";

  return (
    <div className="crs-page">
      {/* ── Header ── */}
      <header className="crs-header">
        <div className="crs-header__inner">
          <p className="crs-label">
            {course.subheading || "A Teaching Series"}
          </p>
          <h1 className="crs-title">{course.title}</h1>
          {teacherByline && (
            <p className="crs-teacher-byline">{teacherByline}</p>
          )}
          {descriptionHtml && (
            <div
              className="crs-desc rim-content rim-content--program"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          )}
        </div>
      </header>

      <hr className="crs-rule" />

      {/* ── Enrollment + Progress ── */}
      {allLessonItems.length > 0 && (
        <div className="crs-meta-bar">
          {hasSeriesEnrollment && (
            <EnrollButton
              courseSlug={course.slug}
              initialEnrolled={true}
              enrollmentSource={enrollment?.enrollmentSource ?? undefined}
            />
          )}

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

          {!isFullyComplete && firstIncomplete && (
            <Link
              href={`/lessons/${firstIncomplete.lesson.slug}?course=${course.slug}`}
              className="crs-continue-btn"
            >
              {completedCount === 0 ? "Start series →" : "Continue →"}
            </Link>
          )}
        </div>
      )}

      {/* ── Lesson list ── */}
      {displayItems.length > 0 ? (
        <div className="crs-lessons">
          <div className="crs-toc">
            {displayItems.map(({ cl, sectionLabel }) => {
              const hasAudio = !!cl.lesson.audioUrl;
              const hasVideo = !!cl.lesson.videoUrl;
              const mediaType = hasAudio ? "audio" : hasVideo ? "video" : "text";
              const isComplete = completedIds.has(cl.lessonId);
              const globalIdx = allLessonItems.findIndex((a) => a.lessonId === cl.lessonId);

              return (
                <div key={cl.lessonId}>
                  {sectionLabel && (
                    <p className="crs-toc__section">{sectionLabel}</p>
                  )}
                  <Link
                    href={`/lessons/${cl.lesson.slug}?course=${course.slug}`}
                    className={`crs-toc__item${isComplete ? " crs-toc__item--complete" : ""}`}
                  >
                    <span className={`crs-toc__num${isComplete ? " crs-toc__num--complete" : ""}`}>
                      {isComplete ? <CheckIcon /> : globalIdx + 1}
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
