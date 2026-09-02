import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = {
  title: "Teachers — Rooted In Mindfulness",
};

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const profiles = await db.teacherProfile.findMany({
    where: { isPublic: true, slug: { not: null } },
    orderBy: { user: { firstName: "asc" } },
    select: {
      slug: true,
      bio: true,
      photoUrl: true,
      user: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });

  return (
    <div className="pp-page">
      {/* Flat blue hero, the same tier every other static page carries. This
          page had no hero at all and opened on a 32px blue h1 at x=160, which
          made it read as a different site from the one that linked to it. */}
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Who teaches here</p>
          <h1 className="pp-hero__title">Teachers</h1>
          <p className="pp-hero__body">
            The people who hold RIM&rsquo;s classes, sittings, and courses.
          </p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          {profiles.length === 0 ? (
            <div className="pp-panel">
              <p className="pp-panel__body">
                Teacher profiles are on their way. In the meantime,{" "}
                <Link href="/this-week" className="pp-link">
                  see what is happening this week
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="tpr-grid">
              {profiles.map((profile) => {
                const name = [
                  profile.user.preferredName || profile.user.firstName,
                  profile.user.lastName,
                ]
                  .filter(Boolean)
                  .join(" ");
                const bioExcerpt = profile.bio ? profile.bio.slice(0, 120) : "";

                return (
                  <Link
                    key={profile.slug}
                    href={`/teachers/${profile.slug}`}
                    className="pp-card tpr-card"
                  >
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt={name} className="tpr-card__photo" />
                    ) : (
                      <div className="tpr-card__photo-placeholder" aria-hidden="true">
                        {name.charAt(0)}
                      </div>
                    )}
                    <h2 className="tpr-card__name">{name}</h2>
                    {bioExcerpt && (
                      <p className="tpr-card__bio">
                        {bioExcerpt}
                        {bioExcerpt.length >= 120 ? "…" : ""}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
