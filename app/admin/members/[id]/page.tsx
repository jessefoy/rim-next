import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import MemberDetail from "@/components/MemberDetail";
import ManualHelpIcon from "@/components/ManualHelpIcon";
import { type ViewerPermissions } from "@/lib/memberSectionRegistry";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";

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

  // Fetch viewer's sectionGrants alongside the member record
  const [user, viewer] = await Promise.all([
    db.user.findUnique({
      where: { id },
      include: {
        teacherProfile: {
          select: { bio: true, photoUrl: true, slug: true, isPublic: true },
        },
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
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { sectionGrants: true },
    }),
  ]);

  if (!user) notFound();

  // Pre-render legacy admin notes for BlockNote import on mount
  const legacyAdminNotesHtml = user.adminNotes && !Array.isArray(user.adminNotes)
    ? await renderFormattedTextAsync(user.adminNotes)
    : null;

  const viewerPermissions: ViewerPermissions = {
    roles: session.user.roles ?? [],
    sectionGrants: viewer?.sectionGrants ?? [],
  };

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
    legacyAdminNotesHtml: legacyAdminNotesHtml,
    bio: user.bio,
    tags: user.tags,
    sectionGrants: user.sectionGrants,
    roles: user.roles,
    isTeacher: user.isTeacher,
    teacherProfile: user.teacherProfile
      ? {
          bio: user.teacherProfile.bio ?? null,
          photoUrl: user.teacherProfile.photoUrl ?? null,
          slug: user.teacherProfile.slug ?? null,
          isPublic: user.teacherProfile.isPublic,
        }
      : null,
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
    <div className="adm2-page">
      <div className="adm2-content" style={{ position: "relative" }}>
        <ManualHelpIcon manualSlug="member-accounts" />
        <MemberDetail member={serialized} viewerPermissions={viewerPermissions} />
      </div>
    </div>
  );
}
