/**
 * /account/host/schedule — Host Hub: Schedule
 *
 * Calendar + list view of all sessions.
 * Month navigation, session detail panel, multi-select claiming.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { hostProgramsQuery } from "@/lib/queries";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import HubScheduleClient from "@/components/HubScheduleClient";

export const metadata = { title: "Schedule — Host Hub" };
export const dynamic = "force-dynamic";

interface HostProgram {
  _id: string;
  name: string;
  slug: string;
  zoomLink: string;
  meetHostAccount?: string | null;
}

export default async function HostSchedulePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) redirect("/account/dashboard");

  // Current month for initial load
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [assignments, programs] = await Promise.all([
    db.hostAssignment.findMany({
      where: { sessionDate: { gte: startOfMonth, lte: endOfMonth } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        subRequests: { where: { status: "OPEN" }, select: { id: true, message: true }, take: 1 },
      },
      orderBy: { sessionDate: "asc" },
    }),
    sanityClient.fetch<HostProgram[]>(hostProgramsQuery),
  ]);

  const programBySlug = new Map(programs.map((p) => [p.slug, p]));

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

  // Serialize programs for client (static reference)
  const serializedPrograms = programs.map((p) => ({
    slug: p.slug,
    name: p.name,
    zoomLink: p.zoomLink ?? null,
    meetHostAccount: p.meetHostAccount ?? null,
  }));

  return (
    <AccountLayout>
      <div className="hub-page hub-page--wide">
        <HubTabNav />
        <div className="hub-content hub-content--wide">
          <HubScheduleClient
            initialSessions={sessions}
            programs={serializedPrograms}
            initialYear={year}
            initialMonth={month}
            currentUserId={session.user.id}
            currentUserName={session.user.name || session.user.email?.split("@")[0] || ""}
          />
        </div>
      </div>
    </AccountLayout>
  );
}
