import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import MembersTable, { type SerializedMember } from "@/components/MembersTable";
import MemberImport from "@/components/MemberImport";

export const metadata = { title: "Members — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
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
      phone: true,
      roles: true,
      createdAt: true,
      _count: {
        select: {
          registrations: { where: { status: { not: "CANCELLED" } } },
        },
      },
    },
  });

  const members: SerializedMember[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="adm-page">
      <div className="adm-content">
        <header className="adm-header">
          <p className="lp-label">Admin</p>
          <h1 className="adm-header__title">Members</h1>
          <p className="adm-header__count">{members.length} total</p>
        </header>

        <MemberImport />
        <MembersTable members={members} />
      </div>
    </div>
  );
}
