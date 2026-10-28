/**
 * Content changes — ADMIN only (2026-10-28).
 *
 * Every change Content editors make through the RIM Guide, newest first:
 * who, when, what and which parts. Each opens its own page with the parts
 * before and after. Each is also emailed to Jesse as it's made
 * (lib/contentChanges.ts).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { CONTENT_KIND_LABEL, type ContentKind } from "@/lib/contentChanges";

export const metadata = { title: "Content changes - Admin" };
export const dynamic = "force-dynamic";

const SHOWN = 200;

const when = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ContentChangesPage() {
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

  const [total, changes] = await Promise.all([
    db.contentChange.count(),
    db.contentChange.findMany({ orderBy: { createdAt: "desc" }, take: SHOWN }),
  ]);

  return (
    <div className="adm-page">
      <div className="adm-content">
        <header className="adm-header ac-page-head">
          <div>
            <p className="lp-label">Admin</p>
            <h1 className="adm-header__title ac-page-title">Content changes</h1>
            <p className="adm-header__count ac-page-sub">
              Changes Content editors made through the RIM Guide, newest first.{" "}
              {total > SHOWN ? `The latest ${SHOWN} of ${total}.` : `${total} in all.`}
            </p>
          </div>
        </header>

        {changes.length === 0 ? (
          <p className="adm-empty">No one has changed anything through the RIM Guide yet.</p>
        ) : (
          <ul className="adm-forms">
            {changes.map((c) => {
              const parts = Array.isArray(c.changes) ? (c.changes as { label?: string }[]).map((p) => p.label).filter(Boolean) : [];
              return (
                <li key={c.id} className="adm-forms__item">
                  <p className="adm-forms__meta">
                    {CONTENT_KIND_LABEL[c.kind as ContentKind] ?? c.kind} · {when.format(c.createdAt)}
                  </p>
                  <p className="adm-forms__name">
                    <Link href={`/admin/content-changes/${c.id}`} className="hh-link">
                      {c.userName} changed {c.itemLabel}
                    </Link>
                  </p>
                  {parts.length > 0 && <p className="adm-forms__contact">{parts.join(", ")}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
