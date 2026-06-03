/**
 * /account/hub/[slug]/documents/[id]/edit — Edit a native hub document
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership, effectiveCoordinator } from "@/lib/hubAuth";
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

  const [doc, hubMemberRows] = await Promise.all([
    db.hubDocument.findUnique({
      where: { id },
      include: {
        addedBy:   { select: { firstName: true, lastName: true, preferredName: true } },
        editingBy: { select: { firstName: true, lastName: true, preferredName: true } },
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
      activeEditorName={editorName}
      hubMembers={serializedMembers}
    />
  );
}
