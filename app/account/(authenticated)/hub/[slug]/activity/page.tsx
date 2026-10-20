/** /account/hub/[slug]/activity — the team's Updates, read like an inbox. */

import { auth } from "@/auth";
import { hubLeadAllowed } from "@/lib/googleFiles";
import { redirect } from "next/navigation";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import {
  countHubUnread,
  listHubActivity,
  listHubActivitySources,
  listHubNeeds,
  parseHubActivityFolder,
  parseHubActivityShow,
  readPointOf,
} from "@/lib/hubActivity";
import HubActivityClient from "@/components/HubActivityClient";

export const dynamic = "force-dynamic";

export default async function HubActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ folder?: string; filter?: string; show?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const { hub, member } = await getHubMembership(slug, session.user.id, roles);
  if (!hub || !canAccessHub(member, roles)) redirect("/account/dashboard");

  // ?filter=for-me is the older link shape.
  const folder = parseHubActivityFolder(query.folder ?? query.filter ?? null);
  const filesEnabled = hub.googleFilesEnabled && Boolean(hub.googleDriveId);
  const viewer = {
    userId: session.user.id,
    roles,
    isLead: hubLeadAllowed(roles, member),
    readPoint: readPointOf(member),
  };
  // Unread needs read state; without it (looking in on a team you aren't on), All.
  const show = viewer.readPoint ? parseHubActivityShow(query.show ?? null) : "all";
  const loadedAt = new Date().toISOString();
  const scope = { hubId: hub.id, hubSlug: slug, viewer, conversationsEnabled: hub.conversationsEnabled, filesEnabled };
  const [initial, needs, counts, sourceOptions] = await Promise.all([
    listHubActivity({ ...scope, folder, show, limit: 30 }),
    listHubNeeds(scope),
    countHubUnread(scope),
    listHubActivitySources({ hubId: hub.id, conversationsEnabled: hub.conversationsEnabled, filesEnabled }),
  ]);

  return (
    <HubActivityClient
      hubSlug={slug}
      initialItems={initial.items}
      initialNextCursor={initial.nextCursor}
      initialFolder={folder}
      initialShow={show}
      needs={needs}
      counts={counts}
      sourceOptions={sourceOptions}
      hasReadState={viewer.readPoint !== null}
      loadedAt={loadedAt}
      isLead={viewer.isLead}
    />
  );
}
