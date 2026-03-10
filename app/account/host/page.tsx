/**
 * /account/host — Host Hub: Schedule tab
 *
 * Program-card view. Each card links to /account/host/programs/[slug]
 * where all actions live (request sub, remove self, assign hosts).
 *
 * HOST: sees own program cards
 * HOST_MANAGER / ADMIN: sees all programs with assignments + host count
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

  // Group assignments by program slug (preserving order of first appearance)
  const slugsSeen = new Set<string>();
  const programSlugs = assignments
    .map((a) => a.programSlug)
    .filter((s) => {
      if (slugsSeen.has(s)) return false;
      slugsSeen.add(s);
      return true;
    });

  interface ProgramCard {
    slug: string;
    name: string;
    dateLabel: string | null;
    hostCount: number;
    hasStanding: boolean;
    hosts: string[]; // for manager view
    isOwn: boolean;
  }

  const programCards: ProgramCard[] = programSlugs.map((slug) => {
    const prog = programBySlug.get(slug);
    const group = assignments.filter((a) => a.programSlug === slug);
    const myGroup = group.filter((a) => a.userId === session.user.id);
    return {
      slug,
      name: prog?.name ?? slug,
      dateLabel: prog ? (prog.dateText || buildDateLabel(prog)) : null,
      hostCount: group.length,
      hasStanding: group.some((a) => !a.sessionDate),
      hosts: group.map(
        (a) =>
          a.user.preferredName ||
          [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") ||
          "Unknown"
      ),
      isOwn: myGroup.length > 0,
    };
  });

  const myCards = isManager ? programCards : programCards.filter((c) => c.isOwn);

  return (
    <AccountLayout>
      <div className="hub-page">
        <HubTabNav isManager={isManager} />

        <div className="hub-content">
          <p className="hub-intro">
            This is your host team workspace — your schedule, sub coverage, and team threads all in one place.
          </p>
          <div className="hub-section-header">
            <h1 className="hub-page__title">
              {isManager ? "Host Schedule" : "My Schedule"}
            </h1>
            {isManager && (
              <Link href="/account/host/manage" className="hub-btn hub-btn--sm hub-btn--outline">
                Manage →
              </Link>
            )}
          </div>

          {myCards.length === 0 ? (
            <p className="hub-empty">
              {isManager
                ? "No hosts assigned yet. Use the Manage tab to set up your rotation."
                : "You're not assigned to any programs yet. Your host manager will set that up — check back once assignments are live."}
            </p>
          ) : (
            <div className="hub-program-cards">
              {myCards.map((card) => (
                <Link
                  key={card.slug}
                  href={`/account/host/programs/${card.slug}`}
                  className="hub-program-card"
                >
                  <div className="hub-program-card__main">
                    <p className="hub-program-card__name">{card.name}</p>
                    {card.dateLabel && (
                      <p className="hub-program-card__meta">{card.dateLabel}</p>
                    )}
                    {isManager && (
                      <p className="hub-program-card__meta">
                        {card.hostCount} host{card.hostCount !== 1 ? "s" : ""}
                        {card.hasStanding ? " · standing" : ""}
                      </p>
                    )}
                  </div>
                  <span className="hub-program-card__arrow">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
