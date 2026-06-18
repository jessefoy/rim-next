import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NewPageForm } from "@/components/page-composer/NewPageForm";

export default async function AdminPagesListPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/account/dashboard");

  const pages = await db.page.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, status: true, updatedAt: true },
  });

  return (
    <div className="adm-page">
      <div className="adm-content">
        <header className="adm-header">
          <p className="lp-label">Admin</p>
          <h1 className="adm-header__title">Pages</h1>
          <p className="adm-header__count">{pages.length} total</p>
        </header>

        <NewPageForm />

        <ul className="bld-pagelist">
          {pages.length === 0 ? (
            <li className="bld-pagelist__empty">No pages yet — create one above.</li>
          ) : (
            pages.map((p) => (
              <li key={p.id} className="bld-pagelist__row">
                <Link href={`/admin/pages/${p.id}/edit`} className="bld-pagelist__title">
                  {p.title}
                </Link>
                <span className="bld-pagelist__slug">/{p.slug}</span>
                <span className={`bld-status bld-status--${p.status.toLowerCase()}`}>
                  {p.status === "PUBLISHED" ? "Published" : "Draft"}
                </span>
                <span className="bld-pagelist__date">{p.updatedAt.toISOString().slice(0, 10)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
