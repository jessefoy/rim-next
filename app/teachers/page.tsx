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
    <div className="tpr-listing-page">
      <h1 className="tpr-listing-title">Teachers</h1>

      {profiles.length === 0 ? (
        <p style={{ color: "var(--rim-text-muted)" }}>No teachers listed yet.</p>
      ) : (
        <div className="tpr-grid">
          {profiles.map((profile) => {
            const name = [profile.user.preferredName || profile.user.firstName, profile.user.lastName]
              .filter(Boolean)
              .join(" ");
            const bioExcerpt = profile.bio ? profile.bio.slice(0, 120) : "";

            return (
              <Link
                key={profile.slug}
                href={`/teachers/${profile.slug}`}
                className="tpr-card"
              >
                {profile.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={name}
                    className="tpr-card__photo"
                  />
                ) : (
                  <div className="tpr-card__photo-placeholder" aria-hidden="true">
                    {name.charAt(0)}
                  </div>
                )}
                <div className="tpr-card__name">{name}</div>
                {bioExcerpt && (
                  <div className="tpr-card__bio">
                    {bioExcerpt}{bioExcerpt.length >= 120 ? "…" : ""}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
