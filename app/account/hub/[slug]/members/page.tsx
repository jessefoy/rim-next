/**
 * /account/hub/[slug]/members — Members tab
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership, effectiveCoordinator } from "@/lib/hubAuth";
import HubMembersClient from "@/components/HubMembersClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Members` };
}

export default async function HubMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const isCoordinator = effectiveCoordinator(member, session.user.roles ?? []);

  const members = await db.hubMember.findMany({
    where:   { hubId: hub.id },
    include: { user: { select: { firstName: true, lastName: true, preferredName: true, title: true, email: true, avatarUrl: true } } },
    orderBy: [{ isCoordinator: "desc" }, { joinedAt: "asc" }],
  });

  const serialized = members.map((m) => ({
    id:            m.id,
    userId:        m.userId,
    isCoordinator: m.isCoordinator,
    position:      m.position,
    status:        m.status,
    hostingCapability:     m.hostingCapability,
    communicationsEnabled: m.communicationsEnabled,
    pausedAt:        m.pausedAt?.toISOString() ?? null,
    pausedById:      m.pausedById,
    pauseNote:       m.pauseNote,
    coordinatorNote: m.coordinatorNote,
    joinedAt:        m.joinedAt.toISOString(),
    user: {
      firstName:     m.user.firstName,
      lastName:      m.user.lastName,
      preferredName: m.user.preferredName,
      title:         m.user.title,
      email:         m.user.email,
      avatarUrl:     m.user.avatarUrl,
    },
  }));

  return (
    <HubMembersClient
      hubSlug={slug}
      hasSchedule={hub.hasSchedule}
      members={serialized}
      isCoordinator={isCoordinator}
      isAdmin={isAdmin}
      currentUserId={session.user.id}
    />
  );
}
