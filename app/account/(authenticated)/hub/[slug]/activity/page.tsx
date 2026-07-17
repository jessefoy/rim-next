/** /account/hub/[slug]/activity — source-aware Space Updates. */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { listHubActivity, listHubActivitySources } from "@/lib/hubActivity";
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

  const initialFilter = query.filter === "recent" || query.filter === "for-me" ? query.filter : "all";
  const filesEnabled = hub.googleFilesEnabled && Boolean(hub.googleDriveId);
  const [initial, sourceOptions] = await Promise.all([
    listHubActivity({
      hubId: hub.id,
      hubSlug: slug,
      userId: session.user.id,
      conversationsEnabled: hub.conversationsEnabled,
      filesEnabled,
      filter: initialFilter,
      limit: 30,
    }),
    listHubActivitySources({
      hubId: hub.id,
      conversationsEnabled: hub.conversationsEnabled,
      filesEnabled,
    }),
  ]);

  return (
    <HubActivityClient
      hubSlug={slug}
      initialItems={initial.items}
      initialNextCursor={initial.nextCursor}
      initialFilter={initialFilter}
      sourceOptions={sourceOptions}
    />
  );
}
