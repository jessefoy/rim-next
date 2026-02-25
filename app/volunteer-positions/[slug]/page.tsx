import { sanityClient } from "@/lib/sanity";
import { volunteerPositionBySlugQuery, allVolunteerPositionSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

type VolunteerPosition = {
  _id: string;
  name: string;
  isOpen?: boolean;
  positionDescription?: unknown[];
  currentVolunteers?: { name: string; slug: { current: string } }[];
};

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(allVolunteerPositionSlugsQuery);
  return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const position = await sanityClient.fetch<VolunteerPosition | null>(volunteerPositionBySlugQuery, { slug });
  return { title: `${position?.name ?? "Volunteer Position"} — Volunteer — Rooted In Mindfulness` };
}

export default async function VolunteerPositionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const position = await sanityClient.fetch<VolunteerPosition | null>(volunteerPositionBySlugQuery, { slug });
  if (!position) notFound();

  return (
    <div className="section background-white">
      <div className="content-container">
        <Link href="/volunteerism/volunteer" className="breadcrumb-link w-inline-block">
          <div className="text-block-58">← Volunteer Opportunities</div>
        </Link>

        <h1 className="heading-9">{position.name}</h1>

        <div className="position-status">
          {position.isOpen ? (
            <span className="open-badge">Open</span>
          ) : (
            <span className="filled-badge">Filled</span>
          )}
        </div>

        {position.positionDescription && (
          <div className="rich-text-block-19 w-richtext">
            <PortableText value={position.positionDescription as any} />
          </div>
        )}

        {position.currentVolunteers && position.currentVolunteers.length > 0 && (
          <div className="current-volunteers">
            <h3 className="details-header">Current Volunteers</h3>
            {position.currentVolunteers.map((volunteer) => (
              <Link
                key={volunteer.slug.current}
                href={`/team/${volunteer.slug.current}`}
                className="teacher-container w-inline-block"
              >
                <div className="facilitator-name underline">{volunteer.name}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
