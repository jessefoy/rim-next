import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import HubAdminForm from "@/components/HubAdminForm";
import { googleConfigured } from "@/lib/google/auth";

export const metadata = { title: "Edit Hub — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminHubEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
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

  const { slug } = await params;

  const hub = await db.hub.findUnique({
    where: { slug },
    include: {
      appLinks: { orderBy: { order: "asc" } },
      members: {
        where: { isCoordinator: true },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  if (!hub) notFound();

  // Is the admin viewing this page already a coordinator of this hub?
  // Drives the "Add me as coordinator" button — hidden when already one.
  // Separate query because the include above filters to all coordinators.
  const selfMembership = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId: session.user.id } },
    select: { isCoordinator: true, status: true },
  });
  const isCurrentUserCoordinator =
    !!selfMembership && selfMembership.isCoordinator && selfMembership.status === "ACTIVE";

  const initialData = {
    name: hub.name,
    slug: hub.slug,
    description: hub.description ?? "",
    type: hub.type,
    status: hub.status,
    hasSchedule: hub.hasSchedule,
    assignmentGrantsTeacher: hub.assignmentGrantsTeacher,
    teacherLabel: hub.teacherLabel,
    googleDriveId: hub.googleDriveId,
    googleFilesEnabled: hub.googleFilesEnabled,
    coverageNoun: hub.coverageNoun,
    coverageVerb: hub.coverageVerb,
    coverageAction: hub.coverageAction,
    appLinks: hub.appLinks.map((l) => ({
      toolSlug: l.toolSlug ?? null,
      label: l.label,
      href: l.href,
      isEnabled: l.isEnabled,
    })),
    coordinators: hub.members.map((m) => ({
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email!,
    })),
    welcomeHeadline: hub.welcomeHeadline ?? "",
    welcomeBody: hub.welcomeBody,
    homeContent: hub.homeContent,
  };

  return (
    <div className="adm-page">
      <div className="adm-content">
        <header className="ac-page-head">
          <div>
            <h1 className="adm-hubs-title ac-page-title">{hub.name}</h1>
            <p className="ac-page-sub">Hub identity, access, language, content, and connected tools.</p>
          </div>
        </header>
        <HubAdminForm
          isEditing
          initialData={initialData}
          hubSlug={slug}
          isCurrentUserCoordinator={isCurrentUserCoordinator}
          googleConfigured={googleConfigured()}
        />
      </div>
    </div>
  );
}
