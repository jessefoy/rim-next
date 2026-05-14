import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { groupManualSections } from "@/lib/manualGroups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Volunteer Manual — Rooted In Mindfulness" };

const hubLabel: Record<string, string> = {
  courses:     "Course Hub",
  "host-team": "Host Hub",
  support:     "Support Hub",
  registrar:   "Registrar Hub",
};

export default async function ManualIndexPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const sections = await db.manualSection.findMany({
    orderBy: { order: "asc" },
    select:  { slug: true, title: true, description: true, hubSlug: true },
  });

  const grouped = groupManualSections(sections);

  return (
    <div className="man-idx">
      <div className="man-idx__header">
        <h1 className="man-idx__title">Volunteer Manual</h1>
        <p className="man-idx__subtitle">
          Reference documentation for the RIM platform — for everyone who volunteers with Rooted In Mindfulness.
        </p>
      </div>

      {grouped.map(({ group, sections }) => (
        <section key={group.id} className="man-idx__group">
          <h2 className="man-idx__group-label">{group.label}</h2>
          {group.description && (
            <p className="man-idx__group-desc">{group.description}</p>
          )}
          <div className="man-idx__list">
            {sections.map((s) => (
              <Link
                key={s.slug}
                href={`/admin/manual/${s.slug}`}
                className="man-idx__entry"
              >
                <div className="man-idx__entry-main">
                  <span className="man-idx__entry-title">{s.title}</span>
                  {s.description && (
                    <span className="man-idx__entry-desc">{s.description}</span>
                  )}
                </div>
                {s.hubSlug && hubLabel[s.hubSlug] && (
                  <span className="man-idx__hub-badge">{hubLabel[s.hubSlug]}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
