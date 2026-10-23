/**
 * /account/hub/[slug] — team Home, the standard for every team (Jesse,
 * 2026-10-13): the name, the team's own line (Hub.description, edited by its
 * leads), its tool highlighted, the destinations, and personal attention.
 * The first-visit welcome screen, "About this team", the month overview,
 * pinned conversations and "Team guidance" were retired.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership, effectiveCoordinator } from "@/lib/hubAuth";
import HubHomeClient from "@/components/HubHomeClient";
import { getHubHomeApps } from "@/lib/hubApps";
import { getHubHomeAttention } from "@/lib/hubActivity";
import { canSeeInstalledApp } from "@/lib/toolAuth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Team"} - Home` };
}

export default async function HubHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data: { lastVisitedAt: new Date() },
    });
  }

  // Programs and Registration show only to the roles that can use them (Jesse,
  // 2026-10-19); a team member without them saw a card and a rail link that
  // opened "You don't have permission".
  const appLinks = (await db.hubAppLink.findMany({
    where: { hubId: hub.id, isEnabled: true },
    orderBy: { order: "asc" },
  })).filter((l) => canSeeInstalledApp(l.toolSlug, session.user.roles));
  const [attention, apps] = await Promise.all([
    getHubHomeAttention({
      hubId: hub.id,
      hubSlug: hub.slug,
      userId: session.user.id,
    }),
    getHubHomeApps(hub.slug, appLinks),
  ]);

  return (
    <HubHomeClient
      slug={slug}
      hubName={hub.name}
      line={hub.description ?? null}
      canEditLine={effectiveCoordinator(member, session.user.roles ?? [])}
      conversationsEnabled={hub.conversationsEnabled}
      filesEnabled={!!hub.googleFilesEnabled && !!hub.googleDriveId}
      apps={apps}
      attention={attention}
    />
  );
}
