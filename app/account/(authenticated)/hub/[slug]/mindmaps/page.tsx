/**
 * /account/hub/[slug]/mindmaps — the Mind Maps hub module (Slice 2).
 *
 * Lists maps that originate in or are shared into this hub, mirroring the
 * Documents tab. Create a hub map, share/remove/delete per card. Doc-level
 * access (canAccessMindMap) hides COORDINATORS-visibility maps from non-coords.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { canAccessMindMap, canManageMindMapSharing } from "@/lib/mindMapAuth";
import HubMindMapsClient from "@/components/mindmap/HubMindMapsClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Mind Maps` };
}

type Visibility = "HUB" | "COORDINATORS" | "COMMUNITY";
type EditPolicy = "OPEN" | "RESTRICTED";

export default async function HubMindMapsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  const [maps, viewerMemberships] = await Promise.all([
    db.mindMap.findMany({
      where: { deletedAt: null, OR: [{ hubId: hub.id }, { placements: { some: { hubId: hub.id } } }] },
      include: {
        hub: { select: { id: true, slug: true, name: true } },
        placements: { include: { hub: { select: { id: true, slug: true, name: true } } } },
        _count: { select: { nodes: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.hubMember.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { hub: { select: { id: true, name: true, status: true } } },
    }),
  ]);

  const roles = session.user.roles ?? [];
  const isGT = roles.includes("GUIDING_TEACHER");
  const viewer = {
    userId: session.user.id,
    roles,
    memberships: viewerMemberships.map((m) => ({ hubId: m.hubId, isCoordinator: m.isCoordinator })),
  };

  const initialMaps = maps
    .map((m) => ({
      m,
      shape: {
        addedById: m.addedById,
        hubId: m.hubId,
        visibility: m.visibility,
        editPolicy: m.editPolicy,
        placements: m.placements.map((p) => ({ hubId: p.hubId })),
      },
    }))
    .filter(({ shape }) => canAccessMindMap(shape, viewer))
    .map(({ m, shape }) => ({
      id: m.id,
      title: m.title,
      nodeCount: m._count.nodes,
      updatedAt: m.updatedAt.toISOString(),
      visibility: m.visibility as Visibility,
      editPolicy: m.editPolicy as EditPolicy,
      isOrigin: m.hubId === hub.id,
      originHub: m.hub ? { id: m.hub.id, slug: m.hub.slug, name: m.hub.name } : null,
      sharedHubs: m.placements.map((p) => ({ id: p.hub.id, slug: p.hub.slug, name: p.hub.name })),
      canManageSharing: canManageMindMapSharing(shape, viewer),
      canDelete: m.addedById === session.user.id || isGT,
    }));

  const isCoordinator = member?.isCoordinator || roles.includes("ADMIN");
  const viewerHubs = viewerMemberships
    .filter((m) => m.hub.status === "ACTIVE")
    .map((m) => ({ id: m.hub.id, name: m.hub.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <HubMindMapsClient
      hubSlug={slug}
      hubId={hub.id}
      hubName={hub.name}
      isCoordinator={isCoordinator}
      initialMaps={initialMaps}
      viewerHubs={viewerHubs}
    />
  );
}
