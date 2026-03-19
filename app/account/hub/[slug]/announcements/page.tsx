/**
 * /account/hub/[slug]/announcements — Dedicated announcements route
 * Used by hubs where announcements is not the default tab (e.g., Teacher Hub).
 * Renders the same content as the hub home page for other hubs.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import HubAnnouncementsClient from "@/components/HubAnnouncementsClient";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Announcements` };
}

export default async function HubAnnouncementsRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

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

  const serialized = await Promise.all(
    announcements.map(async (a) => ({
      id:             a.id,
      title:          a.title,
      body:           a.body,
      bodyHtml:       await renderFormattedTextAsync(a.body),
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
    }))
  );

  return (
    <HubAnnouncementsClient
      hubSlug={slug}
      initialAnnouncements={serialized}
      isCoordinator={isCoordinator}
      conversationsBase={`/account/hub/${slug}/conversations`}
    />
  );
}
