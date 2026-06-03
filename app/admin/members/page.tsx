import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import MembersTable, { type SerializedMember } from "@/components/MembersTable";

export const metadata = { title: "Members — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  const hasAccess = isAdmin || session.user.roles?.some((r) => r === "REGISTRAR");
  if (!hasAccess) {
    return (
      <div className="adm-page">
        <div className="adm-content">
          <p className="adm-unauthorized">You don&rsquo;t have permission to access this area.</p>
        </div>
      </div>
    );
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      phone: true,
      roles: true,
      memberStatus: true,
      tags: true,
      archivedAt: true,
      createdAt: true,
      _count: {
        select: {
          registrations: { where: { status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } } },
        },
      },
    },
  });

  const members: SerializedMember[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    preferredName: u.preferredName,
    phone: u.phone,
    roles: u.roles,
    memberStatus: u.memberStatus,
    tags: u.tags,
    archivedAt: u.archivedAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    _count: u._count,
  }));

  return (
    <div className="adm-page">
      <div className="adm-content">
        <header className="adm-header">
          <p className="lp-label">Admin</p>
          <h1 className="adm-header__title">Members</h1>
          <p className="adm-header__count">{members.length} total</p>
        </header>

        <MembersTable members={members} />
      </div>
    </div>
  );
}
