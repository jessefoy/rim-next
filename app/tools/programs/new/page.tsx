/**
 * /tools/programs/new — "What are you offering?" (2026-10-24, Phase 4 slices
 * 4 and 5; since 2026-10-28 the start of the step-by-step setup): the shapes
 * from lib/programShapes.ts, a blank start, and the programs to copy. Each is
 * a button that makes a draft (./actions.ts) and opens the walk-through on it
 * (/tools/programs/drafts/[id]); the drafts already started are listed first.
 * Gate: canUsePrograms (also in tools/programs/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { canUsePrograms } from "@/lib/toolAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import { SHAPES } from "@/lib/programShapes";
import { formatLabel } from "@/lib/programOffering";
import { startDraft } from "./actions";

/** How many programs are listed to copy before the full menu. */
const RECENT = 6;

export const dynamic = "force-dynamic";
export const metadata = { title: "New Program - Tools" };

export default async function NewProgramToolPage({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await canUsePrograms(session.user.id, session.user.roles))) notFound();

  const { missing } = await searchParams;
  const [programs, drafts] = await Promise.all([
    db.program.findMany({
      where: { startDatetime: { not: null } },
      orderBy: { startDatetime: "desc" },
      select: { slug: true, name: true, startDatetime: true, offeringFormat: true, registrationCapacity: true, registrationFields: true, recurrenceFreq: true },
    }),
    db.programDraft.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, data: true, updatedAt: true } }),
  ]);
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
  const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href="/tools/programs" className="app-back">&larr; Programs</Link>
        </div>
        <h1 className="vol-header__title">What are you offering?</h1>
        {missing !== undefined && <p className="pe-start__missing" role="status">That program wasn&rsquo;t found to copy. Choose another below.</p>}

        {drafts.length > 0 && (
          <section className="pe-copy" aria-labelledby="pe-drafts-title">
            <h2 id="pe-drafts-title" className="pe-copy__title">Being set up</h2>
            <p className="pe-start__lead">Drafts, saved as they were left. No one sees them until they&rsquo;re published.</p>
            <ul className="pe-shapes">
              {drafts.map((d) => {
                const name = (d.data as { name?: string }).name?.trim() || "A new program";
                return (
                  <li key={d.id}>
                    <Link className="pe-shape pe-shape--copy" href={`/tools/programs/drafts/${d.id}`}>
                      <span className="pe-shape__name">{name}</span>
                      <span className="pe-shape__sets">Last changed {day(d.updatedAt)}</span>
                      <span className="pe-shape__go" aria-hidden="true">Continue &rarr;</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="pe-start__lead">Choose a shape to start from. It fills in answers, and you&rsquo;ll still see each one as you go. Nothing is published until you say so.</p>
        <ul className="pe-shapes">
          {SHAPES.map((s) => (
            <li key={s.code}>
              <form action={startDraft}>
                <input type="hidden" name="shape" value={s.code} />
                <button type="submit" className="pe-shape">
                  <span className="pe-shape__name">{s.name}</span>
                  <span className="pe-shape__sets">{s.sets}</span>
                  <span className="pe-shape__go" aria-hidden="true">Start &rarr;</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={startDraft} className="pe-start__blank">
          <input type="hidden" name="shape" value="blank" />
          <button type="submit" className="app-act">Start with a blank program &rarr;</button>
        </form>

        {programs.length > 0 && (
          <section className="pe-copy" aria-labelledby="pe-copy-title">
            <h2 id="pe-copy-title" className="pe-copy__title">Or copy a program</h2>
            <p className="pe-start__lead">
              A copy keeps the words, questions, teachers, helpers, dana and settings, and asks for the new dates. It never copies the people registered.
            </p>
            <ul className="pe-shapes">
              {programs.slice(0, RECENT).map((p) => (
                <li key={p.slug}>
                  <form action={startDraft}>
                    <input type="hidden" name="copy" value={p.slug} />
                    <button type="submit" className="pe-shape pe-shape--copy">
                      <span className="pe-shape__name">{p.name}</span>
                      <span className="pe-shape__sets">{facts(p)}</span>
                      <span className="pe-shape__go" aria-hidden="true">Copy &rarr;</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            {programs.length > RECENT && (
              <form className="pe-copy__pick" action={startDraft}>
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
