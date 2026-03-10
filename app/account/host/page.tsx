/**
 * /account/host — Host Hub: Schedule tab
 *
 * HOST: sees own assignments + program join info
 * HOST_MANAGER / ADMIN: sees all assignments summary + manage link
 *
 * CSS prefix: hub-
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { hostProgramsQuery } from "@/lib/queries";
import AccountLayout from "@/components/AccountLayout";
import HubTabNav from "@/components/HubTabNav";
import { buildDateLabel } from "@/lib/dateLabel";
import Link from "next/link";

export const metadata = { title: "My Schedule — Host Hub" };
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

export default async function HostSchedulePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) redirect("/account/dashboard");

  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));

  // Fetch assignments
  const assignments = await db.hostAssignment.findMany({
    where: isManager ? {} : { userId: session.user.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch program info from Sanity
  const programs = await sanityClient.fetch<HostProgram[]>(hostProgramsQuery);
  const programBySlug = new Map(programs.map((p) => [p.slug, p]));

  // Serialize for RSC boundary
  const serializedAssignments = assignments.map((a) => {
    const prog = programBySlug.get(a.programSlug);
    return {
      id: a.id,
      programSlug: a.programSlug,
      programName: prog?.name ?? a.programSlug,
      sessionDate: a.sessionDate?.toISOString() ?? null,
      notes: a.notes,
      zoomLink: prog?.zoomLink ?? null,
      meetHostAccount: prog?.meetHostAccount ?? null,
      dateLabel: prog ? (prog.dateText || buildDateLabel(prog)) : null,
      userId: a.userId,
      userName: a.user.preferredName || [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || "Unknown",
      isOwn: a.userId === session.user.id,
    };
  });

  const myAssignments = serializedAssignments.filter((a) => a.isOwn);

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav isManager={isManager} />

        <div className="hub-content">
          <div className="hub-section-header">
            <h1 className="hub-page__title">
              {isManager ? "All Host Assignments" : "My Schedule"}
            </h1>
            {isManager && (
              <Link href="/account/host/manage" className="hub-btn hub-btn--sm hub-btn--outline">
                Manage →
              </Link>
            )}
          </div>

          {serializedAssignments.length === 0 ? (
            <p className="hub-empty">
              {isManager
                ? "No assignments yet. Use the Manage tab to assign hosts."
                : "You have no current assignments. A HOST_MANAGER will assign you to programs."}
            </p>
          ) : (
            <div className="hub-schedule">
              {isManager ? (
                // Manager view: grouped by program
                (() => {
                  const slugsSeen = new Set<string>();
                  const slugOrder = serializedAssignments
                    .map((a) => a.programSlug)
                    .filter((s) => { if (slugsSeen.has(s)) return false; slugsSeen.add(s); return true; });

                  return slugOrder.map((slug) => {
                    const group = serializedAssignments.filter((a) => a.programSlug === slug);
                    const prog = programBySlug.get(slug);
                    const dateLabel = prog ? (prog.dateText || buildDateLabel(prog)) : null;
                    return (
                      <div key={slug} className="hub-schedule__program">
                        <div className="hub-schedule__prog-header">
                          <p className="hub-schedule__prog-name">{group[0].programName}</p>
                          {dateLabel && <p className="hub-schedule__prog-date">{dateLabel}</p>}
                        </div>
                        {group.map((a) => (
                          <div key={a.id} className="hub-schedule__assignment">
                            <span className="hub-schedule__host-name">{a.userName}</span>
                            {a.sessionDate && (
                              <span className="hub-schedule__session-date">
                                {new Date(a.sessionDate).toLocaleDateString("en-US", {
                                  month: "short", day: "numeric", year: "numeric",
                                })}
                              </span>
                            )}
                            {!a.sessionDate && (
                              <span className="hub-schedule__standing">Standing</span>
                            )}
                            {a.notes && <span className="hub-schedule__notes">{a.notes}</span>}
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()
              ) : (
                // HOST view: their own assignments as program cards
                myAssignments.map((a) => (
                  <div key={a.id} className="hub-schedule__card">
                    <div className="hub-schedule__card-name">{a.programName}</div>
                    {a.dateLabel && (
                      <div className="hub-schedule__card-date">{a.dateLabel}</div>
                    )}
                    {a.sessionDate && (
                      <div className="hub-schedule__card-date">
                        Your session:{" "}
                        {new Date(a.sessionDate).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric",
                        })}
                      </div>
                    )}
                    {a.meetHostAccount && (
                      <div className="hub-schedule__card-account">
                        <span className="hub-schedule__card-account-label">Sign in as</span>
                        <span className="hub-schedule__card-account-value">{a.meetHostAccount}</span>
                      </div>
                    )}
                    {a.zoomLink && (
                      <a
                        href={a.zoomLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hub-schedule__join-link"
                      >
                        Join on Google Meet →
                      </a>
                    )}
                    {a.notes && <p className="hub-schedule__card-notes">{a.notes}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* How to host — only for non-managers (or if they have HOST role) */}
          {roles.includes("HOST") && (
            <div className="hub-how-to">
              <h2 className="hub-how-to__title">How to host</h2>
              <ol className="hub-steps">
                <li>Sign into the <strong>host account</strong> listed for your program. You can add it as a secondary account in your browser — you don&rsquo;t need to log out of your own account.</li>
                <li>Click <strong>Join on Google Meet</strong> for your program. Join a few minutes before the session starts.</li>
                <li>You&rsquo;ll see a small <strong>blue shield</strong> in the bottom-right corner — that means you have host controls (mute all, remove a participant, end meeting for everyone).</li>
                <li>When the session ends, click the red button and choose <strong>End meeting for all</strong>. Then switch back to your personal account.</li>
              </ol>
              <p className="hub-how-to__note">
                If you don&rsquo;t see the blue shield, any other volunteer in the meeting with a <code>@rootedinmindfulness.org</code> account can grant you host controls from the People panel.
              </p>
            </div>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
