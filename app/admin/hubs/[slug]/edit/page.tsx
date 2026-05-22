import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import HubAdminForm from "@/components/HubAdminForm";

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

  const initialData = {
    name: hub.name,
    slug: hub.slug,
    description: hub.description ?? "",
    type: hub.type,
    status: hub.status,
    assignmentGrantsTeacher: hub.assignmentGrantsTeacher,
    teacherLabel: hub.teacherLabel,
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
        <h1 className="adm-hubs-title">Edit Hub: {hub.name}</h1>
        <HubAdminForm isEditing initialData={initialData} hubSlug={slug} />
      </div>
    </div>
  );
}
