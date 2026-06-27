/**
 * /account/hub/[slug]/documents/[id]/edit — Edit a native hub document
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership, effectiveCoordinator } from "@/lib/hubAuth";
import { canManageDocumentSharing } from "@/lib/documentAuth";
import HubDocumentEditor from "@/components/HubDocumentEditor";

export const dynamic = "force-dynamic";

export default async function HubDocumentEditPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect(`/account/hub/${slug}/documents`);

  const [doc, hubMemberRows, viewerMemberships] = await Promise.all([
    db.hubDocument.findUnique({
      where: { id },
      include: {
        addedBy:   { select: { firstName: true, lastName: true, preferredName: true } },
        editingBy: { select: { firstName: true, lastName: true, preferredName: true } },
        placements: { select: { hub: { select: { id: true, slug: true, name: true } } } },
      },
    }),
    db.hubMember.findMany({
      where: {
        hubId:                 hub.id,
        status:                "ACTIVE",
        communicationsEnabled: true,
        userId:                { not: session.user.id },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    }),
    // The viewer's own active hubs — drives the "share into another hub" picker
    // and the canManageDocumentSharing check (origin-hub authority).
    db.hubMember.findMany({
      where:  { userId: session.user.id, status: "ACTIVE" },
      select: { hubId: true, isCoordinator: true, hub: { select: { id: true, name: true } } },
    }),
  ]);

  if (!doc || doc.hubId !== hub.id) notFound();

  // Only author or coordinator can edit
  const editRoles = session.user.roles ?? [];
  const isCoordinator = effectiveCoordinator(member, editRoles);
  const isAuthor = doc.addedById === session.user.id;
  if (!isAuthor && !isCoordinator) redirect(`/account/hub/${slug}/documents`);

  // Locked docs: only author, ADMIN, or GUIDING_TEACHER can edit. (Lock is the
  // author asserting sole authorship; coordinators don't override it, but
  // technical/dharma authorities do for moderation/restoration.)
  const canOverrideLock =
    editRoles.includes("ADMIN") || editRoles.includes("GUIDING_TEACHER");
  if (doc.isLocked && !isAuthor && !canOverrideLock) {
    redirect(`/account/hub/${slug}/documents/${id}`);
  }

  // Check if someone else is actively editing (presence within last 60s)
  const otherEditing = doc.editingById
    && doc.editingById !== session.user.id
    && doc.editingAt
    && (Date.now() - new Date(doc.editingAt).getTime() < 60_000)
    ? doc.editingBy
    : null;

  const authorName = doc.addedBy.preferredName
    || [doc.addedBy.firstName, doc.addedBy.lastName].filter(Boolean).join(" ")
    || "Unknown";

  const editorName = otherEditing
    ? (otherEditing.preferredName || [otherEditing.firstName, otherEditing.lastName].filter(Boolean).join(" ") || "Someone")
    : null;

  const serializedMembers = hubMemberRows.map((m) => ({
    id:            m.userId,
    firstName:     m.user.firstName,
    lastName:      m.user.lastName,
    preferredName: m.user.preferredName,
  }));

  // Sharing: only the author or a coordinator of the home hub can manage it
  // (mirrors the API gate). Compute server-side; the controls hide otherwise.
  const canManageSharing = canManageDocumentSharing(
    {
      addedById:  doc.addedById,
      hubId:      doc.hubId,
      visibility: doc.visibility,
      placements: doc.placements.map((p) => ({ hubId: p.hub.id })),
    },
    {
      userId:      session.user.id,
      roles:       editRoles,
      memberships: viewerMemberships.map((m) => ({ hubId: m.hubId, isCoordinator: m.isCoordinator })),
    },
  );
  const viewerHubs = viewerMemberships.map((m) => ({ id: m.hub.id, name: m.hub.name }));
  const sharedHubs = doc.placements.map((p) => p.hub);

  return (
    <HubDocumentEditor
      hubSlug={slug}
      docId={id}
      initialLabel={doc.label}
      initialBody={doc.body}
      initialCategory={doc.category ?? ""}
      documentCategories={hub.documentCategories as string[]}
      isAuthor={isAuthor}
      isAdmin={isAdmin}
      isLocked={doc.isLocked}
      authorName={authorName}
      initialUpdatedAt={doc.updatedAt.toISOString()}
      activeEditorName={editorName}
      hubMembers={serializedMembers}
      canManageSharing={canManageSharing}
      initialVisibility={doc.visibility}
      initialSharedHubs={sharedHubs}
      viewerHubs={viewerHubs}
      originHubId={hub.id}
    />
  );
}
