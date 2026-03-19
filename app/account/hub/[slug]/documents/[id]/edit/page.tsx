/**
 * /account/hub/[slug]/documents/[id]/edit — Edit a native hub document
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
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
  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;
  if (!hub || !isCoordinator) redirect(`/account/hub/${slug}/documents`);

  const doc = await db.hubDocument.findUnique({ where: { id } });
  if (!doc || doc.hubId !== hub.id) notFound();

  return (
    <HubDocumentEditor
      hubSlug={slug}
      docId={id}
      initialLabel={doc.label}
      initialBody={Array.isArray(doc.body) ? doc.body : null}
      initialCategory={doc.category ?? ""}
      documentCategories={hub.documentCategories as string[]}
    />
  );
}
