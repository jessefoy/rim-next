/**
 * /account/mindmaps/[id] — the mind-map editor (Slice 1).
 *
 * Server-loads the map + its nodes, gates with canAccessMindMap (Slice 1: a
 * standalone map resolves to author/GT only), computes edit rights, and hands
 * serialized props to the full-screen client canvas. Not wrapped in
 * AccountLayout — the editor is a focused full-screen surface with its own
 * "← Mind Maps" back link.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessMindMap, canEditMindMap } from "@/lib/mindMapAuth";
import MindMapEditorMount from "@/components/mindmap/MindMapEditorMount";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mind Map" };

export default async function MindMapEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const map = await db.mindMap.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      addedById: true,
      hubId: true,
      visibility: true,
      deletedAt: true,
      nodes: {
        select: { id: true, label: true, note: true, x: true, y: true, parentId: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!map || map.deletedAt) notFound();

  const memberships = await db.hubMember.findMany({
    where: { userId: session.user.id },
    select: { hubId: true, isCoordinator: true },
  });
  const viewer = { userId: session.user.id, roles: session.user.roles ?? [], memberships };
  const shape = { addedById: map.addedById, hubId: map.hubId, visibility: map.visibility, placements: [] };
  if (!canAccessMindMap(shape, viewer)) notFound();

  return (
    <MindMapEditorMount
      mapId={map.id}
      initialTitle={map.title}
      initialDescription={map.description}
      canEdit={canEditMindMap(shape, viewer)}
      initialNodes={map.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        note: n.note,
        x: n.x,
        y: n.y,
        parentId: n.parentId,
      }))}
    />
  );
}
