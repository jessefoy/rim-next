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
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <div id="Community-Programs-Header-Link" className="section community-programs-page">
        <div className="content-container left">
          <h1 className="heading-9-copy">Programs and Events<br /></h1>
          <div className="text-block-9">
            <strong>Learn and practice with others.</strong> To safely stay connected, sit together,
            and support each other, Tuesday and Saturday drop-ins are now offered in a hybrid format.
            You may choose to <strong>attend drop-ins in person at the center or online</strong> via
            zoom! Other classes are held on zoom. We warmly invite you to come as you are.
          </div>
          <Link href="/community-membership" className="button-2-white w-button">
            Learn How to Join Us
          </Link>
        </div>
      </div>

      <div className="program-listing-section background-grey">
        <div className="content-container">
          {categories.map((category) => {
            const categoryPrograms = programs.filter(
              (p) => p.category?.name === category.name
            );
            if (categoryPrograms.length === 0) return null;

            return (
              <div key={category.id} className="program_category_container">
                <div className="program-list-header">
                  <h1 className="program-category-header">{category.name}</h1>
                </div>
                {categoryPrograms.map((program) => (
                  <ListRow
                    key={program.id}
                    title={program.name}
                    subtitle={program.dateText || buildDateLabel({
                      startDatetime: program.startDatetime?.toISOString() ?? null,
                      endDatetime: program.endDatetime?.toISOString() ?? null,
                      recurrenceFreq: program.recurrenceFreq,
                      recurrenceInterval: program.recurrenceInterval,
                      recurrenceDays: program.recurrenceDays,
                    }) || undefined}
                    announcement={program.specialAnnouncement ?? undefined}
                    href={`/programs/${program.slug}`}
                    buttonLabel="Learn More"
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
