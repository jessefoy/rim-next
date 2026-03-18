import Link from "next/link";
import { db } from "@/lib/db";
import { extractText } from "@/lib/renderRichContent";

export const metadata = {
  title: "Teachers — Rooted In Mindfulness",
};

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const teachers = await db.teacher.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { name: true, slug: true, bio: true, photoUrl: true },
  });

  return (
    <div className="tpr-listing-page">
      <h1 className="tpr-listing-title">Teachers</h1>

      {teachers.length === 0 ? (
        <p style={{ color: "var(--rim-text-muted)" }}>No teachers listed yet.</p>
      ) : (
        <div className="tpr-grid">
          {teachers.map((teacher) => {
            const bioExcerpt = teacher.bio
              ? extractText(teacher.bio).slice(0, 120)
              : "";

            return (
              <Link
                key={teacher.slug}
                href={`/teachers/${teacher.slug}`}
                className="tpr-card"
              >
                {teacher.photoUrl ? (
                  <img
                    src={teacher.photoUrl}
                    alt={teacher.name}
                    className="tpr-card__photo"
                  />
                ) : (
                  <div className="tpr-card__photo-placeholder" aria-hidden="true">
                    {teacher.name.charAt(0)}
                  </div>
                )}
                <div className="tpr-card__name">{teacher.name}</div>
                {bioExcerpt && (
                  <div className="tpr-card__bio">{bioExcerpt}{bioExcerpt.length >= 120 ? "…" : ""}</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
