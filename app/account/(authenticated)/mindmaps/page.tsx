/**
 * /account/mindmaps — the member's mind-map directory (Slice 1).
 *
 * Lists the maps the viewer authored (private until placed into a hub — Slice
 * 2 grows this into hub + Community sections via canAccessMindMap). Mirrors the
 * documents directory's auth + serialization shape.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import MindMapsDirectory from "@/components/mindmap/MindMapsDirectory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mind Maps" };

export default async function MindMapsDirectoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const maps = await db.mindMap.findMany({
    where: { addedById: session.user.id, deletedAt: null },
    select: { id: true, title: true, updatedAt: true, _count: { select: { nodes: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const initialMaps = maps.map((m) => ({
    id: m.id,
    title: m.title,
    updatedAt: m.updatedAt.toISOString(),
    nodeCount: m._count.nodes,
  }));

  return (
    <AccountLayout>
      <MindMapsDirectory initialMaps={initialMaps} />
    </AccountLayout>
  );
}
