/**
 * /account/host/manage — Host Hub: Assignment Management
 *
 * HOST_MANAGER / ADMIN only.
 * Assign and remove hosts for virtual programs.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { allVirtualProgramsQuery } from "@/lib/queries";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import AssignmentManager from "@/components/AssignmentManager";

export const metadata = { title: "Manage Schedule — Host Hub" };
export const dynamic = "force-dynamic";

interface SanityProgram {
  _id: string;
  name: string;
  slug: string;
}

export default async function ManagePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
  if (!isManager) redirect("/account/host");

  // Parallel fetch: Sanity programs + all assignments + all HOST/HOST_MANAGER users
  const [sanityPrograms, assignments, hostUsers] = await Promise.all([
    sanityClient.fetch<SanityProgram[]>(allVirtualProgramsQuery),
    db.hostAssignment.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({
      where: {
        roles: { hasSome: ["HOST", "HOST_MANAGER"] },
        archivedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        email: true,
        roles: true,
      },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const programBySlug = new Map(sanityPrograms.map((p) => [p.slug, p]));

  const programs = sanityPrograms.map((p) => ({ slug: p.slug, name: p.name }));

  // Serialize assignments
  const serializedAssignments = assignments.map((a) => ({
    id: a.id,
    programSlug: a.programSlug,
    programName: programBySlug.get(a.programSlug)?.name ?? a.programSlug,
    sessionDate: a.sessionDate?.toISOString() ?? null,
    notes: a.notes,
    user: a.user,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav isManager={true} />
        <div className="hub-content">
          <div className="hub-section-header">
            <h1 className="hub-page__title">Manage Host Schedule</h1>
            <p className="hub-page__subtitle">
              Assign volunteer hosts to virtual programs. Changes take effect immediately.
            </p>
          </div>
          <AssignmentManager
            programs={programs}
            hostUsers={hostUsers}
            initialAssignments={serializedAssignments}
          />
        </div>
      </div>
    </AccountLayout>
  );
}
