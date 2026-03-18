import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import MemberDetail from "@/components/MemberDetail";

export const dynamic = "force-dynamic";

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      registrations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          programTitle: true,
          programSlug: true,
          status: true,
          donationStatus: true,
          createdAt: true,
        },
      },
      courseAccess: {
        orderBy: { createdAt: "asc" },
        select: { id: true, courseSlug: true, createdAt: true },
      },
      hubAccess: {
        orderBy: { grantedAt: "asc" },
        select: { hubSlug: true, grantedAt: true },
      },
      household: {
        select: {
          isPrimary: true,
          relationshipType: true,
          relationshipCustom: true,
          household: {
            select: {
              id: true,
              name: true,
              addressLine1: true,
              addressCity: true,
              addressState: true,
              addressZip: true,
              members: {
                orderBy: { createdAt: "asc" },
                select: {
                  userId: true,
                  isPrimary: true,
                  relationshipType: true,
                  relationshipCustom: true,
                  user: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) notFound();

  // Construct serialized object explicitly — never spread the full Prisma user object,
  // as it contains Date fields (updatedAt, emailVerified, agreedAt, legacyLastLogin, etc.)
  // that cause RSC serialization errors when passed to Client Components.
  const serialized = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    title: user.title,
    phone: user.phone,
    addressLine1: user.addressLine1,
    addressCity: user.addressCity,
    addressState: user.addressState,
    addressZip: user.addressZip,
    memberStatus: user.memberStatus,
    firstVisitDate: user.firstVisitDate?.toISOString() ?? null,
    adminNotes: user.adminNotes,
    tags: user.tags,
    roles: user.roles,
    archivedAt: user.archivedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    registrations: user.registrations.map((r) => ({
      id: r.id,
      programTitle: r.programTitle,
      programSlug: r.programSlug,
      status: r.status,
      donationStatus: r.donationStatus,
      createdAt: r.createdAt.toISOString(),
    })),
    courseAccess: user.courseAccess.map((g) => ({
      id: g.id,
      courseSlug: g.courseSlug,
      createdAt: g.createdAt.toISOString(),
    })),
    hubAccess: user.hubAccess.map((h) => ({
      hubSlug: h.hubSlug,
      grantedAt: h.grantedAt.toISOString(),
    })),
    household: user.household
      ? {
          id: user.household.household.id,
          name: user.household.household.name,
          addressLine1: user.household.household.addressLine1,
          addressCity: user.household.household.addressCity,
          addressState: user.household.household.addressState,
          addressZip: user.household.household.addressZip,
          isPrimary: user.household.isPrimary,
          relationshipType: user.household.relationshipType,
          relationshipCustom: user.household.relationshipCustom,
          otherMembers: user.household.household.members
            .filter((m) => m.userId !== user.id)
            .map((m) => ({
              userId: m.userId,
              isPrimary: m.isPrimary,
              relationshipType: m.relationshipType,
              relationshipCustom: m.relationshipCustom,
              user: m.user,
            })),
        }
      : null,
  };

  return (
    <div className="adm-page">
      <div className="adm-content adm-content--narrow">
        <MemberDetail member={serialized} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
