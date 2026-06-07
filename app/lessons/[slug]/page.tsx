import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { renderContentBodyAsync } from "@/lib/renderRichContentServer";
import AudioPlayer from "@/components/AudioPlayer";
import LessonFooterClient from "@/components/LessonFooterClient";
import { hasCourseAccess } from "@/lib/courseAccess";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await db.lesson.findUnique({ where: { slug }, select: { titleDisplayed: true } });
  return { title: `${lesson?.titleDisplayed ?? "Lesson"} — Rooted In Mindfulness` };
}

type CourseContext = {
  course: { id: string; slug: string; title: string; completionNote?: string | null };
  lessonNumber: number;
  totalLessons: number;
  prevLesson: { slug: string; titleDisplayed: string } | null;
  nextLesson: { slug: string; titleDisplayed: string } | null;
};

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ course?: string }>;
}) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const { course: courseSlug } = await searchParams;

  const lesson = await db.lesson.findUnique({
    where: { slug },
    include: {
      teachers: {
        include: {
          user: {
            select: {
              id: true, firstName: true, lastName: true, preferredName: true,
              teacherProfile: { select: { slug: true, isPublic: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!lesson) notFound();
  const userId = session.user.id!;
  const isStaff = (session.user.roles ?? []).some((r: string) => ["TEACHER", "ADMIN"].includes(r));

  // ── Access check ─────────────────────────────────────────────────────────
  // Lesson access derives from the parent course(s). A lesson is reachable
  // if the user has access (via SeriesEnrollment, CourseAccess grant, or
  // a linked Program registration) to AT LEAST ONE active parent course.
  // Lesson.accessLevel is no longer consulted for the gate — the course's
  // orthogonal flags + the user's enrollments are the source of truth.
  // (Standalone lessons with no parent course remain accessible to any
  // signed-in member, as before.)
  if (lesson.accessLevel === "REGISTRATION_REQUIRED") {
    const parentCourses = await db.courseLesson.findMany({
      where: { lessonId: lesson.id, course: { isActive: true } },
      include: {
        course: {
          select: {
            id: true,
            slug: true,
            allowSelfEnroll: true,
            selfEnrollDanaRequired: true,
            requiredRoles: true,
          },
        },
      },
    });

    // Standalone REGISTRATION_REQUIRED (no active parent course): allow any member.
    let hasAccess = parentCourses.length === 0;

    if (!hasAccess) {
      // OR-check across parent courses — any one granting access is sufficient.
      for (const cl of parentCourses) {
        const granted = await hasCourseAccess({
          userId: session.user.id ?? null,
          userRoles: session.user.roles ?? [],
          course: cl.course,
        });
        if (granted) { hasAccess = true; break; }
      }
    }

    if (!hasAccess) {
      return (
        <div className="lp-page">
          <header className="lp-header">
            <div className="lp-header__inner">
              <p className="lp-label">Learning &amp; Practice</p>
              <h1 className="lp-title">{lesson.titleDisplayed}</h1>
            </div>
          </header>
          <div className="lp-content">
            <p style={{ color: "var(--rim-text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
              Access to this lesson requires enrollment in the associated course.
            </p>
            <Link href="/courses" style={{ color: "var(--rim-blue)" }}>
              View courses →
            </Link>
          </div>
        </div>
      );
    }
  }

  // ── Course context ─────────────────────────────────────────────────────────
  // If ?course= is set, use that course. Otherwise auto-detect the first active
  // course containing this lesson. Drives breadcrumb + prev/next navigation.
  let courseContext: CourseContext | null = null;

  const courseLessonJoin = await db.courseLesson.findFirst({
    where: {
      lesson: { slug },
      course: {
        isActive: true,
        ...(courseSlug ? { slug: courseSlug } : {}),
      },
    },
    include: {
      course: { select: { id: true, slug: true, title: true, completionNote: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  if (courseLessonJoin) {
    const allLessons = await db.courseLesson.findMany({
      where: { courseId: courseLessonJoin.courseId },
      include: {
        lesson: { select: { id: true, slug: true, titleDisplayed: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    const idx = allLessons.findIndex((cl) => cl.lessonId === lesson.id);
    if (idx !== -1) {
      courseContext = {
        course: {
          id: courseLessonJoin.course.id,
          slug: courseLessonJoin.course.slug,
          title: courseLessonJoin.course.title,
          completionNote: courseLessonJoin.course.completionNote ?? null,
        },
        lessonNumber: idx + 1,
        totalLessons: allLessons.length,
        prevLesson: idx > 0 ? allLessons[idx - 1].lesson : null,
        nextLesson: idx < allLessons.length - 1 ? allLessons[idx + 1].lesson : null,
      };
    }
  }

  const hasAudio = !!lesson.audioUrl;
  const hasQuote = !!lesson.headerQuote;
  const resources = (lesson.resources as { name: string; url: string; resourceType: string }[]) ?? [];
  const hasResources = resources.length > 0;
  const hasTeachers = lesson.teachers.length > 0;

  const bodyHtml = await renderContentBodyAsync(lesson.body);

  // ── Progress, enrollment & notes ───────────────────────────────────────────
  const [progressRecord, enrollment, lessonNote] = await Promise.all([
    db.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      select: { completedAt: true },
    }),
    courseContext
      ? db.seriesEnrollment.findUnique({
          where: { userId_courseId: { userId, courseId: courseContext.course.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
    courseContext
      ? db.lessonNote.findUnique({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
          select: { body: true },
        })
      : Promise.resolve(null),
  ]);
  const isComplete = !!progressRecord;
  const isEnrolled = !!enrollment;

  // Helper: build lesson URL preserving course context
  const lessonUrl = (s: string) =>
    courseContext ? `/lessons/${s}?course=${courseContext.course.slug}` : `/lessons/${s}`;

  return (
    <div className="lp-page">

      {/* ── Breadcrumb: back to course ── */}
      {courseContext && (
        <div className="lp-breadcrumb">
          <Link href={`/course/${courseContext.course.slug}`} className="lp-breadcrumb__link">
            ← {courseContext.course.title}
          </Link>
        </div>
      )}

      {/* ── Header: label + title ── */}
      <header className="lp-header">
        <div className="lp-header__inner">
          <p className="lp-label">
            {courseContext
              ? `${courseContext.course.title} · Lesson ${courseContext.lessonNumber} of ${courseContext.totalLessons}`
              : "Learning & Practice"}
          </p>
          <h1 className="lp-title">{lesson.titleDisplayed}</h1>
        </div>
      </header>

      {/* ── Hero image ── */}
      {lesson.heroImageUrl && (
        <div className="lp-hero-image">
          <img
            src={lesson.heroImageUrl}
            alt={lesson.heroImageAlt ?? lesson.titleDisplayed}
          />
        </div>
      )}

      {/* ── Audio player (below hero image, above content) ── */}
      {hasAudio && (
        <div className="lp-audio">
          <AudioPlayer src={lesson.audioUrl!} />
        </div>
      )}

      {/* ── Content column ── */}
      <div className="lp-content">

        {/* Pull quote — shown when no audio file is set */}
        {hasQuote && !hasAudio && (
          <figure className="lp-pullquote">
            {lesson.headerQuote}
            {lesson.quoteSource && (
              <cite className="lp-pullquote__cite">— {lesson.quoteSource}</cite>
            )}
          </figure>
        )}

        {/* Video */}
        {lesson.videoUrl && (
          <div className="lp-video">
            <iframe
              src={lesson.videoUrl}
              frameBorder="0"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        )}

        {/* Body content (Tiptap JSON → HTML) */}
        {bodyHtml && (
          <div className="lp-body rim-content rim-content--lesson" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        )}

        {(hasResources || hasTeachers) && <hr className="lp-divider" />}

        {/* Downloadable resources */}
        {hasResources && (
          <div className="lp-resources">
            <p className="lp-resources__label">Downloadable Resources</p>
            {resources.map((resource, i) => (
              <div key={i} className="lp-resources__item">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-resource-link"
                >
                  {resource.name}
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Teachers */}
        {hasTeachers && (
          <div className="lp-teachers-simple">
            <p className="lp-resources__label">Teachers</p>
            <p>
              {lesson.teachers.map((lt, i) => {
                const name = [lt.user.preferredName || lt.user.firstName, lt.user.lastName].filter(Boolean).join(" ");
                const profileSlug = lt.user.teacherProfile?.isPublic ? lt.user.teacherProfile.slug : null;
                return (
                  <span key={lt.user.id}>
                    {i > 0 && ", "}
                    {profileSlug ? (
                      <a href={`/teachers/${profileSlug}`} className="lp-teacher-link">{name}</a>
                    ) : (
                      <span className="lp-teacher-link">{name}</span>
                    )}
                  </span>
                );
              })}
            </p>
          </div>
        )}

        {/* ── Learning footer — enrolled members + staff preview ── */}
        {(isEnrolled || isStaff) && (
          <LessonFooterClient
            lessonSlug={lesson.slug}
            courseSlug={courseContext?.course.slug}
            reflectionPrompt={lesson.reflectionPrompt}
            initialNoteBody={(lessonNote?.body ?? null) as object | null}
            initialCompleted={isComplete}
            courseCompletionNote={courseContext?.course.completionNote ?? null}
          />
        )}


      </div>

      {/* ── Lesson navigation ── */}
      {courseContext && (
        <nav className="lp-lesson-nav" aria-label="Lesson navigation">
          <div className="lp-lesson-nav__inner">

            {/* Left: prev lesson or back to series */}
            <div className="lp-lesson-nav__prev">
              {courseContext.prevLesson ? (
                <Link
                  href={lessonUrl(courseContext.prevLesson.slug)}
                  className="lp-lesson-nav__link lp-lesson-nav__link--prev"
                >
                  <span className="lp-lesson-nav__dir">← Previous</span>
                  <span className="lp-lesson-nav__name">{courseContext.prevLesson.titleDisplayed}</span>
                </Link>
              ) : (
                <Link
                  href={`/course/${courseContext.course.slug}`}
                  className="lp-lesson-nav__link lp-lesson-nav__link--prev"
                >
                  <span className="lp-lesson-nav__dir">← Back to series</span>
                  <span className="lp-lesson-nav__name">{courseContext.course.title}</span>
                </Link>
              )}
            </div>

            <div className="lp-lesson-nav__count">
              {courseContext.lessonNumber} / {courseContext.totalLessons}
            </div>

            {/* Right: next lesson or series overview */}
            <div className="lp-lesson-nav__next">
              {courseContext.nextLesson ? (
                <Link
                  href={lessonUrl(courseContext.nextLesson.slug)}
                  className="lp-lesson-nav__link lp-lesson-nav__link--next"
                >
                  <span className="lp-lesson-nav__dir">Next →</span>
                  <span className="lp-lesson-nav__name">{courseContext.nextLesson.titleDisplayed}</span>
                </Link>
              ) : courseContext.totalLessons > 1 ? (
                <Link
                  href={`/course/${courseContext.course.slug}`}
                  className="lp-lesson-nav__link lp-lesson-nav__link--next"
                >
                  <span className="lp-lesson-nav__dir">Series overview →</span>
                  <span className="lp-lesson-nav__name">{courseContext.course.title}</span>
                </Link>
              ) : null}
            </div>

          </div>
        </nav>
      )}

    </div>
  );
}
