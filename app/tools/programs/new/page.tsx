/**
 * /tools/programs/new — Create a new program.
 * Gate: canUsePrograms (also in tools/programs/layout.tsx).
 *
 * Without ?shape: "What are you offering?" (2026-10-24, Phase 4 slice 4), the
 * shapes from lib/programShapes.ts and a blank start. With ?shape=<Format>
 * the editor opens with that shape's starting settings; ?shape=blank opens
 * it empty.
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { canUseRegistration, canUseProgramManager, canUsePrograms } from "@/lib/toolAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import ProgramEditor from "@/components/registrar/ProgramEditor";
import { helpingTeams } from "@/lib/programHelpers";
import { SHAPES, isShapeCode, shapeStart } from "@/lib/programShapes";
import type { ProgramData } from "@/components/registrar/ProgramEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Program - Tools" };

export default async function NewProgramToolPage({ searchParams }: { searchParams: Promise<{ shape?: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await canUsePrograms(session.user.id, session.user.roles))) notFound();

  const { shape } = await searchParams;
  if (shape !== "blank" && !isShapeCode(shape)) {
    return (
      <div className="vol-page">
        <div className="vol-content">
          <div className="vol-header">
            <Link href="/tools/programs" className="vol-back">&larr; Programs</Link>
          </div>
          <h1 className="vol-header__title">What are you offering?</h1>
          <p className="pe-start__lead">Choose a shape to start from. Everything it fills in can be changed before you save.</p>
          <ul className="pe-shapes">
            {SHAPES.map((s) => (
              <li key={s.code}>
                <Link className="pe-shape" href={`/tools/programs/new?shape=${s.code}`}>
                  <span className="pe-shape__name">{s.name}</span>
                  <span className="pe-shape__sets">{s.sets}</span>
                  <span className="pe-shape__go" aria-hidden="true">Start &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="pe-start__blank">
            <Link href="/tools/programs/new?shape=blank">Start with a blank program &rarr;</Link>
          </p>
        </div>
      </div>
    );
  }

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
  const prepTeams = await helpingTeams();
  // The shape's starting settings, as the editor's first values (a new
  // program: nothing here is saved until Save).
  const start = isShapeCode(shape)
    ? (shapeStart(shape, { prepTeams, canDecideAskers: canUseRegistration(session.user.roles) }) as unknown as ProgramData)
    : undefined;

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href="/tools/programs/new" className="vol-back">&larr; What are you offering?</Link>
        </div>
        <ProgramEditor
          // A different shape is a different start.
          key={shape}
          basePath="/tools/programs"
          isEditing={false}
          initialData={start}
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
          prepTeams={prepTeams}
          canDecideAskers={canUseRegistration(session.user.roles)}
        />
      </div>
    </div>
  );
}
