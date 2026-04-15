import { db } from "@/lib/db";
import Link from "next/link";
import ListRow from "@/components/ListRow";
import { buildDateLabel } from "@/lib/dateLabel";

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
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="pl-hero">
        <div className="pl-hero__inner">
          <h1 className="pl-hero__title">Programs and Events</h1>
          <p className="pl-hero__body">
            Sit together, study the teachings, and bring what you find into the rest of your life.
            Our programs are offered in person at the center and online — drop-ins, courses, and
            community groups for every stage of practice. No experience needed. No fees.
          </p>
          <Link href="/community-membership" className="pl-hero__cta">
            New here? Learn how to join us →
          </Link>
        </div>
      </div>

      {/* ── Program Listings ─────────────────────────────── */}
      <section className="rim-section rim-section--grey">
        <div className="rim-container">
          {categories.map((category) => {
            const categoryPrograms = programs.filter(
              (p) => p.category?.name === category.name
            );
            if (categoryPrograms.length === 0) return null;

            return (
              <div key={category.id} className="pl-cat">
                <h2 className="pl-cat__heading">{category.name}</h2>
                <div className="pl-list">
                  {categoryPrograms.map((program) => (
                    <ListRow
                      key={program.id}
                      title={program.name}
                      subtitle={
                        program.dateText ||
                        buildDateLabel({
                          startDatetime: program.startDatetime?.toISOString() ?? null,
                          endDatetime: program.endDatetime?.toISOString() ?? null,
                          recurrenceFreq: program.recurrenceFreq,
                          recurrenceInterval: program.recurrenceInterval,
                          recurrenceDays: program.recurrenceDays,
                        }) ||
                        undefined
                      }
                      announcement={program.specialAnnouncement ?? undefined}
                      href={`/programs/${program.slug}`}
                      buttonLabel="Learn More"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
