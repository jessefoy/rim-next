/**
 * /account/host — Host Hub: Home
 *
 * Personal dashboard for the current user:
 *   - Coordinator urgent alert banner (HOST_MANAGER / ADMIN)
 *   - All-clear state
 *   - Your Sessions This Month
 *   - Open Sub Requests
 *   - Sessions Needing a Host
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { hostProgramsQuery } from "@/lib/queries";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import HubHomeClient from "@/components/HubHomeClient";

export const metadata = { title: "Home — Host Hub" };
export const dynamic = "force-dynamic";

interface HostProgram {
  _id: string;
  name: string;
  slug: string;
  zoomLink: string;
  meetHostAccount?: string | null;
}

export default async function HostHomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) redirect("/account/dashboard");

  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));

  // Current month range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Fetch this month's sessions + Sanity program info in parallel
  const [assignments, programs] = await Promise.all([
    db.hostAssignment.findMany({
      where: {
        sessionDate: { gte: startOfMonth, lte: endOfMonth },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        subRequests: { where: { status: "OPEN" }, select: { id: true, message: true }, take: 1 },
      },
      orderBy: { sessionDate: "asc" },
    }),
    sanityClient.fetch<HostProgram[]>(hostProgramsQuery),
  ]);

  const programBySlug = new Map(programs.map((p) => [p.slug, p]));

  // Serialize sessions with derived status
  const sessions = assignments.map((a) => {
    const openSub = a.subRequests[0] ?? null;
    const status: "unclaimed" | "claimed" | "sub_needed" = !a.userId
      ? "unclaimed"
      : openSub
        ? "sub_needed"
        : "claimed";

    const prog = programBySlug.get(a.programSlug);

    return {
      id: a.id,
      programSlug: a.programSlug,
      programName: prog?.name ?? a.programSlug,
      sessionDate: a.sessionDate?.toISOString() ?? null,
      status,
      hostUserId: a.userId ?? null,
      hostName: a.user
        ? (a.user.preferredName ||
            [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") ||
            null)
        : null,
      subRequestId: openSub?.id ?? null,
      subMessage: openSub?.message ?? null,
      zoomLink: prog?.zoomLink ?? null,
      meetHostAccount: prog?.meetHostAccount ?? null,
    };
  });

  // Coordinator urgent alerts: unclaimed or sub_needed within 3 days (manager only)
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const urgentAlerts = isManager
    ? sessions.filter(
        (s) =>
          (s.status === "unclaimed" || s.status === "sub_needed") &&
          s.sessionDate &&
          new Date(s.sessionDate) <= threeDaysFromNow
      )
    : [];

  const firstName = session.user.name || session.user.email?.split("@")[0] || "there";

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav />
        <div className="hub-content">
          <HubHomeClient
            firstName={firstName}
            sessions={sessions}
            currentUserId={session.user.id}
            isManager={isManager}
            urgentAlerts={urgentAlerts}
          />
        </div>
      </div>
    </AccountLayout>
  );
}
