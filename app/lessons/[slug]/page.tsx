import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { renderContentBody } from "@/lib/renderRichContent";
import AudioPlayer from "@/components/AudioPlayer";
import LessonFooterClient from "@/components/LessonFooterClient";
import { isLessonAvailable, computeAvailableDate, formatAvailableDate } from "@/lib/drip";

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
        include: { teacher: { select: { id: true, name: true, slug: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!lesson) notFound();
  const userId = session.user.id!;
  const isStaff = (session.user.roles ?? []).some((r: string) => ["TEACHER", "ADMIN"].includes(r));

  // ── Access check ─────────────────────────────────────────────────────────
  // MEMBERS lessons: any logged-in user.
  // REGISTRATION_REQUIRED lessons: must have access via a parent course.
  if (lesson.accessLevel === "REGISTRATION_REQUIRED") {
    const parentCourses = await db.courseLesson.findMany({
      where: { lessonId: lesson.id, course: { isActive: true } },
      include: { course: { select: { id: true, slug: true, accessLevel: true } } },
    });

    // Standalone REGISTRATION_REQUIRED: no course to check against — allow any member.
    let hasAccess = parentCourses.length === 0;

    for (const cl of parentCourses) {
      if (hasAccess) break;
      // If the parent course itself allows all members, lesson is accessible
      if (cl.course.accessLevel === "ALL_MEMBERS") { hasAccess = true; break; }

      // Check program registration
      const programCourses = await db.programCourse.findMany({
        where: { courseId: cl.course.id },
        select: { programId: true },
      });
      if (programCourses.length > 0) {
        const reg = await db.registration.findFirst({
          where: {
            userId: session.user.id,
            programId: { in: programCourses.map((pc) => pc.programId) },
            status: { in: ["REGISTERED", "APPROVED"] },
          },
          select: { id: true },
        });
        if (reg) { hasAccess = true; break; }
      }

      // Check manual admin grant
      const grant = await db.courseAccess.findUnique({
        where: { userId_courseSlug: { userId: session.user.id, courseSlug: cl.course.slug } },
        select: { id: true },
      });
      if (grant) { hasAccess = true; break; }
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
              Access to this lesson requires registration for the associated program.
            </p>
            <Link href="/community-programs" style={{ color: "var(--rim-blue)" }}>
              View programs →
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

  // ── Drip check ─────────────────────────────────────────────────────────────
  if (courseContext) {
    const [dripCourse, dripEnrollment] = await Promise.all([
      db.course.findUnique({
        where: { slug: courseContext.course.slug },
        select: {
          dripEnabled: true,
          dripIntervalDays: true,
          lessons: { select: { lessonId: true }, orderBy: { sortOrder: "asc" } },
        },
      }),
      db.seriesEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId: courseContext.course.id } },
        select: { enrolledAt: true },
      }),
    ]);

    if (dripCourse?.dripEnabled) {
      const positionIndex = dripCourse.lessons.findIndex((cl) => cl.lessonId === lesson.id);
      const available = isLessonAvailable(
        { id: lesson.id, releaseDate: lesson.releaseDate, releaseDelayDays: lesson.releaseDelayDays },
        positionIndex >= 0 ? positionIndex : 0,
        { dripEnabled: dripCourse.dripEnabled, dripIntervalDays: dripCourse.dripIntervalDays },
        dripEnrollment,
        new Date()
      );

      if (!available) {
        const availDate = dripEnrollment
          ? computeAvailableDate(
              { id: lesson.id, releaseDate: lesson.releaseDate, releaseDelayDays: lesson.releaseDelayDays },
              positionIndex >= 0 ? positionIndex : 0,
              { dripEnabled: dripCourse.dripEnabled, dripIntervalDays: dripCourse.dripIntervalDays },
              dripEnrollment
            )
          : null;

        return (
          <div className="lp-page">
            {courseContext && (
              <div className="lp-breadcrumb">
                <Link href={`/course/${courseContext.course.slug}`} className="lp-breadcrumb__link">
                  ← {courseContext.course.title}
                </Link>
              </div>
            )}
            <header className="lp-header">
              <div className="lp-header__inner">
                <p className="lp-label">{courseContext.course.title}</p>
                <h1 className="lp-title">{lesson.titleDisplayed}</h1>
              </div>
            </header>
            <div className="lp-content">
              <div className="lp-drip-locked">
                <p className="lp-drip-locked__msg">This lesson isn&apos;t available yet.</p>
                {availDate && (
                  <p className="lp-drip-locked__date">
                    Available {formatAvailableDate(availDate)}
                  </p>
                )}
                <Link href={`/course/${courseContext.course.slug}`} className="lp-drip-locked__back">
                  ← Back to series
                </Link>
              </div>
            </div>
          </div>
        );
      }
    }
  }

  const hasAudio = !!lesson.audioUrl;
  const hasQuote = !!lesson.headerQuote;
  const resources = (lesson.resources as { name: string; url: string; resourceType: string }[]) ?? [];
  const hasResources = resources.length > 0;
  const hasTeachers = lesson.teachers.length > 0;

  const bodyHtml = renderContentBody(lesson.body);

  // ── Progress, enrollment, notes & questions ────────────────────────────────
  const [progressRecord, enrollment, lessonNote, rawQuestions] = await Promise.all([
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
    // Fetch questions for enrolled members OR staff (staff can preview without enrolling)
    (courseContext || isStaff)
      ? db.reflectionQuestion.findMany({
          where: { lessonId: lesson.id },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            body: true,
            sortOrder: true,
            options: {
              orderBy: { sortOrder: "asc" },
              // omit isCorrect — members should not see the answer in page source
              select: { id: true, text: true, sortOrder: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const isComplete = !!progressRecord;
  const isEnrolled = !!enrollment;

  // Fetch existing responses and compute allCorrect for enrolled members
  let initialAllCorrect = false;
  let questionsWithResponses: {
    id: string; body: unknown; sortOrder: number;
    options: { id: string; text: string; sortOrder: number }[];
    responseOptionId: string | null;
  }[] = [];

  if ((isEnrolled || isStaff) && rawQuestions.length > 0) {
    const questionIds = rawQuestions.map((q) => q.id);
    const [responses, correctOptions] = await Promise.all([
      db.reflectionResponse.findMany({
        where: { userId, questionId: { in: questionIds } },
        select: { questionId: true, optionId: true },
      }),
      // Fetch correct option IDs to compute allCorrect server-side
      db.reflectionOption.findMany({
        where: { questionId: { in: questionIds }, isCorrect: true },
        select: { id: true, questionId: true },
      }),
    ]);

    const responseMap = new Map(responses.map((r) => [r.questionId, r.optionId]));
    const correctMap = new Map(correctOptions.map((o) => [o.questionId, o.id]));

    questionsWithResponses = rawQuestions.map((q) => ({
      ...q,
      responseOptionId: responseMap.get(q.id) ?? null,
    }));

    // All correct = every question has a response that matches its correct option
    initialAllCorrect =
      rawQuestions.length > 0 &&
      rawQuestions.every((q) => {
        const responded = responseMap.get(q.id);
        const correct = correctMap.get(q.id);
        return responded != null && correct != null && responded === correct;
      });
  }

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
          <div className="lp-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
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
              {lesson.teachers.map((lt, i) => (
                <span key={lt.teacher.id}>
                  {i > 0 && ", "}
                  <span className="lp-teacher-link">{lt.teacher.name}</span>
                </span>
              ))}
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
            questionsRequired={lesson.questionsRequired}
            initialQuestions={questionsWithResponses}
            initialAllCorrect={initialAllCorrect}
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
