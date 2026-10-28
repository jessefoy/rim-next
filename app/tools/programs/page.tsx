/**
 * /tools/programs — Program Manager (full registrar view).
 * Gate: canUsePrograms (also in tools/programs/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { canUseProgramManager, canUsePrograms, canUseRegistration } from "@/lib/toolAuth";
import { db } from "@/lib/db";
import { resolveOffering } from "@/lib/programOffering";
import { registrationWindow } from "@/lib/registrationWindow";
import { fmtDay } from "@/lib/registrationDesk";
import { inListingOrder } from "@/lib/programOrder";
import Link from "next/link";
import ProgramsTableClient, {
  type ProgramRow,
} from "@/components/registrar/ProgramsTableClient";


export const metadata = { title: "Program Manager - Tools" };
export const dynamic = "force-dynamic";

export default async function ProgramsToolPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // The layout's gate, repeated: Next.js can render a page without re-running
  // its layout, so the layout alone doesn't protect this data (2026-10-19 audit).
  if (!(await canUsePrograms(session.user.id, session.user.roles))) notFound();

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  // Programs shows no one's details (2026-10-24): counts of people and dana
  // only for those who can open Registration; archiving for the three roles.
  const canSeePeople = canUseRegistration(roles);
  const canArchive = canUseProgramManager(roles);

  const pgPrograms = await db.program.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      programFormat: true,
      registrationEnabled: true,
      registrationClosed: true,
      registrationDeadline: true,
      registrationOpensAt: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
      recurrenceUntil: true,
      listFirst: true,
      registrationCapacity: true,
      archivedAt: true,
      offeringCategory: true,
      offeringFormat: true,
      // The old category, for the offering's fallback while its own fields are empty.
      category: { select: { slug: true, kind: true } },
    },
  });

  const [counts, pendingDanaRows] = await Promise.all([
    db.registration.groupBy({
      by: ["programId", "status"],
      _count: { _all: true },
    }),
    db.registration.groupBy({
      by: ["programId"],
      // Held (PENDING_PAYMENT) rows also carry donationStatus PENDING but aren't
      // real registrations — exclude them so the pending-dana count is accurate.
      where: { donationStatus: "PENDING", status: { not: "PENDING_PAYMENT" } },
      _count: { _all: true },
    }),
  ]);

  const pendingDanaByProgram = Object.fromEntries(
    pendingDanaRows.map((r) => [r.programId, r._count._all])
  );

  const programRows: ProgramRow[] = inListingOrder(pgPrograms).map((p) => {
    const rows = counts.filter((c) => c.programId === p.id);
    const byStatus = Object.fromEntries(rows.map((c) => [c.status, c._count._all]));
    const confirmedCount = (byStatus.REGISTERED ?? 0) + (byStatus.APPROVED ?? 0);
    const waitlistedCount = byStatus.WAITLISTED ?? 0;
    const pendingDanaCount = pendingDanaByProgram[p.id] ?? 0;
    const spotOpened = !!p.registrationCapacity
      && confirmedCount < p.registrationCapacity
      && waitlistedCount > 0;
    const needsAttention = waitlistedCount > 0 || pendingDanaCount > 0 || spotOpened;

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      programFormat: p.programFormat,
      registrationEnabled: p.registrationEnabled,
      registrationClosed: p.registrationClosed,
      // One rule for open, closed and not open yet (lib/registrationWindow.ts).
      regWindow: registrationWindow(p),
      opensOn: p.registrationOpensAt ? fmtDay(p.registrationOpensAt) : null,
      registrationCapacity: p.registrationCapacity,
      archivedAt: p.archivedAt?.toISOString() ?? null,
      offeringCategory: resolveOffering(p).category,
      offeringFormat: resolveOffering(p).format,
      // Never sent to someone who can't open Registration.
      confirmedCount: canSeePeople ? confirmedCount : 0,
      waitlistedCount: canSeePeople ? waitlistedCount : 0,
      pendingDanaCount: canSeePeople ? pendingDanaCount : 0,
      spotOpened: canSeePeople && spotOpened,
      needsAttention: canSeePeople && needsAttention,
    };
  });

  // Programs being set up (2026-10-28): drafts, not yet programs.
  const drafts = await db.programDraft.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, data: true } });

  return (
    <div className="vol-page">
      <div className="vol-content">
        <header className="vol-header">
          <h1 className="vol-header__title">Programs</h1>
          <p className="vol-header__sub">Every program, with its category, format, delivery and registration.</p>
          <p className="vol-header__sub"><Link className="app-act" href="/tools/programs/order">How each section of Programs &amp; Events is ordered</Link></p>
        </header>
        {drafts.length > 0 && (
          <section className="psu-drafts" aria-labelledby="psu-drafts-title">
            <h2 id="psu-drafts-title" className="psu-drafts__title">Being set up</h2>
            <ul className="psu-drafts__list">
              {drafts.map((d) => (
                <li key={d.id}>
                  <span>{(d.data as { name?: string }).name?.trim() || "A new program"}</span>
                  <Link className="app-act" href={`/tools/programs/drafts/${d.id}`}>Continue setting it up</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <ProgramsTableClient
          programs={programRows}
          basePath="/tools/programs"
          canSeePeople={canSeePeople}
          canArchive={canArchive}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
