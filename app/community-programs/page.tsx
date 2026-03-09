import { sanityClient } from "@/lib/sanity";
import { programsQuery, programCategoriesQuery } from "@/lib/queries";
import Link from "next/link";
import ListRow from "@/components/ListRow";
import { buildDateLabel } from "@/lib/dateLabel";

export const metadata = {
  title: "Programs and Events — Rooted In Mindfulness",
};

export const revalidate = 60;

interface Program {
  _id: string;
  name: string;
  slug: { current: string };
  dateText?: string;
  startDatetime?: string | null;
  endDatetime?: string | null;
  recurrenceFreq?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDays?: string[] | null;
  dashboardSpecialAnnouncement?: string;
  programCategory?: { name: string; slug: { current: string } };
}

interface ProgramCategory {
  _id: string;
  name: string;
  slug: { current: string };
  description?: string;
}

export default async function CommunityProgramsPage() {
  const [programs, programCategories] = await Promise.all([
    sanityClient.fetch<Program[]>(programsQuery),
    sanityClient.fetch<ProgramCategory[]>(programCategoriesQuery),
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
          {programCategories.map((category) => {
            const categoryPrograms = programs.filter(
              (p) => p.programCategory?.name === category.name
            );
            if (categoryPrograms.length === 0) return null;

            return (
              <div key={category._id} className="program_category_container">
                <div className="program-list-header">
                  <h1 className="program-category-header">{category.name}</h1>
                </div>
                {categoryPrograms.map((program) => (
                  <ListRow
                    key={program._id}
                    title={program.name}
                    subtitle={program.dateText || buildDateLabel(program) || undefined}
                    announcement={program.dashboardSpecialAnnouncement}
                    href={`/programs/${program.slug.current}`}
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
