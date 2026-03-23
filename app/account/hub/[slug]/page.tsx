/**
 * /account/hub/[slug] — Hub Home tab (default landing).
 *
 * Shows: hub description, coordinator, pinned threads, home content, app links.
 * Newcomers (firstVisitedAt is null) see a welcome interstitial first.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import HubHomeClient from "@/components/HubHomeClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Home` };
}

export default async function HubHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  // Update lastVisitedAt (same pattern as conversations page)
  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data: { lastVisitedAt: new Date() },
    });
  }

  // Pinned threads
  const pinnedThreads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, isPinned: true, status: "OPEN" },
    select: { id: true, title: true },
    orderBy: { pinnedAt: "desc" },
  });

  // App links
  const appLinks = await db.hubAppLink.findMany({
    where: { hubId: hub.id, isEnabled: true },
    orderBy: { order: "asc" },
  });

  // Coordinator names
  const coordinators = hub.members
    .filter((m) => m.isCoordinator)
    .map((m) => {
      const u = m.user;
      return (u as any).preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
    });

  // Render home content + welcome body as HTML (server-side)
  const homeContentHtml = await renderFormattedTextAsync(hub.homeContent);
  const welcomeBodyHtml = await renderFormattedTextAsync(hub.welcomeBody);

  // Determine if newcomer welcome should show
  const isNewcomer = member ? !member.firstVisitedAt : false;
  const hasWelcomeContent = !!(hub.welcomeBody);

  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;

  return (
    <HubHomeClient
      slug={slug}
      hubName={hub.name}
      description={hub.description}
      coordinatorNames={coordinators}
      pinnedThreads={pinnedThreads}
      appLinks={appLinks.map((l) => ({ label: l.label, href: l.href }))}
      homeContentHtml={homeContentHtml}
      homeContentJson={hub.homeContent}
      welcomeHeadline={hub.welcomeHeadline}
      welcomeBodyHtml={welcomeBodyHtml}
      isNewcomer={isNewcomer}
      hasWelcomeContent={hasWelcomeContent}
      isCoordinator={isCoordinator}
    />
  );
}
