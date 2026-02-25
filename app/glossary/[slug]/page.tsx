import { sanityClient } from "@/lib/sanity";
import { glossaryTermBySlugQuery, allGlossaryTermSlugsQuery } from "@/lib/queries";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

type GlossaryTerm = {
  _id: string;
  name: string;
  pali?: string;
  sanskrit?: string;
  synonyms?: string;
};

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(allGlossaryTermSlugsQuery);
  return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const term = await sanityClient.fetch<GlossaryTerm | null>(glossaryTermBySlugQuery, { slug });
  return { title: `${term?.name ?? "Term"} — Handful of Leaves Glossary` };
}

export default async function GlossaryTermPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const term = await sanityClient.fetch<GlossaryTerm | null>(glossaryTermBySlugQuery, { slug });
  if (!term) notFound();

  return (
    <div className="section background-white">
      <div className="content-container">
        <Link href="/work-in-progress/handful-of-leaves-glossary" className="breadcrumb-link w-inline-block">
          <div className="text-block-58">← Glossary</div>
        </Link>

        <h1 className="heading-9">{term.name}</h1>

        {(term.pali || term.sanskrit) && (
          <div className="glossary-term-languages">
            {term.pali && <p><strong>Pali:</strong> {term.pali}</p>}
            {term.sanskrit && <p><strong>Sanskrit:</strong> {term.sanskrit}</p>}
          </div>
        )}

        {term.synonyms && (
          <p className="glossary-synonyms"><strong>Also known as:</strong> {term.synonyms}</p>
        )}
      </div>
    </div>
  );
}
