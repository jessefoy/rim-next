import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import HouseholdDetail from "@/components/HouseholdDetail";

export const dynamic = "force-dynamic";

export default async function AdminHouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;

  const household = await db.household.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!household) notFound();

  const serialized = {
    id: household.id,
    name: household.name,
    addressLine1: household.addressLine1,
    addressCity: household.addressCity,
    addressState: household.addressState,
    addressZip: household.addressZip,
    notes: household.notes,
    createdAt: household.createdAt.toISOString(),
    members: household.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      isPrimary: m.isPrimary,
      relationshipType: m.relationshipType,
      relationshipCustom: m.relationshipCustom,
      createdAt: m.createdAt.toISOString(),
      user: {
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        preferredName: m.user.preferredName,
        email: m.user.email,
      },
    })),
  };

  return (
    <div className="adm-page">
      <div className="adm-content adm-content--narrow">
        <HouseholdDetail household={serialized} isAdmin={isAdmin ?? false} />
      </div>
    </div>
  );
}
