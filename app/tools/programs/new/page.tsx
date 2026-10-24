/**
 * /tools/programs/new — Create a new program.
 * Gate: canUsePrograms (also in tools/programs/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { canUseRegistration, canUseProgramManager, canUsePrograms } from "@/lib/toolAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import ProgramEditor from "@/components/registrar/ProgramEditor";
import { helpingTeams } from "@/lib/programHelpers";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Program - Tools" };

export default async function NewProgramToolPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await canUsePrograms(session.user.id, session.user.roles))) notFound();

  const [categories, hubs] = await Promise.all([
    db.programCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    db.hub.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        name: true,
        hasSchedule: true,
        appliesToFormats: true,
        appLinks: {
          where: { toolSlug: "schedule", isEnabled: true },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href="/tools/programs" className="vol-back">&larr; Programs</Link>
        </div>
        <ProgramEditor
          basePath="/tools/programs"
          isEditing={false}
          canManage={canUseProgramManager(session.user.roles)}
          categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, kind: c.kind ?? null, hidden: c.hideFromProgramsPage }))}
          hubs={hubs.map((h) => ({
            id: h.id,
            slug: h.slug,
            name: h.name,
            hasSchedule: h.hasSchedule,
            appliesToFormats: h.appliesToFormats,
            usesScheduler: h.appLinks.length > 0,
          }))}
          prepTeams={await helpingTeams()}
          canDecideAskers={canUseRegistration(session.user.roles)}
        />
      </div>
    </div>
  );
}
