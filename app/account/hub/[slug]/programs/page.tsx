/**
 * /account/hub/registrar/programs — Program list with registration counts.
 *
 * Full view (REGISTRAR | ADMIN): table with all columns, actions, filter pills.
 * Stakeholder view (other hub members): same table, no actions/flags/registration column.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import ProgramsTableClient, {
  type ProgramRow,
} from "@/components/registrar/ProgramsTableClient";

export const dynamic = "force-dynamic";

export default async function RegistrarProgramsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  // Update lastVisitedAt
  if (member) {
    await db.hubMember.update({
      where: { id: member.id },
      data: { lastVisitedAt: new Date() },
    });
  }

  const roles = session.user.roles ?? [];
  const isRegistrar = roles.includes("REGISTRAR") || roles.includes("ADMIN");

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

  // Get registration counts grouped by program + status, and pending dana counts — in parallel
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

  const base = `/account/hub/${slug}`;

  return (
    <div className="vol-page">
      <div className="vol-content">
        <ProgramsTableClient
          programs={programRows}
          hubBase={base}
          isRegistrar={isRegistrar}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
