import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { renderContentBody } from "@/lib/renderRichContent";
import DanaSection from "@/components/DanaSection";
import AudioPlayer from "@/components/AudioPlayer";
import MarkCompleteButton from "@/components/MarkCompleteButton";
import LessonNoteEditor from "@/components/LessonNoteEditor";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await db.lesson.findUnique({ where: { slug }, select: { titleDisplayed: true } });
  return { title: `${lesson?.titleDisplayed ?? "Lesson"} — Rooted In Mindfulness` };
}

type CourseContext = {
  course: { slug: string; title: string };
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

  const lesson = await db.lesson.findUnique({ where: { slug } });
  if (!lesson) notFound();

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
      if (cl.course.accessLevel === "MEMBERS") { hasAccess = true; break; }

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
      course: { select: { id: true, slug: true, title: true } },
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
        course: courseLessonJoin.course,
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
  const hasTeachers = lesson.teacherNames.length > 0;

  const bodyHtml = renderContentBody(lesson.body);

  // ── Progress & notes ───────────────────────────────────────────────────────
  const [progressRecord, existingNote] = await Promise.all([
    db.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: session.user.id!, lessonId: lesson.id } },
      select: { completedAt: true },
    }),
    db.lessonNote.findUnique({
      where: { userId_lessonId: { userId: session.user.id!, lessonId: lesson.id } },
      select: { body: true },
    }),
  ]);
  const isComplete = !!progressRecord;

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
            <p>{lesson.teacherNames.join(", ")}</p>
          </div>
        )}

        {/* Reflection prompt */}
        {lesson.reflectionPrompt && (
          <div className="lp-reflection">
            <p className="lp-reflection__text">{lesson.reflectionPrompt}</p>
          </div>
        )}

        {/* Mark complete */}
        <div className="lp-complete-wrap">
          <MarkCompleteButton
            lessonSlug={lesson.slug}
            courseSlug={courseContext?.course.slug}
            initialCompleted={isComplete}
          />
        </div>

        {/* Personal notes */}
        <div className="lp-notes-section">
          <LessonNoteEditor
            lessonSlug={lesson.slug}
            initialBody={existingNote?.body ?? null}
          />
        </div>

        <DanaSection />

      </div>

      {/* ── Lesson navigation ── */}
      {courseContext && (
        <nav className="lp-lesson-nav" aria-label="Lesson navigation">
          <div className="lp-lesson-nav__inner">

            <div className="lp-lesson-nav__prev">
              {courseContext.prevLesson ? (
                <Link
                  href={lessonUrl(courseContext.prevLesson.slug)}
                  className="lp-lesson-nav__link lp-lesson-nav__link--prev"
                >
                  <span className="lp-lesson-nav__arrow">←</span>
                  <span className="lp-lesson-nav__meta">Previous</span>
                  <span className="lp-lesson-nav__name">{courseContext.prevLesson.titleDisplayed}</span>
                </Link>
              ) : (
                <Link
                  href={`/course/${courseContext.course.slug}`}
                  className="lp-lesson-nav__link lp-lesson-nav__link--prev"
                >
                  <span className="lp-lesson-nav__arrow">←</span>
                  <span className="lp-lesson-nav__meta">Back to series</span>
                  <span className="lp-lesson-nav__name">{courseContext.course.title}</span>
                </Link>
              )}
            </div>

            <div className="lp-lesson-nav__count">
              {courseContext.lessonNumber} / {courseContext.totalLessons}
            </div>

            <div className="lp-lesson-nav__next">
              {courseContext.nextLesson ? (
                <Link
                  href={lessonUrl(courseContext.nextLesson.slug)}
                  className="lp-lesson-nav__link lp-lesson-nav__link--next"
                >
                  <span className="lp-lesson-nav__name">{courseContext.nextLesson.titleDisplayed}</span>
                  <span className="lp-lesson-nav__meta">Next</span>
                  <span className="lp-lesson-nav__arrow">→</span>
                </Link>
              ) : (
                <Link
                  href={`/course/${courseContext.course.slug}`}
                  className="lp-lesson-nav__link lp-lesson-nav__link--next"
                >
                  <span className="lp-lesson-nav__name">{courseContext.course.title}</span>
                  <span className="lp-lesson-nav__meta">Series overview</span>
                  <span className="lp-lesson-nav__arrow">→</span>
                </Link>
              )}
            </div>

          </div>
        </nav>
      )}

    </div>
  );
}
