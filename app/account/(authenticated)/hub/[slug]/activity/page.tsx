/** /account/hub/[slug]/activity — source-aware Space Updates. */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { listHubActivity } from "@/lib/hubActivity";
import HubActivityClient from "@/components/HubActivityClient";

export const dynamic = "force-dynamic";

export default async function HubActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  const priorSeenAt = member?.activitySeenAt ?? null;
  const initialFilter = query.filter === "new" || query.filter === "for-me" ? query.filter : "all";
  const initial = await listHubActivity({
    hubId: hub.id,
    hubSlug: slug,
    userId: session.user.id,
    conversationsEnabled: hub.conversationsEnabled,
    filter: initialFilter,
    newSince: priorSeenAt,
    limit: 30,
  });

  // Updates owns its read boundary. Visiting Home or Conversations no longer
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
      initialFilter={initialFilter}
      newSince={priorSeenAt?.toISOString() ?? null}
    />
  );
}
