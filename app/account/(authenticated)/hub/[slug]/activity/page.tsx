/** /account/hub/[slug]/activity — one meaningful Space activity river. */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { listHubActivity } from "@/lib/hubActivity";
import HubActivityClient from "@/components/HubActivityClient";

export const dynamic = "force-dynamic";

export default async function HubActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  const initial = await listHubActivity({
    hubId: hub.id,
    hubSlug: slug,
    userId: session.user.id,
    conversationsEnabled: hub.conversationsEnabled,
    limit: 30,
  });

  // Activity owns its read boundary. Visiting Home or Conversations no longer
  // consumes this stream's badge.
  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data: { activitySeenAt: new Date() },
    });
  }

  return (
    <HubActivityClient
      hubSlug={slug}
      initialItems={initial.items}
      initialNextCursor={initial.nextCursor}
    />
  );
}
