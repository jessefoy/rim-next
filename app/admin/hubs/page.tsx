import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import HubAdminList from "@/components/HubAdminList";

export const metadata = { title: "Hubs — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminHubsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.roles?.includes("ADMIN");
  if (!isAdmin) {
    return (
      <div className="adm-page">
        <div className="adm-content">
          <p className="adm-unauthorized">You don&rsquo;t have permission to access this area.</p>
        </div>
      </div>
    );
  }

  const sp = await searchParams;

  const hubs = await db.hub.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { members: true } } },
  });

  const serialized = hubs.map((h) => ({
    id: h.id,
    name: h.name,
    slug: h.slug,
    type: h.type,
    status: h.status,
    _count: h._count,
  }));

  return (
    <div className="adm-page">
      <div className="adm-content">
        <div className="adm-hubs-header ac-page-head">
          <div>
            <h1 className="adm-hubs-title ac-page-title">Hubs</h1>
            <p className="ac-page-sub">Configure team workspaces, access, and connected tools.</p>
          </div>
          <Link href="/admin/hubs/new" className="adm-hubs-btn-create">
            Create new hub
          </Link>
        </div>

        <HubAdminList hubs={serialized} showCreated={sp.created === "1"} />
      </div>
    </div>
  );
}
