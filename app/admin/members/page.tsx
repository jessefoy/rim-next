import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import MembersTable, { type SerializedMember } from "@/components/MembersTable";

export const metadata = { title: "Members - Admin" };
export const dynamic = "force-dynamic";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
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

  // The legacy migration pool (Memberstack imports that haven't logged in yet)
  // is hidden by default so ~1,000 inert accounts don't flood the registry.
  // `?pool=legacy` reveals just that pool so an admin can pre-stage someone.
  // Filtered server-side — never ship the pool to the client in the default view.
  const { pool } = await searchParams;
  const showLegacyPool = pool === "legacy";

  const where: Prisma.UserWhereInput = showLegacyPool
    ? { isLegacyUnclaimed: true }
    : {
        // Everyone who is either claimed OR has been given a job (role/hub) —
        // so a pre-staged legacy account stays findable; only the untouched
        // quiet pool is hidden.
        OR: [
          { isLegacyUnclaimed: false },
          { roles: { isEmpty: false } },
          { hubMemberships: { some: {} } },
        ],
      };

  const [users, legacyCount, teams] = await Promise.all([
    db.user.findMany({
      where,
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
        isLegacyUnclaimed: true,
        // The teams this person is on (archived teams left out), so the list
        // shows team membership beside roles, which are system powers only.
        hubMemberships: {
          where: { hub: { status: "ACTIVE" } },
          select: { isCoordinator: true, status: true, hub: { select: { slug: true, name: true } } },
        },
        _count: {
          select: {
            registrations: { where: { status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } } },
          },
        },
      },
    }),
    db.user.count({ where: { isLegacyUnclaimed: true } }),
    db.hub.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

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
    isLegacyUnclaimed: u.isLegacyUnclaimed,
    teams: u.hubMemberships
      .map((m) => ({ slug: m.hub.slug, name: m.hub.name, isCoordinator: m.isCoordinator, status: m.status }))
      .sort((a, b) => Number(b.isCoordinator) - Number(a.isCoordinator) || a.name.localeCompare(b.name)),
    _count: u._count,
  }));

  return (
    <div className="adm-page">
      <div className="adm-content">
        <header className="adm-header ac-page-head">
          <div>
            <p className="lp-label">Admin</p>
            <h1 className="adm-header__title ac-page-title">{showLegacyPool ? "Legacy pool" : "Members"}</h1>
            <p className="adm-header__count ac-page-sub">
              {members.length} {showLegacyPool ? "unclaimed" : "total"}
            </p>
          </div>
        </header>

        <MembersTable members={members} teams={teams} showLegacyPool={showLegacyPool} legacyCount={legacyCount} />
      </div>
    </div>
  );
}
