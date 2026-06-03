/**
 * /account/hub/[slug]/documents/new — Create a new native hub document
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import HubDocumentEditor from "@/components/HubDocumentEditor";

export const dynamic = "force-dynamic";

export default async function HubDocumentNewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || !canAccessHub(member, session.user.roles ?? [])) redirect(`/account/hub/${slug}/documents`);

  const hubMembers = await db.hubMember.findMany({
    where: {
      hubId:                 hub.id,
      status:                "ACTIVE",
      communicationsEnabled: true,
      userId:                { not: session.user.id },
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });

  const serializedMembers = hubMembers.map((m) => ({
    id:            m.userId,
    firstName:     m.user.firstName,
    lastName:      m.user.lastName,
    preferredName: m.user.preferredName,
  }));

  return (
    <HubDocumentEditor
      hubSlug={slug}
      docId={null}
      initialLabel=""
      initialBody={null}
      initialCategory=""
      documentCategories={hub.documentCategories as string[]}
      hubMembers={serializedMembers}
    />
  );
}
