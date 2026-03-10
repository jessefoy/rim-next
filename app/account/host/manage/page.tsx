/**
 * /account/host/manage — Host Hub: Assignment Management
 *
 * HOST_MANAGER / ADMIN only.
 * Seed upcoming sessions + assign hosts to virtual programs.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { allVirtualProgramsQuery } from "@/lib/queries";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import HubManageClient from "@/components/HubManageClient";

export const metadata = { title: "Manage — Host Hub" };
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

  // Parallel fetch: Sanity programs + all assignments + all hub users
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
        subRequests: {
          where: { status: "OPEN" },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ sessionDate: "asc" }, { createdAt: "asc" }],
    }),
    db.user.findMany({
      where: {
        roles: { hasSome: ["HOST", "HOST_MANAGER", "ADMIN"] },
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

  // Serialize assignments — userId may be null (unclaimed session)
  const serializedAssignments = assignments.map((a) => {
    const openSub = a.subRequests[0] ?? null;
    const status: "unclaimed" | "claimed" | "sub_needed" = !a.userId
      ? "unclaimed"
      : openSub
        ? "sub_needed"
        : "claimed";

    return {
      id: a.id,
      programSlug: a.programSlug,
      programName: programBySlug.get(a.programSlug)?.name ?? a.programSlug,
      sessionDate: a.sessionDate?.toISOString() ?? null,
      notes: a.notes,
      status,
      hostUserId: a.userId ?? null,
      hostName: a.user
        ? (a.user.preferredName ||
            [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") ||
            a.user.email)
        : null,
      createdAt: a.createdAt.toISOString(),
    };
  });

  // Serialize host users
  const serializedHostUsers = hostUsers.map((u) => ({
    id: u.id,
    displayName:
      u.preferredName ||
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      u.email,
    email: u.email,
    roles: u.roles as string[],
  }));

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav isManager={true} />
        <div className="hub-content">
          <div className="hub-section-header">
            <h1 className="hub-page__title">Manage Schedule</h1>
          </div>
          <HubManageClient
            programs={programs}
            hostUsers={serializedHostUsers}
            initialAssignments={serializedAssignments}
          />
        </div>
      </div>
    </AccountLayout>
  );
}
