import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Search-result descriptions for a teacher page. TeacherProfile carries no
    role column, so a teacher's role line is kept here by slug; any teacher
    without an entry falls back to the plain form below. When a second teacher
    is added, a profile field is the better home for this. */
const TEACHER_DESCRIPTIONS: Record<string, string> = {
  "jesse-foy":
    "Jesse Foy, founding and guiding teacher of Rooted in Mindfulness in Brookfield, Wisconsin.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await db.teacherProfile.findUnique({
    where: { slug },
    select: {
      isPublic: true,
      user: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });
  // The page 404s for a profile that is not public, so its name must not
  // reach the title or description of that response.
  if (!profile || !profile.isPublic) return { title: "Teacher Not Found" };
  const name = [profile.user.preferredName || profile.user.firstName, profile.user.lastName]
    .filter(Boolean)
    .join(" ");
  return {
    title: `${name} - Rooted In Mindfulness`,
    description:
      TEACHER_DESCRIPTIONS[slug] ??
      `${name}, a teacher at Rooted in Mindfulness in Brookfield, Wisconsin.`,
  };
}

/*
 * A "Teachings by …" section used to render here from a `uniqueCoursesWithCount`
 * array that was initialized empty and never populated — the query that filled
 * it was removed at some point and about forty lines of card markup were left
 * behind, permanently unreachable behind a `.length > 0` guard. That markup is
 * gone as of the session-176 consistency pass; it was not rendering, and a
 * reader could not tell that from looking at the file.
 *
 * Listing a teacher's courses is still worth having. It needs the course →
 * lesson → teacher joins rebuilt, and it needs real public courses to list
 * (the catalog currently holds one test row), so it is backlog, not a silent
 * TODO. Restore it there rather than reviving this shape.
 */
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

  return (
    <div className="pp-page pp-page--spine">
      {/* The portrait belongs in the hero with the name, not stacked above a
          bare h1 on the ground. Both this page and /teachers had no hero at
          all, which is what made them read as a different site. */}
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner tpr-hero__inner">
          {profile.photoUrl && (
            <img src={profile.photoUrl} alt={name} className="tpr-hero__photo" />
          )}
          <div>
            <p className="pp-hero__eyebrow">Teacher</p>
            <h1 className="pp-hero__title">{name}</h1>
          </div>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          {profile.bio ? (
            <div className="pp-prose">
              {profile.bio
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
            </div>
          ) : (
            <div className="pp-panel">
              <p className="pp-panel__body">
                A fuller introduction is on its way.
              </p>
            </div>
          )}

          <div className="pp-actions">
            <Link href="/this-week" className="pp-btn">
              See this week
            </Link>
            <Link href="/teachers" className="pp-link">
              All teachers <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
