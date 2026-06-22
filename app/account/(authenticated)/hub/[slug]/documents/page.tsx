/**
 * /account/hub/[slug]/documents — Documents tab
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
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

  const [documents, hubMembers] = await Promise.all([
    db.hubDocument.findMany({
      // Trashed documents are never surfaced here — they live at /trash for managers.
      // Archived documents ARE included; client splits into Active vs Archived tabs.
      where:   { hubId: hub.id, deletedAt: null },
      include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
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
  ]);

  const isCoordinator =
    member?.isCoordinator || (session.user.roles ?? []).includes("ADMIN");

  const serialized = documents.map((d) => ({
    id:          d.id,
    label:       d.label,
    url:         d.url,
    description: d.description,
    fileType:    d.fileType as "DOC" | "SHEET" | "SLIDE" | "FORM" | "LINK" | "PDF",
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
  }));

  const serializedMembers = hubMembers.map((m) => ({
    id:           m.userId,
    firstName:    m.user.firstName,
    lastName:     m.user.lastName,
    preferredName: m.user.preferredName,
  }));

  return (
    <HubDocumentsClient
      hubSlug={slug}
      initialDocuments={serialized}
      documentCategories={hub.documentCategories as string[]}
      isCoordinator={isCoordinator}
      officeEnabled={onlyOfficeConfigured()}
      currentUserId={session.user.id}
      hubMembers={serializedMembers}
    />
  );
}
