/**
 * Form submissions — ADMIN only (2026-10-13).
 *
 * Every volunteer interest form and Kalyana Mitta group application sent on
 * the site, newest first. Each is saved before its notification email goes
 * out (lib/formSubmissions.ts), so this list is the record even when an email
 * fails. The old site's submissions stay in Webflow's Forms dashboard.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { FORM_KIND_LABEL, type FormKind } from "@/lib/formSubmissions";

export const metadata = { title: "Form submissions - Admin" };
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

export default async function FormSubmissionsPage() {
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

  const [total, submissions] = await Promise.all([
    db.formSubmission.count(),
    db.formSubmission.findMany({ orderBy: { createdAt: "desc" }, take: SHOWN }),
  ]);

  return (
    <div className="adm-page">
      <div className="adm-content">
        <header className="adm-header ac-page-head">
          <div>
            <p className="lp-label">Admin</p>
            <h1 className="adm-header__title ac-page-title">Form submissions</h1>
            <p className="adm-header__count ac-page-sub">
              Volunteer interest and Kalyana Mitta applications, newest first.{" "}
              {total > SHOWN ? `The latest ${SHOWN} of ${total}.` : `${total} in all.`}
            </p>
          </div>
        </header>

        {submissions.length === 0 ? (
          <p className="adm-empty">Nothing has been sent through the forms on this site yet.</p>
        ) : (
          <ul className="adm-forms">
            {submissions.map((s) => {
              const name = `${s.firstName} ${s.lastName}`.trim() || s.email;
              return (
                <li key={s.id} className="adm-forms__item">
                  <p className="adm-forms__meta">
                    {FORM_KIND_LABEL[s.kind as FormKind] ?? s.kind} · {when.format(s.createdAt)}
                  </p>
                  <p className="adm-forms__name">
                    {s.userId ? (
                      <Link href={`/admin/members/${s.userId}`} className="hh-link">{name}</Link>
                    ) : (
                      name
                    )}
                  </p>
                  <p className="adm-forms__contact">
                    <a href={`mailto:${encodeURIComponent(s.email)}`} className="hh-link">{s.email}</a>
                    {s.phone ? <> · {s.phone}</> : null}
                  </p>
                  {s.message ? (
                    <p className="adm-forms__message">{s.message}</p>
                  ) : (
                    <p className="adm-forms__message adm-muted">No message.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
