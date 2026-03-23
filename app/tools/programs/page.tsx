/**
 * /tools/programs — Program Manager (full registrar view).
 * Role gate: REGISTRAR | ADMIN (handled by tools/programs/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import ProgramsTableClient, {
  type ProgramRow,
} from "@/components/registrar/ProgramsTableClient";
import ManualHelpIcon from "@/components/ManualHelpIcon";

export const metadata = { title: "Program Manager — Tools" };
export const dynamic = "force-dynamic";

export default async function ProgramsToolPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isRegistrar = roles.includes("REGISTRAR") || isAdmin;

  const pgPrograms = await db.program.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      programFormat: true,
      registrationEnabled: true,
      registrationClosed: true,
      registrationCapacity: true,
      archivedAt: true,
    },
  });

  const [counts, pendingDanaRows] = await Promise.all([
    db.registration.groupBy({
      by: ["programId", "status"],
      _count: { _all: true },
    }),
    db.registration.groupBy({
      by: ["programId"],
      where: { donationStatus: "PENDING" },
      _count: { _all: true },
    }),
  ]);

  const pendingDanaByProgram = Object.fromEntries(
    pendingDanaRows.map((r) => [r.programId, r._count._all])
  );

  const programRows: ProgramRow[] = pgPrograms.map((p) => {
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
      registrationCapacity: p.registrationCapacity,
      archivedAt: p.archivedAt?.toISOString() ?? null,
      confirmedCount,
      waitlistedCount,
      pendingDanaCount,
      spotOpened,
      needsAttention,
    };
  });

  return (
    <div className="vol-page">
      <div className="vol-content" style={{ position: "relative" }}>
        <ManualHelpIcon manualSlug="registration" />
        <ProgramsTableClient
          programs={programRows}
          basePath="/tools/programs"
          isRegistrar={isRegistrar}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
