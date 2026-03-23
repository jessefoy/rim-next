/**
 * /account/hub/[slug]/tasks — Tasks tab
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import HubTasksClient from "@/components/HubTasksClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Tasks` };
}

export default async function HubTasksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  // Update lastVisitedAt
  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data: { lastVisitedAt: new Date() },
    });
  }

  // Fetch lists with tasks+subtasks
  const lists = await db.taskList.findMany({
    where: { hubId: hub.id, isTemplate: false, isArchived: false },
    orderBy: { order: "asc" },
    include: {
      tasks: {
        orderBy: { order: "asc" },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          subtasks: {
            orderBy: { order: "asc" },
            include: {
              assignee: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
              createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  // Fetch hub members for assignee picker
  const members = hub.members.map((m) => ({
    id: m.userId,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    preferredName: (m.user as any).preferredName ?? null,
  }));

  // Serialize dates
  const serializedLists = JSON.parse(JSON.stringify(lists));

  return (
    <HubTasksClient
      slug={slug}
      initialLists={serializedLists}
      members={members}
      currentUserId={session.user.id}
    />
  );
}
