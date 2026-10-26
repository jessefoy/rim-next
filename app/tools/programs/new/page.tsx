/**
 * /tools/programs/new — Create a new program.
 * Gate: canUsePrograms (also in tools/programs/layout.tsx).
 *
 * Without ?shape or ?copy: "What are you offering?" (2026-10-24, Phase 4
 * slices 4 and 5): the shapes from lib/programShapes.ts, a blank start, and
 * the programs to copy. With ?shape=<Format> the editor opens with that
 * shape's starting settings; ?shape=blank opens it empty; ?copy=<slug> opens
 * it as a copy of that program (lib/programCopy.ts), which Save creates.
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
import { EDITOR_PROGRAM_INCLUDE, programToEditorData } from "@/lib/programEditorData";
import { copyForNew, freeSlug } from "@/lib/programCopy";
import { formatLabel } from "@/lib/programOffering";

/** How many programs are listed to copy before the full menu. */
const RECENT = 6;

export const dynamic = "force-dynamic";
export const metadata = { title: "New Program - Tools" };

export default async function NewProgramToolPage({ searchParams }: { searchParams: Promise<{ shape?: string; copy?: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await canUsePrograms(session.user.id, session.user.roles))) notFound();

  const { shape, copy } = await searchParams;
  const canDecideAskers = canUseRegistration(session.user.roles);

  // The program to copy, as the editor opens it.
  let copied: { data: ProgramData; name: string } | null = null;
  if (copy) {
    const source = await db.program.findUnique({ where: { slug: copy }, include: EDITOR_PROGRAM_INCLUDE });
    if (source) {
      const [coverage, taken] = await Promise.all([
        db.programCoverageHub.findMany({ where: { programSlug: source.slug }, select: { hubSlug: true } }),
        db.program.findMany({ where: { slug: { startsWith: source.slug.replace(/-\d$/, "") } }, select: { slug: true } }),
      ]);
      copied = {
        name: source.name,
        data: copyForNew(programToEditorData(source, coverage.map((r) => r.hubSlug)), {
          slug: freeSlug(source.slug, new Set(taken.map((t) => t.slug))),
          canDecideAskers,
        }),
      };
    }
  }

  if (!copied && shape !== "blank" && !isShapeCode(shape)) {
    // Programs to copy: the most recent first.
    const programs = await db.program.findMany({
      where: { startDatetime: { not: null } },
      orderBy: { startDatetime: "desc" },
      select: { slug: true, name: true, startDatetime: true, offeringFormat: true, registrationCapacity: true, registrationFields: true, recurrenceFreq: true },
    });
    const month = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", year: "numeric" });
    const facts = (p: (typeof programs)[number]) => {
      const n = Array.isArray(p.registrationFields) ? p.registrationFields.length : 0;
      return [
        formatLabel(p.offeringFormat),
        p.startDatetime ? `${p.recurrenceFreq ? "from " : ""}${month(p.startDatetime)}` : null,
        p.registrationCapacity ? `${p.registrationCapacity} places` : null,
        n ? `${n} ${n === 1 ? "question" : "questions"}` : null,
      ].filter(Boolean).join(" · ");
    };
    return (
      <div className="vol-page">
        <div className="vol-content">
          <div className="vol-header">
            <Link href="/tools/programs" className="app-back">&larr; Programs</Link>
          </div>
          <h1 className="vol-header__title">What are you offering?</h1>
          {copy && <p className="pe-start__missing" role="status">That program wasn&rsquo;t found to copy. Choose another below.</p>}
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

          {programs.length > 0 && (
            <section className="pe-copy" aria-labelledby="pe-copy-title">
              <h2 id="pe-copy-title" className="pe-copy__title">Or copy a program</h2>
              <p className="pe-start__lead">
                A copy keeps the words, questions, teachers, helpers, dana and settings, and asks for the new dates. It never copies the people registered.
              </p>
              <ul className="pe-shapes">
                {programs.slice(0, RECENT).map((p) => (
                  <li key={p.slug}>
                    <Link className="pe-shape pe-shape--copy" href={`/tools/programs/new?copy=${encodeURIComponent(p.slug)}`}>
                      <span className="pe-shape__name">{p.name}</span>
                      <span className="pe-shape__sets">{facts(p)}</span>
                      <span className="pe-shape__go" aria-hidden="true">Copy &rarr;</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {programs.length > RECENT && (
                <form className="pe-copy__pick" method="get" action="/tools/programs/new">
                  <label className="pe-field">
                    <span className="pe-field__label">Another program</span>
                    <select className="pe-select" name="copy" defaultValue="" required>
                      <option value="" disabled>Choose a program</option>
                      {programs.slice(RECENT).map((p) => (
                        <option key={p.slug} value={p.slug}>{`${p.name} (${facts(p)})`}</option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="app-act">Copy</button>
                </form>
              )}
            </section>
          )}
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
  // A copy keeps only the teams that may still prepare.
  if (copied) copied.data.helperTeams = (copied.data.helperTeams ?? []).filter((h) => prepTeams.some((t) => t.id === h.hubId));
  // The shape's starting settings, as the editor's first values (a new
  // program: nothing here is saved until Save).
  const start = copied
    ? copied.data
    : isShapeCode(shape)
      ? (shapeStart(shape, { prepTeams, canDecideAskers }) as unknown as ProgramData)
      : undefined;

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href="/tools/programs/new" className="app-back">&larr; What are you offering?</Link>
        </div>
        <ProgramEditor
          // A different shape or copy is a different start.
          key={copy ? `copy:${copy}` : shape}
          basePath="/tools/programs"
          isEditing={false}
          initialData={start}
          copiedFrom={copied?.name}
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
          canDecideAskers={canDecideAskers}
        />
      </div>
    </div>
  );
}
