/**
 * /account/hub/[slug] — Announcements tab (hub home)
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import HubAnnouncementsClient from "@/components/HubAnnouncementsClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Announcements` };
}

export default async function HubAnnouncementsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Course hub home is the Series tab — redirect there
  if (slug === "courses") redirect(`/account/hub/courses/courses`);

  // Registrar hub home is the Programs tab — redirect there
  if (slug === "registrar") redirect(`/account/hub/registrar/programs`);

  // Support hub home is the Inbox tab — redirect there
  if (slug === "support") redirect(`/account/hub/support/inbox`);

  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  // Update lastVisitedAt (skip for admin-only access without hub membership)
  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data:  { lastVisitedAt: new Date() },
    });
  }

  const announcements = await db.hubAnnouncement.findMany({
    where:   { hubId: hub.id, status: "ACTIVE" },
    include: { author: { select: { firstName: true, lastName: true, preferredName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const isCoordinator =
    member?.isCoordinator || (session.user.roles ?? []).includes("ADMIN");

  const serialized = announcements.map((a) => ({
    id:             a.id,
    title:          a.title,
    body:           a.body,
    priority:       a.priority as "NORMAL" | "IMPORTANT" | "URGENT",
    status:         a.status  as "ACTIVE" | "ARCHIVED",
    linkedThreadId: a.linkedThreadId,
    authorId:       a.authorId,
    author: {
      firstName:     a.author.firstName,
      lastName:      a.author.lastName,
      preferredName: a.author.preferredName,
    },
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <HubAnnouncementsClient
      hubSlug={slug}
      initialAnnouncements={serialized}
      isCoordinator={isCoordinator}
      conversationsBase={`/account/hub/${slug}/conversations`}
    />
  );
}
