/**
 * /account/mindmaps — the master mind-map directory (Slice 2).
 *
 * "Find a map across all my teams." Sections are the viewer's own hubs (each
 * holding its accessible maps), then Community (reached community-wide), then
 * Projects (hubless personal maps). Mirrors /account/documents; access rides on
 * the pure, placement-aware canAccessMindMap.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessMindMap, canManageMindMapSharing } from "@/lib/mindMapAuth";
import AccountLayout from "@/components/AccountLayout";
import MindMapsDirectory from "@/components/mindmap/MindMapsDirectory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mind Maps" };

type Visibility = "HUB" | "COORDINATORS" | "COMMUNITY";
type EditPolicy = "OPEN" | "RESTRICTED";

export default async function MindMapsDirectoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isGT = roles.includes("GUIDING_TEACHER");

  const memberships = await db.hubMember.findMany({
    where: { userId },
    select: { hubId: true, isCoordinator: true, status: true, hub: { select: { id: true, slug: true, name: true, status: true } } },
  });
  const myActiveHubs = memberships.filter((m) => m.status === "ACTIVE" && m.hub.status === "ACTIVE");
  const myHubIds = myActiveHubs.map((m) => m.hubId);
  const myHubById = new Map(myActiveHubs.map((m) => [m.hubId, m.hub]));

  const candidates = await db.mindMap.findMany({
    where: {
      deletedAt: null,
      ...(isGT
        ? {}
        : {
            OR: [
              { addedById: userId },
              { visibility: "COMMUNITY" },
              { hubId: { in: myHubIds } },
              { placements: { some: { hubId: { in: myHubIds } } } },
            ],
          }),
    },
    include: {
      hub: { select: { id: true, slug: true, name: true } },
      placements: { include: { hub: { select: { id: true, slug: true, name: true } } } },
      _count: { select: { nodes: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const viewer = {
    userId,
    roles,
    memberships: myActiveHubs.map((m) => ({ hubId: m.hubId, isCoordinator: m.isCoordinator })),
  };

  function serialize(m: (typeof candidates)[number], badge: string | null) {
    const shape = {
      addedById: m.addedById,
      hubId: m.hubId,
      visibility: m.visibility,
      editPolicy: m.editPolicy,
      placements: m.placements.map((p) => ({ hubId: p.hubId })),
    };
    return {
      id: m.id,
      title: m.title,
      nodeCount: m._count.nodes,
      updatedAt: m.updatedAt.toISOString(),
      visibility: m.visibility as Visibility,
      editPolicy: m.editPolicy as EditPolicy,
      originHub: m.hub ? { id: m.hub.id, slug: m.hub.slug, name: m.hub.name } : null,
      sharedHubs: m.placements.map((p) => ({ id: p.hub.id, slug: p.hub.slug, name: p.hub.name })),
      canManageSharing: canManageMindMapSharing(shape, viewer),
      canDelete: m.addedById === userId || isGT,
      badge,
    };
  }
  type DirMap = ReturnType<typeof serialize>;

  // Badge for a map shown inside one of the viewer's hub sections.
  function hubBadge(m: (typeof candidates)[number], sectionHubId: string): string | null {
    if (m.hub && m.hub.id !== sectionHubId) return `Shared from ${m.hub.name}`;
    if (m.visibility === "COMMUNITY") return "Community";
    if (m.hub?.id === sectionHubId && m.placements.length > 0) return "Shared";
    return null;
  }

  const accessible = candidates.filter((m) =>
    canAccessMindMap(
      { addedById: m.addedById, hubId: m.hubId, visibility: m.visibility, editPolicy: m.editPolicy, placements: m.placements.map((p) => ({ hubId: p.hubId })) },
      viewer,
    ),
  );

  const hubSections = new Map<string, { hub: { id: string; slug: string; name: string }; maps: DirMap[] }>();
  const community: DirMap[] = [];
  const projects: DirMap[] = [];

  for (const m of accessible) {
    const mapHubIds = [...new Set([m.hubId, ...m.placements.map((p) => p.hubId)].filter((x): x is string => Boolean(x)))];
    const mine = mapHubIds.filter((hid) => myHubById.has(hid));
    if (mine.length > 0) {
      for (const hid of mine) {
        const hub = myHubById.get(hid)!;
        if (!hubSections.has(hid)) hubSections.set(hid, { hub, maps: [] });
        hubSections.get(hid)!.maps.push(serialize(m, hubBadge(m, hid)));
      }
    } else if (mapHubIds.length === 0) {
      projects.push(serialize(m, null));
    } else {
      // Reached here = visible but not in one of the viewer's hubs. Only label
      // "Community" when it truly is; a GT can see hub-private maps here too.
      community.push(serialize(m, m.visibility === "COMMUNITY" ? "Community" : m.hub ? `Shared from ${m.hub.name}` : null));
    }
  }

  const sections = [
    ...[...hubSections.values()]
      .sort((a, b) => a.hub.name.localeCompare(b.hub.name))
      .map((s) => ({ key: `hub-${s.hub.id}`, label: s.hub.name, maps: s.maps })),
    ...(community.length ? [{ key: "community", label: "Community", maps: community }] : []),
    ...(projects.length ? [{ key: "projects", label: "Projects", maps: projects }] : []),
  ];

  const viewerHubs = myActiveHubs
    .map((m) => ({ id: m.hub.id, name: m.hub.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AccountLayout>
      <MindMapsDirectory sections={sections} viewerHubs={viewerHubs} />
    </AccountLayout>
  );
}
