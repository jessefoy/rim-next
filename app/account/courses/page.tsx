import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import MyCourseLibrary from "@/components/MyCourseLibrary";
import ManualHelpIcon from "@/components/ManualHelpIcon";

export const metadata = { title: "My Courses — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const enrollments = await db.seriesEnrollment.findMany({
    where: { userId, course: { isActive: true } },
    include: {
      course: {
        include: {
          lessons: {
            include: { lesson: { select: { slug: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  // Fetch progress for all lessons across all enrollments
  const allLessonIds = enrollments.flatMap((e) => e.course.lessons.map((cl) => cl.lessonId));
  const progressRecords =
    allLessonIds.length > 0
      ? await db.lessonProgress.findMany({
          where: { userId, lessonId: { in: allLessonIds } },
          select: { lessonId: true },
        })
      : [];
  const completedSet = new Set(progressRecords.map((p) => p.lessonId));

  // Serialize — never spread Prisma includes; always build explicitly
  const serialized = enrollments.map((e) => {
    const lessonIds = e.course.lessons.map((cl) => cl.lessonId);
    const completedCount = lessonIds.filter((id) => completedSet.has(id)).length;
    const firstLesson = e.course.lessons[0]?.lesson ?? null;
    const firstIncomplete = e.course.lessons.find((cl) => !completedSet.has(cl.lessonId));

    return {
      courseId: e.courseId,
      courseSlug: e.course.slug,
      courseTitle: e.course.title,
      courseSubheading: e.course.subheading ?? null,
      enrolledAt: e.enrolledAt.toISOString(),
      completedAt: e.completedAt?.toISOString() ?? null,
      enrollmentSource: e.enrollmentSource as string,
      totalLessons: lessonIds.length,
      completedLessons: completedCount,
      firstLessonSlug: firstLesson?.slug ?? null,
      nextLessonSlug: firstIncomplete?.lesson?.slug ?? null,
    };
  });

  return (
    <AccountLayout>
      <div style={{ position: "relative" }}>
        <ManualHelpIcon manualSlug="member-courses" />
        <MyCourseLibrary enrollments={serialized} />
      </div>
    </AccountLayout>
  );
}
