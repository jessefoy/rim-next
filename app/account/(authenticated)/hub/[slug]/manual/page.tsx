/**
 * /account/hub/[slug]/manual — Hub-scoped Manual index.
 *
 * Lists only the ManualSection records tied to this hub via hubSlug.
 * Each entry links to the canonical chapter view at /admin/manual/[slug]
 * (matches the ManualHelpIcon convention used elsewhere in the system).
 *
 * The full manual (every chapter, every hub) lives at /manual. This page
 * is the hub-scoped projection — "the manual, specific to where I am."
 *
 * Reuses .man-idx CSS for visual continuity with the main manual index.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Manual` };
}

export default async function HubManualPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(
    slug,
    session.user.id,
    session.user.roles ?? [],
  );
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  const sections = await db.manualSection.findMany({
    where:   { hubSlug: slug },
    orderBy: { order: "asc" },
    select:  { slug: true, title: true, description: true },
  });

  return (
    <div className="man-idx">
      <div className="man-idx__header">
        <h1 className="man-idx__title">{hub.name} — Manual</h1>
        <p className="man-idx__subtitle">
          Reference documentation for this hub. The full manual, including chapters
          for every team, lives at <Link href="/manual">/manual</Link>.
        </p>
      </div>

      {sections.length === 0 ? (
        <p className="man-idx__empty">No manual chapters for this hub yet.</p>
      ) : (
        <div className="man-idx__list">
          {sections.map((s) => (
            <Link
              key={s.slug}
              href={`/admin/manual/${s.slug}`}
              className="man-idx__entry"
            >
              <div className="man-idx__entry-main">
                <span className="man-idx__entry-title">{s.title}</span>
                {s.description && (
                  <span className="man-idx__entry-desc">{s.description}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
