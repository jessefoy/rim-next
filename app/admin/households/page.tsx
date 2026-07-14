import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";

export const metadata = { title: "Households — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminHouseholdsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.roles?.includes("ADMIN");
  const hasAccess = isAdmin || session.user.roles?.includes("REGISTRAR");
  if (!hasAccess) {
    return (
      <div className="adm-page">
        <div className="adm-content">
          <p className="adm-unauthorized">You don&rsquo;t have permission to access this area.</p>
        </div>
      </div>
    );
  }

  const households = await db.household.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        orderBy: { isPrimary: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  // Custom label frequency — for discovering relationship patterns
  const customLabels = await db.householdMember.groupBy({
    by: ["relationshipCustom"],
    where: { relationshipType: "OTHER", relationshipCustom: { not: null } },
    _count: { relationshipCustom: true },
    orderBy: { _count: { relationshipCustom: "desc" } },
  });

  const displayName = (u: { firstName: string | null; lastName: string | null; email: string }) => {
    const full = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
    return full || u.email;
  };

  const addressSummary = (h: { addressLine1: string | null; addressCity: string | null; addressState: string | null }) => {
    const parts = [h.addressLine1, h.addressCity, h.addressState].filter(Boolean);
    return parts.join(", ") || null;
  };

  return (
    <div className="adm-page">
      <div className="adm-content">
        <header className="adm-header ac-page-head">
          <div>
            <p className="lp-label">Admin</p>
            <h1 className="adm-header__title ac-page-title">Households</h1>
            <p className="adm-header__count ac-page-sub">{households.length} total</p>
          </div>
        </header>

        {households.length === 0 ? (
          <p className="adm-empty">No households yet. Create one from a member&rsquo;s profile page.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Household</th>
                  <th>Primary contact</th>
                  <th>Members</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {households.map((h) => {
                  const primary = h.members.find((m) => m.isPrimary) ?? h.members[0];
                  const others = h.members.filter((m) => m !== primary);
                  return (
                    <tr
                      key={h.id}
                      className="adm-table__row"
                    >
                      <td className="adm-table__name">
                        <Link href={`/admin/households/${h.id}`} className="hh-link">
                          {h.name ?? <span className="adm-muted">Unnamed household</span>}
                        </Link>
                      </td>
                      <td>
                        {primary ? (
                          <Link href={`/admin/members/${primary.user.id}`} className="hh-link">
                            {displayName(primary.user)}
                          </Link>
                        ) : (
                          <span className="adm-muted">—</span>
                        )}
                      </td>
                      <td className="adm-table__col--num">
                        <span className="hh-member-count">{h.members.length}</span>
                        {others.length > 0 && (
                          <span className="adm-muted hh-others">
                            {" "}+{" "}
                            {others.map((m) => displayName(m.user)).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="adm-muted">
                        {addressSummary(h) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {customLabels.length > 0 && (
          <section className="hh-custom-labels">
            <h2 className="hh-custom-labels__title">Custom relationship labels</h2>
            <p className="hh-custom-labels__desc">
              These are logged when &ldquo;Other&rdquo; is selected for relationship type.
              Promote frequent labels to the fixed enum when patterns emerge.
            </p>
            <div className="adm-table-wrap">
              <table className="adm-table hh-custom-labels__table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {customLabels.map((row) => (
                    <tr key={row.relationshipCustom} className="adm-table__row">
                      <td>{row.relationshipCustom}</td>
                      <td className="adm-table__col--num">{row._count.relationshipCustom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
