/**
 * /tools/programs/new — Create a new program.
 * Role gate: REGISTRAR | ADMIN (handled by tools/programs/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import ProgramEditor from "@/components/registrar/ProgramEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Program — Tools" };

export default async function NewProgramToolPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const categories = await db.programCategory.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href="/tools/programs" className="vol-back">&larr; Programs</Link>
        </div>
        <ProgramEditor
          basePath="/tools/programs"
          isEditing={false}
          categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        />
      </div>
    </div>
  );
}
