/**
 * /account/hub/[slug]/trash — Hub trash bin.
 *
 * Visible only to trash-managers (ADMIN, GUIDING_TEACHER, hub coordinators).
 * Lists soft-deleted documents and threads side by side, sorted by deletion
 * date (most recent first). Each row offers Restore or Permanently Delete.
 *
 * General members never see this page or its contents — even direct URL
 * access redirects them to the dashboard.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership, canManageTrash } from "@/lib/hubAuth";
import HubTrashClient from "@/components/HubTrashClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Trash` };
}

export default async function HubTrashPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  const roles = session.user.roles ?? [];
  const isCoord = member?.isCoordinator ?? false;
  if (!canManageTrash(roles, isCoord)) {
    redirect(`/account/hub/${slug}`);
  }

  const [trashedDocs, trashedThreads] = await Promise.all([
    db.hubDocument.findMany({
      where:   { hubId: hub.id, deletedAt: { not: null } },
      include: {
        addedBy:   { select: { firstName: true, lastName: true, preferredName: true } },
        deletedBy: { select: { firstName: true, lastName: true, preferredName: true } },
      },
      orderBy: { deletedAt: "desc" },
    }),
    db.hubConversationThread.findMany({
      where:   { hubId: hub.id, deletedAt: { not: null } },
      include: {
        author:    { select: { firstName: true, lastName: true, preferredName: true } },
        deletedBy: { select: { firstName: true, lastName: true, preferredName: true } },
        _count:    { select: { replies: true } },
      },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  const serializedDocs = trashedDocs.map((d) => ({
    id:         d.id,
    label:      d.label,
    fileType:   d.fileType as string,
    category:   d.category,
    addedBy: {
      firstName:     d.addedBy.firstName,
      lastName:      d.addedBy.lastName,
      preferredName: d.addedBy.preferredName,
    },
    deletedAt:  d.deletedAt!.toISOString(),
    deletedBy: d.deletedBy ? {
      firstName:     d.deletedBy.firstName,
      lastName:      d.deletedBy.lastName,
      preferredName: d.deletedBy.preferredName,
    } : null,
  }));

  const serializedThreads = trashedThreads.map((t) => ({
    id:         t.id,
    title:      t.title,
    category:   t.category,
    replyCount: t._count.replies,
    author: {
      firstName:     t.author.firstName,
      lastName:      t.author.lastName,
      preferredName: t.author.preferredName,
    },
    deletedAt:  t.deletedAt!.toISOString(),
    deletedBy: t.deletedBy ? {
      firstName:     t.deletedBy.firstName,
      lastName:      t.deletedBy.lastName,
      preferredName: t.deletedBy.preferredName,
    } : null,
  }));

  return (
    <HubTrashClient
      hubSlug={slug}
      hubName={hub.name}
      initialDocs={serializedDocs}
      initialThreads={serializedThreads}
    />
  );
}
