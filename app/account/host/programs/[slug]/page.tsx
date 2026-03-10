/**
 * /account/host/programs/[slug] — Host Hub: Program Detail
 *
 * Entry point for all actions on a program:
 *   HOST: see own assignments, request sub, remove self
 *   HOST_MANAGER / ADMIN: see all assignments, assign hosts, remove hosts
 *
 * CSS prefix: hub-program-
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { hostProgramsQuery } from "@/lib/queries";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import HostProgramActions from "@/components/HostProgramActions";
import { buildDateLabel } from "@/lib/dateLabel";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface HostProgram {
  _id: string;
  name: string;
  slug: string;
  dateText?: string | null;
  startDatetime?: string | null;
  endDatetime?: string | null;
  recurrenceFreq?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDays?: string[] | null;
  zoomLink: string;
  meetHostAccount?: string | null;
}

export default async function HostProgramDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) redirect("/account/dashboard");

  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));

  const { slug } = await params;

  // Fetch program data from Sanity
  const programs = await sanityClient.fetch<HostProgram[]>(hostProgramsQuery);
  const prog = programs.find((p) => p.slug === slug);
  if (!prog) redirect("/account/host");

  const dateLabel = prog.dateText || buildDateLabel(prog);

  // Fetch assignments for this program
  const assignments = await db.hostAssignment.findMany({
    where: { programSlug: slug },
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
  });

  // For manager view: fetch all host users for the assign form
  let hostUsers: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
    email: string;
    roles: string[];
  }> = [];
  if (isManager) {
    hostUsers = await db.user.findMany({
      where: { roles: { hasSome: ["HOST", "HOST_MANAGER"] }, archivedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        email: true,
        roles: true,
      },
      orderBy: { firstName: "asc" },
    });
  }

  // Serialize assignments — never spread Prisma include results
  const serializedAssignments = assignments.map((a) => ({
    id: a.id,
    sessionDate: a.sessionDate?.toISOString() ?? null,
    notes: a.notes,
    userId: a.userId,
    userName:
      a.user.preferredName ||
      [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") ||
      a.user.email,
    isOwn: a.userId === session.user.id,
  }));

  const myAssignments = serializedAssignments.filter((a) => a.isOwn);

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav isManager={isManager} />

        <div className="hub-content">
          <Link href="/account/host" className="hub-back-link">
            ← Schedule
          </Link>

          <div className="hub-program-detail">
            {/* Header: name, date, join link */}
            <div className="hub-program-detail__header">
              <div>
                <h1 className="hub-program-detail__name">{prog.name}</h1>
                {dateLabel && (
                  <p className="hub-program-detail__date">{dateLabel}</p>
                )}
              </div>
              {prog.zoomLink && (
                <a
                  href={prog.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hub-schedule__join-link"
                >
                  Join on Google Meet →
                </a>
              )}
            </div>

            {/* Host account to sign in as */}
            {prog.meetHostAccount && (
              <div className="hub-program-detail__account">
                <span className="hub-program-detail__account-label">Sign in as</span>
                <span className="hub-program-detail__account-value">
                  {prog.meetHostAccount}
                </span>
              </div>
            )}

            {/* HOST view: own assignments + inline actions */}
            {!isManager && (
              <HostProgramActions
                assignments={myAssignments}
                hostUsers={[]}
                programSlug={slug}
                isManager={false}
              />
            )}

            {/* MANAGER view: all assignments + assign form */}
            {isManager && (
              <HostProgramActions
                assignments={serializedAssignments}
                hostUsers={hostUsers}
                programSlug={slug}
                isManager={true}
              />
            )}

            {/* How to host — shown to anyone with the HOST role */}
            {roles.includes("HOST") && (
              <div className="hub-how-to">
                <h2 className="hub-how-to__title">How to host</h2>
                <ol className="hub-steps">
                  <li>
                    Sign into the <strong>host account</strong> listed above. You can add it
                    as a secondary account in your browser — you don&rsquo;t need to log out
                    of your own account.
                  </li>
                  <li>
                    Click <strong>Join on Google Meet</strong> above. Join a few minutes
                    before the session starts.
                  </li>
                  <li>
                    You&rsquo;ll see a small <strong>blue shield</strong> in the bottom-right
                    corner — that means you have host controls (mute all, remove a
                    participant, end meeting for everyone).
                  </li>
                  <li>
                    When the session ends, click the red button and choose{" "}
                    <strong>End meeting for all</strong>. Then switch back to your personal
                    account.
                  </li>
                </ol>
                <p className="hub-how-to__note">
                  If you don&rsquo;t see the blue shield, any other volunteer in the meeting
                  with a <code>@rootedinmindfulness.org</code> account can grant you host
                  controls from the People panel.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
