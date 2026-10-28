/**
 * One content change — ADMIN only (2026-10-28).
 *
 * A change a Content editor made through the RIM Guide: who, when, where it
 * shows, and each part before and after, as plain words. A change to a page's
 * words links to its commit on GitHub. The list is /admin/content-changes.
 */

import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { CONTENT_KIND_LABEL, shownValue, type ContentKind } from "@/lib/contentChanges";

export const metadata = { title: "Content change - Admin" };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ContentChangePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.roles?.includes("ADMIN")) {
    return (
      <div className="adm-page">
        <div className="adm-content">
          <p className="adm-unauthorized">You don&rsquo;t have permission to access this area.</p>
        </div>
      </div>
    );
  }

  const { id } = await params;
  const change = await db.contentChange.findUnique({ where: { id } });
  if (!change) notFound();
  const parts = Array.isArray(change.changes)
    ? (change.changes as { label?: string; before?: unknown; after?: unknown }[])
    : [];

  return (
    <div className="adm-page">
      <div className="adm-content">
        <Link href="/admin/content-changes" className="app-back">
          &larr; Content changes
        </Link>
        <header className="adm-header ac-page-head">
          <div>
            <p className="lp-label">{CONTENT_KIND_LABEL[change.kind as ContentKind] ?? change.kind}</p>
            <h1 className="adm-header__title ac-page-title">
              {change.userName} changed {change.itemLabel}
            </h1>
            <p className="adm-header__count ac-page-sub">{when.format(change.createdAt)}, through the RIM Guide.</p>
          </div>
        </header>

        {(change.itemHref || change.commitUrl) && (
          <p className="adm-change__links">
            {change.itemHref && (
              <a href={change.itemHref} className="hh-link" target="_blank" rel="noopener noreferrer">
                See it on the site
              </a>
            )}
            {change.itemHref && change.commitUrl && " · "}
            {change.commitUrl && (
              <a href={change.commitUrl} className="hh-link" target="_blank" rel="noopener noreferrer">
                The change on GitHub
              </a>
            )}
          </p>
        )}

        <ul className="adm-forms">
          {parts.map((p, i) => (
            <li key={i} className="adm-forms__item">
              <p className="adm-forms__name">{p.label ?? "A part"}</p>
              <p className="adm-change__when">Before</p>
              <p className="adm-forms__message adm-change__before">{shownValue(p.before)}</p>
              <p className="adm-change__when">After</p>
              <p className="adm-forms__message">{shownValue(p.after)}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
