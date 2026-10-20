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
  readPointOf,
  type HubActivitySourceKey,
} from "@/lib/hubActivity";
import HubActivityClient from "@/components/HubActivityClient";

export const dynamic = "force-dynamic";

export default async function HubActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ folder?: string; filter?: string; show?: string; type?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const { hub, member } = await getHubMembership(slug, session.user.id, roles);
  if (!hub || !canAccessHub(member, roles)) redirect("/account/dashboard");

  // ?show=for-you|unread and ?type=<kind>; ?folder= and ?filter=for-me are
  // older link shapes.
  const legacy = parseHubActivityFolder(query.folder ?? query.filter ?? null);
  const typeParam = parseHubActivityFolder(query.type ?? null);
  const type: HubActivitySourceKey | "all" = typeParam !== "for-you" ? typeParam : legacy !== "for-you" ? legacy : "all";
  const filesEnabled = hub.googleFilesEnabled && Boolean(hub.googleDriveId);
  const viewer = {
    userId: session.user.id,
    roles,
    isLead: hubLeadAllowed(roles, member),
    readPoint: readPointOf(member),
  };
  // Unread needs read state; without it (looking in on a team you aren't on), All.
  const scope: "all" | "for-you" | "unread" =
    query.show === "for-you" || legacy === "for-you" ? "for-you"
      : query.show === "unread" && viewer.readPoint ? "unread"
        : "all";
  const loadedAt = new Date().toISOString();
  const where = { hubId: hub.id, hubSlug: slug, viewer, conversationsEnabled: hub.conversationsEnabled, filesEnabled };
  const [initial, needs, counts, sourceOptions] = await Promise.all([
    listHubActivity({
      ...where,
      folder: scope === "for-you" ? "for-you" : type,
      source: scope === "for-you" ? type : undefined,
      show: scope === "unread" ? "unread" : "all",
      limit: 30,
    }),
    listHubNeeds(where),
    countHubUnread(where),
    listHubActivitySources({ hubId: hub.id, conversationsEnabled: hub.conversationsEnabled, filesEnabled }),
  ]);

  return (
    <HubActivityClient
      hubSlug={slug}
      initialItems={initial.items}
      initialNextCursor={initial.nextCursor}
      initialScope={scope}
      initialType={type}
      needs={needs}
      counts={counts}
      sourceOptions={sourceOptions}
      hasReadState={viewer.readPoint !== null}
      loadedAt={loadedAt}
      isLead={viewer.isLead}
    />
  );
}
