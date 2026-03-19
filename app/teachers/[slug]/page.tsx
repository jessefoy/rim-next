import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await db.teacherProfile.findUnique({
    where: { slug },
    select: {
      bio: true,
      user: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });
  if (!profile) return { title: "Teacher Not Found" };
  const name = [profile.user.preferredName || profile.user.firstName, profile.user.lastName]
    .filter(Boolean)
    .join(" ");
  return {
    title: `${name} — Rooted In Mindfulness`,
    description: profile.bio?.slice(0, 160) || `Teachings by ${name} at Rooted In Mindfulness.`,
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

  const profile = await db.teacherProfile.findUnique({
    where: { slug },
    select: {
      bio: true,
      photoUrl: true,
      isPublic: true,
      user: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });

  if (!profile || !profile.isPublic) notFound();

  const name = [profile.user.preferredName || profile.user.firstName, profile.user.lastName]
    .filter(Boolean)
    .join(" ");

  const uniqueCoursesWithCount: CourseWithCount[] = [];

  return (
    <div className="tpr-page">
      <header className="tpr-header">
        {profile.photoUrl && (
          <img
            src={profile.photoUrl}
            alt={name}
            className="tpr-photo"
          />
        )}
        <h1 className="tpr-name">{name}</h1>
        {profile.bio && (
          <p className="tpr-bio">{profile.bio}</p>
        )}
      </header>

      {uniqueCoursesWithCount.length > 0 && (
        <section className="tpr-teachings">
          <h2 className="tpr-teachings__title">Teachings by {name}</h2>
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
