import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import AccountLayout from "@/components/AccountLayout";

export const metadata = { title: "Email Templates" };

export default async function EmailTemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/account/dashboard");

  const templates = await db.emailTemplate.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      enabled: true,
      updatedAt: true,
    },
  });

  return (
    <AccountLayout>
      <div className="em-list">
        <div className="em-list__hdr">
          <h1 className="em-list__title">Email Templates</h1>
          <p className="em-list__sub">
            Automated emails sent by RIM. Edit copy and toggle delivery here.
            Changes take effect on the next send — no deploy required.
          </p>
        </div>

        <table className="em-list__table">
          <thead>
            <tr>
              <th>Template</th>
              <th>Status</th>
              <th>Last saved</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="em-list__name">{t.name}</div>
                  <div className="em-list__desc">{t.description}</div>
                </td>
                <td>
                  <span className={`em-list__badge em-list__badge--${t.enabled ? "on" : "off"}`}>
                    {t.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="em-list__date">
                  {t.updatedAt.toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </td>
                <td>
                  <Link href={`/admin/emails/${t.slug}`} className="em-list__edit-link">
                    Edit →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AccountLayout>
  );
}
