import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { renderContentBody } from "@/lib/renderRichContent";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = await db.manualSection.findUnique({ where: { slug }, select: { title: true } });
  return { title: `${section?.title ?? "Manual"} — Staff Manual` };
}

export default async function ManualSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    redirect("/account/dashboard");
  }

  const section = await db.manualSection.findUnique({ where: { slug } });
  if (!section) notFound();

  // Fetch related sections by slug
  const relatedSections =
    section.relations.length > 0
      ? await db.manualSection.findMany({
          where: { slug: { in: section.relations } },
          select: { slug: true, title: true },
        })
      : [];

  const bodyHtml = section.body ? renderContentBody(section.body) : "";

  return (
    <div className="man2-detail">
      <div style={{ marginBottom: 24 }}>
        <a
          href="/admin/manual"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--rim-text-muted)",
            textDecoration: "none",
          }}
        >
          ← All sections
        </a>
      </div>

      <h1 className="man2-detail__title">{section.title}</h1>
      <p className="man2-detail__meta">
        Slug: <code style={{ fontSize: 12 }}>{section.slug}</code>
        {section.hubSlug && (
          <> &ensp;·&ensp; Hub: <code style={{ fontSize: 12 }}>{section.hubSlug}</code></>
        )}
        &ensp;·&ensp; Order: {section.order}
      </p>

      {bodyHtml ? (
        <div
          className="lp-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        <p
          style={{
            color: "var(--rim-text-muted)",
            fontFamily: "var(--font-sans)",
            fontStyle: "italic",
          }}
        >
          No content yet.
        </p>
      )}

      {relatedSections.length > 0 && (
        <div className="man2-related">
          <p className="man2-related__title">Related sections</p>
          <div className="man2-related__list">
            {relatedSections.map((r) => (
              <a key={r.slug} href={`/admin/manual/${r.slug}`} className="man2-related__link">
                {r.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <a href={`/admin/manual/${slug}/edit`} className="th-btn th-btn--primary">
          Edit this section
        </a>
      </div>
    </div>
  );
}
