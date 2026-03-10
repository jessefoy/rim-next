/**
 * /account/host/subs — Host Hub: Sub Board
 *
 * Shows open sub requests; allows claiming and posting new requests.
 * Access: HOST, HOST_MANAGER, ADMIN
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { allVirtualProgramsQuery } from "@/lib/queries";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import SubBoard from "@/components/SubBoard";

export const metadata = { title: "Sub Board — Host Hub" };
export const dynamic = "force-dynamic";

interface SanityProgram {
  _id: string;
  name: string;
  slug: string;
}

export default async function SubsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) redirect("/account/dashboard");

  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));

  // Parallel fetch: open requests + Sanity program names
  const [requests, sanityPrograms] = await Promise.all([
    db.subRequest.findMany({
      where: { status: "OPEN" },
      include: {
        assignment: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
          },
        },
        claim: {
          include: {
            claimedBy: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    sanityClient.fetch<SanityProgram[]>(allVirtualProgramsQuery),
  ]);

  const programBySlug = new Map(sanityPrograms.map((p) => [p.slug, p]));

  // Serialize requests for client component
  const serializedRequests = requests.map((r) => ({
    id: r.id,
    programSlug: r.programSlug,
    programName: programBySlug.get(r.programSlug)?.name ?? r.programSlug,
    sessionDate: r.sessionDate?.toISOString() ?? null,
    status: r.status,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    requester: r.assignment.user,
    assignmentId: r.assignmentId,
    claim: r.claim
      ? {
          id: r.claim.id,
          message: r.claim.message,
          createdAt: r.claim.createdAt.toISOString(),
          claimedBy: r.claim.claimedBy,
        }
      : null,
  }));

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav isManager={isManager} />
        <div className="hub-content">
          <SubBoard
            initialRequests={serializedRequests}
            currentUserId={session.user.id}
          />
        </div>
      </div>
    </AccountLayout>
  );
}
