import { db } from "@/lib/db";
import Link from "next/link";
import { buildSubtitle, fmtLabel } from "@/lib/programUtils";

export const metadata = {
  title: "Programs and Events — Rooted In Mindfulness",
};

export const dynamic = "force-dynamic";

const GOOD_FIRST_VISIT_SLUGS = new Set([
  "the-art-of-meditation",
  "meditation-and-dharma-talk",
]);

export default async function CommunityProgramsPage() {
  const [programs, categories] = await Promise.all([
    db.program.findMany({
      where: {
        hideFromProgramPageList: false,
        archivedAt: null,
        slug: { not: "dummy-test-program" },
      },
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
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Looking-Up-Pine-Trees-unsplash.jpg')",
          ["--pp-hero-position" as string]: "center 48%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Practice in community</p>
          <h1 className="pp-hero__title">Programs and Events</h1>
          <p className="pp-hero__body">
            Sit together, study the teachings, and bring what you find into the rest of your life.
            Join us at the center or online, whether you are beginning or have practiced for years.
          </p>
          <div className="pp-hero__actions">
            <Link href="/this-week" className="pp-hero__link">
              See what&rsquo;s happening this week <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Program Listings ─────────────────────────────── */}
      <section className="pl-catalog">
        <div className="rim-container">
          {categories.map((category) => {
            const categoryPrograms = programs.filter(
              (p) => p.category?.name === category.name
            );
            if (categoryPrograms.length === 0) return null;
            const categoryHeading = category.name === "Drop-Ins: Open Practice and Learning"
              ? "Open Practice & Learning"
              : category.name;

            return (
              <div key={category.id} className="pl-cat">
                <div className="pl-cat__header">
                  <h2 className="pl-cat__heading">{categoryHeading}</h2>
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
                            <div className="pl-card__title-row">
                              <h3 className="pl-card__title">{program.name}</h3>
                              {GOOD_FIRST_VISIT_SLUGS.has(program.slug) && (
                                <span className="pl-card__starter">Good first visit</span>
                              )}
                            </div>
                            {program.tagline && (
                              <span className="pl-card__tagline">{program.tagline}</span>
                            )}
                            <div className="pl-card__meta">
                              {schedule && <span className="pl-card__schedule">{schedule}</span>}
                              <span className="pl-card__format">{format}</span>
                            </div>
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
              <p className="pl-membership__eyebrow">Practice with us</p>
              <h2 className="pl-membership__title">Membership is free.</h2>
              <p className="pl-membership__body">
                An account is how you get the Zoom links and how you register for classes
                and retreats.
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
