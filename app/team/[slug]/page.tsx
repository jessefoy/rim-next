import { sanityClient } from "@/lib/sanity";
import { teamBySlugQuery, allTeamSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import { notFound } from "next/navigation";

export const revalidate = 300;

interface TeamMember {
  _id: string;
  name: string;
  slug: { current: string };
  title?: string;
  bio?: any[];
  bioPicture?: { asset: { url: string } };
}

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(allTeamSlugsQuery);
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = await sanityClient.fetch<TeamMember | null>(teamBySlugQuery, { slug });
  return { title: member ? `${member.name} — Rooted In Mindfulness` : "Team" };
}

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const member = await sanityClient.fetch<TeamMember | null>(teamBySlugQuery, { slug });
  if (!member) notFound();

  return (
    <div className="section background-white">
      <div className="content-container">
        <div className="team-member-profile">
          {member.bioPicture && (
            <div className="team-photo-block">
              <img
                src={member.bioPicture.asset.url}
                alt={member.name}
                className="team-member-photo"
              />
            </div>
          )}
          <div className="team-member-info">
            <h1 className="heading-9">{member.name}</h1>
            {member.title && <h2 className="heading-39">{member.title}</h2>}
            {member.bio && (
              <div className="rich-text-block-19 w-richtext">
                <PortableText value={member.bio} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
