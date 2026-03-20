/**
 * /account/hub/[slug]/documents/new — Create a new native hub document
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
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

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect(`/account/hub/${slug}/documents`);

  return (
    <HubDocumentEditor
      hubSlug={slug}
      docId={null}
      initialLabel=""
      initialBody={null}
      initialCategory=""
      documentCategories={hub.documentCategories as string[]}
    />
  );
}
