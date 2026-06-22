/**
 * /account/hub/[slug]/documents — Documents tab
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { canAccessDocument } from "@/lib/documentAuth";
import HubDocumentsClient from "@/components/HubDocumentsClient";
import { onlyOfficeConfigured } from "@/lib/onlyoffice";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return { title: `${hub?.name ?? "Hub"} — Documents` };
}

export default async function HubDocumentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect("/account/dashboard");

  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data:  { lastVisitedAt: new Date() },
    });
  }

  const [documents, hubMembers, viewerMemberships] = await Promise.all([
    db.hubDocument.findMany({
      // Trashed docs never surface here — they live at /trash for managers.
      // Archived docs ARE included; the client splits Active vs Archived.
      // Surface BOTH this hub's own docs AND docs shared *into* it (placements).
      where: {
        deletedAt: null,
        OR: [
          { hubId: hub.id },
          { placements: { some: { hubId: hub.id } } },
        ],
      },
      include: {
        addedBy:    { select: { firstName: true, lastName: true, preferredName: true } },
        hub:        { select: { id: true, slug: true, name: true } },
        placements: { include: { hub: { select: { id: true, slug: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Eligible notification recipients: active members with communicationsEnabled, excluding self
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
    // The viewer's own active hubs — the set they can share a doc INTO.
    db.hubMember.findMany({
      where:   { userId: session.user.id, status: "ACTIVE" },
      include: { hub: { select: { id: true, name: true, status: true } } },
    }),
  ]);

  const isCoordinator =
    member?.isCoordinator || (session.user.roles ?? []).includes("ADMIN");

  // Doc-level access (NOT just canAccessHub): hide COORDINATORS-visibility docs
  // from non-coordinators. The viewer's memberships are already loaded above for
  // the share-into list. (RIM_Hub_Engineering.md §"Documents are the first
  // hub-optional, multi-hub resource".)
  const docViewer = {
    userId:      session.user.id,
    roles:       session.user.roles ?? [],
    memberships: viewerMemberships.map((m) => ({ hubId: m.hubId, isCoordinator: m.isCoordinator })),
  };
  const accessibleDocuments = documents.filter((d) => canAccessDocument(d, docViewer));

  const serialized = accessibleDocuments.map((d) => ({
    id:          d.id,
    label:       d.label,
    url:         d.url,
    description: d.description,
    fileType:    d.fileType as "DOC" | "SHEET" | "SLIDE" | "FORM" | "LINK" | "PDF",
    docKind:     d.docKind,
    category:    d.category,
    isNative:    d.isNative,
    isLocked:    d.isLocked,
    addedById:   d.addedById,
    addedBy: {
      firstName:     d.addedBy.firstName,
      lastName:      d.addedBy.lastName,
      preferredName: d.addedBy.preferredName,
    },
    archivedAt: d.archivedAt?.toISOString() ?? null,
    createdAt:  d.createdAt.toISOString(),
    updatedAt:  d.updatedAt.toISOString(),
    visibility: d.visibility,
    isOrigin:   d.hubId === hub.id,
    originHub:  d.hub ? { id: d.hub.id, slug: d.hub.slug, name: d.hub.name } : null,
    sharedHubs: d.placements.map((p) => ({ id: p.hub.id, slug: p.hub.slug, name: p.hub.name })),
  }));

  const serializedMembers = hubMembers.map((m) => ({
    id:           m.userId,
    firstName:    m.user.firstName,
    lastName:     m.user.lastName,
    preferredName: m.user.preferredName,
  }));

  // Hubs the viewer can share a doc into (their active hubs, alphabetical).
  const viewerHubs = viewerMemberships
    .filter((m) => m.hub.status === "ACTIVE")
    .map((m) => ({ id: m.hub.id, name: m.hub.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <HubDocumentsClient
      hubSlug={slug}
      initialDocuments={serialized}
      documentCategories={hub.documentCategories as string[]}
      isCoordinator={isCoordinator}
      officeEnabled={onlyOfficeConfigured()}
      currentUserId={session.user.id}
      hubMembers={serializedMembers}
      viewerHubs={viewerHubs}
    />
  );
}
