/**
 * /account/hub/[slug]/documents — Documents tab
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import HubDocumentsClient from "@/components/HubDocumentsClient";

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

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data:  { lastVisitedAt: new Date() },
    });
  }

  const documents = await db.hubDocument.findMany({
    where:   { hubId: hub.id },
    include: { addedBy: { select: { firstName: true, lastName: true, preferredName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const isCoordinator =
    member?.isCoordinator || (session.user.roles ?? []).includes("ADMIN");

  const serialized = documents.map((d) => ({
    id:          d.id,
    label:       d.label,
    url:         d.url,                    // string | null
    description: d.description,
    fileType:    d.fileType as "DOC" | "SHEET" | "SLIDE" | "FORM" | "LINK",
    category:    d.category,
    isNative:    d.isNative,
    addedById:   d.addedById,
    addedBy: {
      firstName:     d.addedBy.firstName,
      lastName:      d.addedBy.lastName,
      preferredName: d.addedBy.preferredName,
    },
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <HubDocumentsClient
      hubSlug={slug}
      initialDocuments={serialized}
      documentCategories={hub.documentCategories as string[]}
      isCoordinator={isCoordinator}
      currentUserId={session.user.id}
    />
  );
}
