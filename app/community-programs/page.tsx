import { db } from "@/lib/db";
import Link from "next/link";
import { buildSubtitle, fmtLabel } from "@/lib/programUtils";

export const metadata = {
  title: "Programs and Events — Rooted In Mindfulness",
};

export const dynamic = "force-dynamic";

export default async function CommunityProgramsPage() {
  const [programs, categories] = await Promise.all([
    db.program.findMany({
      where: { hideFromProgramPageList: false, archivedAt: null },
      include: { category: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.programCategory.findMany({
      where: { hideFromProgramsPage: false },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="pl-page">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="pl-hero">
        <div className="rim-container pl-hero__inner">
          <p className="pl-hero__eyebrow">Practice in community</p>
          <h1 className="pl-hero__title">Programs and Events</h1>
          <p className="pl-hero__body">
            Sit together, study the teachings, and bring what you find into the rest of your life.
            Join us at the center or online, whether you are beginning or have practiced for years.
          </p>
          <Link href="/this-week" className="pl-hero__cta">
            See what&rsquo;s happening this week <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* ── Program Listings ─────────────────────────────── */}
      <section className="pl-catalog">
        <div className="rim-container">
          <div className="pl-catalog__intro">
            <p className="pl-catalog__eyebrow">Find a place to begin</p>
            <h2 className="pl-catalog__title">Come as you are.</h2>
            <p className="pl-catalog__body">
              Join a single gathering, find a regular practice, or explore a course when
              you&rsquo;re ready.
            </p>
          </div>

          {categories.map((category) => {
            const categoryPrograms = programs.filter(
              (p) => p.category?.name === category.name
            );
            if (categoryPrograms.length === 0) return null;

            return (
              <div key={category.id} className="pl-cat">
                <div className="pl-cat__header">
                  <h2 className="pl-cat__heading">{category.name}</h2>
                </div>
                <div className="pl-grid">
                  {categoryPrograms.map((program) => {
                    const fullSubtitle = buildSubtitle(program);
                    const format = fmtLabel(program.programFormat);
                    const schedule = fullSubtitle?.endsWith(` | ${format}`)
                      ? fullSubtitle.slice(0, -(` | ${format}`).length)
                      : fullSubtitle;

                    return (
                      <Link
                        key={program.id}
                        href={`/programs/${program.slug}`}
                        className="pl-card"
                      >
                        <div className="pl-card__content">
                          <div className="pl-card__main">
                            <h3 className="pl-card__title">{program.name}</h3>
                            {program.tagline && (
                              <span className="pl-card__tagline">{program.tagline}</span>
                            )}
                            <div className="pl-card__meta">
                              {schedule && <span className="pl-card__schedule">{schedule}</span>}
                              <span className="pl-card__format">{format}</span>
                            </div>
                            {program.specialAnnouncement && (
                              <span className="pl-card__announcement">
                                {program.specialAnnouncement}
                              </span>
                            )}
                          </div>
                          <span className="pl-card__action" aria-hidden="true">→</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <aside className="pl-membership">
            <div>
              <p className="pl-membership__eyebrow">A community of practice</p>
              <h2 className="pl-membership__title">You are welcome here.</h2>
              <p className="pl-membership__body">
                Membership is free and opens the door to online gatherings, registration,
                learning resources, and the life of the RIM community.
              </p>
            </div>
            <Link href="/join" className="pl-membership__link">
              Become a member <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}
