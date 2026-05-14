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
  searchParams,
}: {
  params:        Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const search = (await searchParams) ?? {};
  const fromParam = typeof search.from === "string" ? search.from : null;

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = session.user.roles?.includes("ADMIN") ?? false;

  const section = await db.manualSection.findUnique({ where: { slug } });
  if (!section) notFound();

  // Determine the back-link.
  // Priority: ?from=<hubSlug> → section.hubSlug → /admin/manual fallback.
  // The "context" hub is whichever the user's path-of-arrival implies — the
  // explicit `from` param wins because it captures intent (the user clicked
  // "?" while inside that hub), and the chapter's own hubSlug is the
  // fallback for direct loads.
  let backHref  = "/admin/manual";
  let backLabel = "Volunteer Manual";

  const contextHubSlug = fromParam ?? section.hubSlug;
  if (contextHubSlug) {
    const ctxHub = await db.hub.findUnique({
      where:  { slug: contextHubSlug },
      select: { name: true },
    });
    if (ctxHub) {
      backHref  = `/account/hub/${contextHubSlug}/manual`;
      backLabel = `${ctxHub.name} Manual`;
    }
  }

  const relatedSections =
    section.relations.length > 0
      ? await db.manualSection.findMany({
          where:   { slug: { in: section.relations } },
          select:  { slug: true, title: true },
          orderBy: { order: "asc" },
        })
      : [];

  const bodyHtml = section.body ? await renderContentBodyAsync(section.body) : "";

  const hubLabel: Record<string, string> = {
    courses:     "Course Hub",
    "host-team": "Host Hub",
    support:     "Support Hub",
    registrar:   "Registrar Hub",
  };

  // Preserve the from-context on related-section links so navigation
  // between sibling chapters keeps the user in their hub-scoped flow.
  const fromSuffix = fromParam ? `?from=${fromParam}` : "";

  return (
    <div className="man-sec-page">
      {/* Back link — context-aware: /account/hub/<slug>/manual when a
          hub context applies, /admin/manual otherwise. */}
      <div className="man-sec-page__back">
        <Link href={backHref} className="man-sec-page__back-link">
          ← {backLabel}
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
            <Link
              href={`/account/hub/${section.hubSlug}/manual`}
              className="man-sec-page__hub-badge"
            >
              {hubLabel[section.hubSlug]}
            </Link>
          )}
          <span className="man-sec-page__updated">
            Updated {new Date(section.updatedAt).toLocaleDateString("en-US", {
              month: "long",
              day:   "numeric",
              year:  "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Body */}
      {bodyHtml ? (
        <div
          className="man-body rim-content rim-content--document"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        <p className="man-sec-page__empty">No content yet.</p>
      )}

      {/* Related sections — preserve the from-context on links */}
      {relatedSections.length > 0 && (
        <div className="man-sec-page__related">
          <hr className="man-sec-page__rule" />
          <p className="man-sec-page__related-label">Related sections</p>
          <div className="man-sec-page__related-list">
            {relatedSections.map((r) => (
              <Link
                key={r.slug}
                href={`/admin/manual/${r.slug}${fromSuffix}`}
                className="man-sec-page__related-link"
              >
                {r.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer — always points at the full manual, regardless of context */}
      <div className="man-sec-page__footer">
        <hr className="man-sec-page__rule" />
        <Link href="/admin/manual" className="man-sec-page__back-link">
          ← Read the full manual
        </Link>
      </div>
    </div>
  );
}
