import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { renderContentBodyAsync } from "@/lib/renderRichContentServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = await db.manualSection.findUnique({ where: { slug }, select: { title: true } });
  return { title: `${section?.title ?? "Manual"} — Volunteer Manual` };
}

export default async function ManualSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = session.user.roles?.includes("ADMIN") ?? false;

  const section = await db.manualSection.findUnique({ where: { slug } });
  if (!section) notFound();

  const relatedSections =
    section.relations.length > 0
      ? await db.manualSection.findMany({
          where: { slug: { in: section.relations } },
          select: { slug: true, title: true },
          orderBy: { order: "asc" },
        })
      : [];

  const bodyHtml = section.body ? await renderContentBodyAsync(section.body) : "";

  const hubLabel: Record<string, string> = {
    courses: "Course Hub",
    "host-team": "Host Hub",
    support: "Support Inbox",
    registrar: "Registrar Hub",
  };

  return (
    <div className="man-sec-page">
      {/* Back link */}
      <div className="man-sec-page__back">
        <Link href="/admin/manual" className="man-sec-page__back-link">
          ← Volunteer Manual
        </Link>
      </div>

      {/* Header */}
      <div className="man-sec-page__header">
        <div className="man-sec-page__title-row">
          <h1 className="man-sec-page__title">{section.title}</h1>
          {isAdmin && (
            <Link href={`/admin/manual/${slug}/edit`} className="man-sec-page__edit-link">
              Edit this section
            </Link>
          )}
        </div>
        <div className="man-sec-page__meta">
          {section.hubSlug && hubLabel[section.hubSlug] && (
            <span className="man-sec-page__hub-badge">
              {hubLabel[section.hubSlug]}
            </span>
          )}
          <span className="man-sec-page__updated">
            Updated {new Date(section.updatedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Body */}
      {bodyHtml ? (
        <div
          className="man-sec-page__body man-layout-single"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        <p className="man-sec-page__empty">No content yet.</p>
      )}

      {/* Related sections */}
      {relatedSections.length > 0 && (
        <div className="man-sec-page__related">
          <hr className="man-sec-page__rule" />
          <p className="man-sec-page__related-label">Related sections</p>
          <div className="man-sec-page__related-list">
            {relatedSections.map((r) => (
              <Link key={r.slug} href={`/admin/manual/${r.slug}`} className="man-sec-page__related-link">
                {r.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="man-sec-page__footer">
        <hr className="man-sec-page__rule" />
        <Link href="/admin/manual" className="man-sec-page__back-link">
          ← Read the full manual
        </Link>
      </div>
    </div>
  );
}
