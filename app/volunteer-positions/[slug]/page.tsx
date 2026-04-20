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
        {/* "Current Volunteers" section removed in session 89 —
           it linked to the deleted Sanity `teams` pages. When this page
           migrates to Postgres in Stage 2d, currentVolunteers will resolve
           to User records and link to /teachers/[slug] where applicable. */}
      </div>
    </div>
  );
}
