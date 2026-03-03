import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { magazineArticleBySlugQuery, allMagazineArticleSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

type MagazineArticle = {
  _id: string;
  articleTitleDisplayed: string;
  articleContent?: unknown[];
};

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(allMagazineArticleSlugsQuery);
  return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await sanityClient.fetch<MagazineArticle | null>(magazineArticleBySlugQuery, { slug });
  return { title: `${article?.articleTitleDisplayed ?? "Article"} — Rooted In Mindfulness` };
}

export default async function MagazineArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, session] = await Promise.all([
    sanityClient.fetch<MagazineArticle | null>(magazineArticleBySlugQuery, { slug }),
    auth(),
  ]);
  if (!article) notFound();

  if (!session) {
    return (
      <div className="section background-white">
        <div className="content-container">
          <h2>Members Only</h2>
          <p>This content is available to RIM community members.</p>
          <div className="become-member-buttons">
            <Link href="/login" className="button-2 w-button">
              Join or sign in →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section background-white">
      <div className="content-container">
        <h1 className="heading-9">{article.articleTitleDisplayed}</h1>
        {article.articleContent && (
          <div className="rich-text-block-19 w-richtext">
            <PortableText value={article.articleContent as any} />
          </div>
        )}
      </div>
    </div>
  );
}
