/**
 * /account/hub/registrar/programs/new — Create a new program.
 * REGISTRAR | ADMIN only.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import Link from "next/link";
import ProgramEditor from "@/components/registrar/ProgramEditor";

export const dynamic = "force-dynamic";

export default async function NewProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const roles = session.user.roles ?? [];
  const isRegistrar = roles.includes("REGISTRAR") || roles.includes("ADMIN");
  if (!isRegistrar) redirect(`/account/hub/${slug}/programs`);

  const categories = await db.programCategory.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href={`/account/hub/${slug}/programs`} className="vol-back">&larr; Programs</Link>
        </div>
        <ProgramEditor
          hubSlug={slug}
          isEditing={false}
          categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        />
      </div>
    </div>
  );
}
