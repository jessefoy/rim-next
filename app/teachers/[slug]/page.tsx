import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { renderFormattedText, extractText } from "@/lib/renderRichContent";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const teacher = await db.teacher.findUnique({
    where: { slug },
    select: { name: true, bio: true },
  });
  if (!teacher) return { title: "Teacher Not Found" };
  const bioText = teacher.bio ? extractText(teacher.bio).slice(0, 160) : "";
  return {
    title: `${teacher.name} — Rooted In Mindfulness`,
    description: bioText || `Teachings by ${teacher.name} at Rooted In Mindfulness.`,
  };
}

type AccessLevel = "ALL_MEMBERS" | "REGISTRATION_REQUIRED" | "ROLE_REQUIRED";

interface CourseWithCount {
  course: {
    id: string;
    title: string;
    slug: string;
    subheading: string | null;
    accessLevel: AccessLevel;
  };
  lessonCount: number;
}

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const teacher = await db.teacher.findUnique({
    where: { slug },
    include: {
      lessons: {
        include: {
          lesson: {
            include: {
              courses: {
                include: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                      slug: true,
                      subheading: true,
                      accessLevel: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!teacher) notFound();
  if (!teacher.isActive && teacher.lessons.length === 0) notFound();

  // Build deduplicated course map with lesson counts
  const courseMap = new Map<string, CourseWithCount>();
  for (const lt of teacher.lessons) {
    for (const cl of lt.lesson.courses) {
      const c = cl.course;
      if (courseMap.has(c.id)) {
        courseMap.get(c.id)!.lessonCount += 1;
      } else {
        courseMap.set(c.id, { course: c, lessonCount: 1 });
      }
    }
  }
  const uniqueCoursesWithCount = Array.from(courseMap.values());

  const bioHtml = teacher.bio ? renderFormattedText(teacher.bio) : null;

  return (
    <div className="tpr-page">
      <header className="tpr-header">
        {teacher.photoUrl && (
          <img
            src={teacher.photoUrl}
            alt={teacher.name}
            className="tpr-photo"
          />
        )}
        <h1 className="tpr-name">{teacher.name}</h1>
        {bioHtml && (
          <div
            className="tpr-bio"
            dangerouslySetInnerHTML={{ __html: bioHtml }}
          />
        )}
        {!teacher.isActive && (
          <p className="tpr-inactive-note">Previously taught at Rooted In Mindfulness</p>
        )}
      </header>

      {uniqueCoursesWithCount.length > 0 && (
        <section className="tpr-teachings">
          <h2 className="tpr-teachings__title">Teachings by {teacher.name}</h2>
          <div className="tpr-teachings__list">
            {uniqueCoursesWithCount.map(({ course, lessonCount }) => (
              <Link
                key={course.id}
                href={`/course/${course.slug}`}
                className="tpr-course-card"
              >
                <div className="tpr-course-card__title">{course.title}</div>
                {course.subheading && (
                  <div className="tpr-course-card__sub">{course.subheading}</div>
                )}
                <div className="tpr-course-card__meta">
                  <span>
                    {lessonCount} lesson{lessonCount !== 1 ? "s" : ""}
                  </span>
                  {course.accessLevel !== "ALL_MEMBERS" && (
                    <span className="tpr-course-card__access">
                      {course.accessLevel === "REGISTRATION_REQUIRED"
                        ? "Registration required"
                        : "Members only"}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
