import { auth } from "@/auth";
import { db } from "@/lib/db";
import CourseBrowse from "@/components/CourseBrowse";
import ManualHelpIcon from "@/components/ManualHelpIcon";

export const metadata = { title: "Courses — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const userRoles = session?.user?.roles ?? [];
  const isAdmin = userRoles.includes("ADMIN");

  // Fetch all active non-onboarding courses with lessons for teacher extraction
  const courses = await db.course.findMany({
    where: { isActive: true, isOnboarding: false },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      _count: { select: { lessons: true } },
      lessons: {
        include: {
          lesson: {
            select: {
              id: true,
              teachers: {
                include: {
                  teacher: { select: { name: true, slug: true } },
                },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // Filter by access level
  const visibleCourses = courses.filter((c) => {
    if (c.accessLevel === "ALL_MEMBERS") return true;
    if (c.accessLevel === "REGISTRATION_REQUIRED") return true;
    if (c.accessLevel === "ROLE_REQUIRED") {
      return isAdmin || c.requiredRoles.some((r) => userRoles.includes(r));
    }
    return true;
  });

  // Fetch categories that have visible courses
  const categoryIds = new Set(visibleCourses.map((c) => c.categoryId).filter(Boolean));
  const categories = await db.courseCategory.findMany({
    where: { id: { in: [...categoryIds] as string[] } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  // Fetch enrollments and progress for logged-in members
  let enrollmentMap: Record<string, { enrollmentSource: string; completedAt: string | null }> = {};
  let progressMap: Record<string, number> = {};

  if (userId) {
    const enrollments = await db.seriesEnrollment.findMany({
      where: { userId, courseId: { in: visibleCourses.map((c) => c.id) } },
      select: { courseId: true, enrollmentSource: true, completedAt: true },
    });
    for (const e of enrollments) {
      enrollmentMap[e.courseId] = {
        enrollmentSource: e.enrollmentSource as string,
        completedAt: e.completedAt?.toISOString() ?? null,
      };
    }

    // Compute per-course lesson completion counts
    const enrolledCourseIds = enrollments.map((e) => e.courseId);
    if (enrolledCourseIds.length > 0) {
      const allLessons = await db.courseLesson.findMany({
        where: { courseId: { in: enrolledCourseIds } },
        select: { courseId: true, lessonId: true },
      });
      const progressRecords = await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: allLessons.map((l) => l.lessonId) } },
        select: { lessonId: true },
      });
      const completedSet = new Set(progressRecords.map((p) => p.lessonId));
      for (const l of allLessons) {
        if (!progressMap[l.courseId]) progressMap[l.courseId] = 0;
        if (completedSet.has(l.lessonId)) progressMap[l.courseId]++;
      }
    }
  }

  // Serialize for client component
  const serializedCourses = visibleCourses.map((c) => {
    // Collect unique teachers from all lessons
    const teachers: { name: string; slug: string }[] = [];
    const seenSlugs = new Set<string>();
    for (const cl of c.lessons) {
      for (const lt of cl.lesson.teachers) {
        if (!seenSlugs.has(lt.teacher.slug)) {
          teachers.push({ name: lt.teacher.name, slug: lt.teacher.slug });
          seenSlugs.add(lt.teacher.slug);
        }
      }
    }
    const enrollment = enrollmentMap[c.id] ?? null;
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      subheading: c.subheading ?? null,
      accessLevel: c.accessLevel as string,
      categoryId: c.categoryId ?? null,
      categoryName: c.category?.name ?? null,
      lessonCount: c._count.lessons,
      teachers,
      enrollment,
      completedLessons: progressMap[c.id] ?? 0,
    };
  });

  return (
    <div style={{ position: "relative" }}>
      <ManualHelpIcon manualSlug="member-courses" />
      <CourseBrowse
        courses={serializedCourses}
        categories={categories}
        isLoggedIn={!!userId}
      />
    </div>
  );
}
