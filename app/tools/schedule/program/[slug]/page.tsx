/**
 * /tools/schedule/program/[slug] — cross-hub program staffing view.
 *
 * One program. Every hub that covers it (primary `hostingHubSlug` plus every
 * `ProgramCoverageHub` row). For each day the program runs, surface the
 * rotation pattern in each hub side-by-side. Read-only — each hub column
 * deep-links to its own editing surface: single-slot hubs to the Rotations
 * tab (`?hub=<slug>&view=rotations`), multi-claim hubs to the schedule.
 *
 * Session 130 follow-up: a coordinator planning a week wants to see one
 * program's whole staffing picture (host, AV, greeter) at once, not switch
 * tabs between hub views. This page surfaces that.
 *
 * Access: gated by the parent layout (HOST / HOST_MANAGER / ADMIN /
 * individual UserToolAccess grant).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  DEFAULT_HOSTING_HUB_SLUG,
  getProgramCoverageHubs,
} from "@/lib/programHub";
import {
  ctDateStr,
  isOccurrenceOnDate,
  shiftToDate,
  type ScheduleProgram,
} from "@/lib/scheduleUtils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Program staffing — Scheduler" };

const TZ = "America/Chicago";

const DAY_ORDER = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
type DayCode = (typeof DAY_ORDER)[number];
const DAY_LABEL: Record<DayCode, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

const OCCURRENCE_LABEL: Record<string, string> = {
  FIRST: "1st",
  SECOND: "2nd",
  THIRD: "3rd",
  FOURTH: "4th",
  FIFTH: "5th",
  LAST: "last",
  ALL: "every",
};

function formatPattern(occurrences: string[]): string {
  if (occurrences.length === 0) return "—";
  if (occurrences.includes("ALL")) return "every";
  // Group neighboring numerics for a readable summary
  const numerics = occurrences.filter((o) => ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"].includes(o));
  const others = occurrences.filter((o) => o === "LAST");
  const numericLabels = numerics.map((o) => OCCURRENCE_LABEL[o]);
  if (others.length > 0) numericLabels.push("last");
  if (numericLabels.length === 1) return numericLabels[0];
  return numericLabels.slice(0, -1).join(", ") + " & " + numericLabels[numericLabels.length - 1];
}

export default async function ProgramStaffingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ hub?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { slug } = await params;
  // Preserve hub context across the staffing page so the "Back to Scheduler"
  // link returns to the same hub view the user came from. Session 130
  // follow-up — links in non-host hubs were collapsing to host-team.
  const { hub: fromHubSlug } = await searchParams;
  const backUrl =
    fromHubSlug && fromHubSlug !== "host-team"
      ? `/tools/schedule?hub=${encodeURIComponent(fromHubSlug)}`
      : "/tools/schedule";

  // Load the program plus the data we need to render every hub's coverage.
  const program = await db.program.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      programFormat: true,
      hostingHubSlug: true,
      recurrenceDays: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceCount: true,
      startDatetime: true,
      endDatetime: true,
      archivedAt: true,
    },
  });
  if (!program || program.archivedAt) notFound();

  const primaryHubSlug = program.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG;
  const auxHubSlugs = await getProgramCoverageHubs(program.slug);
  // Order: primary first, then auxiliary in slug order for stability.
  const allHubSlugs = [primaryHubSlug, ...auxHubSlugs.filter((s) => s !== primaryHubSlug).sort()];

  // Fetch every hub's config + StandingAssignment rows + upcoming HostAssignment
  // counts in one batched load. The StandingAssignment include pulls every
  // user name we need to render this view — reviewer flagged a redundant
  // db.user.findMany in the first pass; dropped.
  const [hubs, allRules, upcomingAssns] = await Promise.all([
    db.hub.findMany({
      where: { slug: { in: allHubSlugs } },
      select: {
        slug: true,
        name: true,
        type: true,
        allowsMultipleAssignments: true,
        appliesToFormats: true,
      },
    }),
    db.standingAssignment.findMany({
      where: { programSlug: program.slug, hubSlug: { in: allHubSlugs } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { occurrence: "asc" }],
    }),
    // For multi-claim hubs we'll show signup counts on the next 4 sessions.
    db.hostAssignment.findMany({
      where: {
        programSlug: program.slug,
        hubSlug: { in: allHubSlugs },
        sessionDate: { gte: new Date() },
      },
      select: { hubSlug: true, sessionDate: true, userId: true },
      orderBy: { sessionDate: "asc" },
    }),
  ]);

  const hubBySlug = new Map(hubs.map((h) => [h.slug, h]));
  // Build the name lookup from the rules themselves; every userId that
  // appears in displayName() comes from a StandingAssignment row that
  // already includes the user record.
  const memberById = new Map<string, { firstName: string | null; lastName: string | null; preferredName: string | null }>();
  for (const r of allRules) {
    if (r.user) memberById.set(r.userId, r.user);
  }

  function displayName(userId: string): string {
    const u = memberById.get(userId);
    if (!u) return "—";
    return u.preferredName || [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
  }

  // Days the program actually runs on, in calendar order.
  const days = DAY_ORDER.filter((d) => program.recurrenceDays.includes(d));

  // Group StandingAssignment rows by (hubSlug, dayOfWeek) for fast lookup
  // in the render loop.
  const rulesByKey = new Map<string, typeof allRules>();
  for (const r of allRules) {
    if (!r.dayOfWeek) continue; // legacy null-day rows don't fire
    const key = `${r.hubSlug}::${r.dayOfWeek}`;
    if (!rulesByKey.has(key)) rulesByKey.set(key, []);
    rulesByKey.get(key)!.push(r);
  }

  // For multi-claim hubs, group upcoming HostAssignment rows by
  // (hubSlug, dateStr) so we can show "Next session: N signed up" per hub.
  const multiClaimByHubDate = new Map<string, Map<string, number>>();
  for (const a of upcomingAssns) {
    const dateStr = a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : "";
    if (!dateStr) continue;
    if (!multiClaimByHubDate.has(a.hubSlug)) multiClaimByHubDate.set(a.hubSlug, new Map());
    const inner = multiClaimByHubDate.get(a.hubSlug)!;
    inner.set(dateStr, (inner.get(dateStr) ?? 0) + (a.userId ? 1 : 0));
  }

  // Find the next 4 occurrence dates of the program (CT) for the multi-claim
  // summary. Walk forward from today. `isOccurrenceOnDate` honors
  // `endDatetime` natively, so ended programs return no future occurrences.
  function findUpcomingDates(p: ScheduleProgram, count: number): string[] {
    const out: string[] = [];
    const start = new Date();
    for (let i = 0; out.length < count && i < 365; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = ctDateStr(d.toISOString());
      if (isOccurrenceOnDate(p, dateStr)) out.push(dateStr);
    }
    return out;
  }
  const upcomingDates = findUpcomingDates(program as unknown as ScheduleProgram, 4);

  // Group rules by occurrence type for a clean per-day summary in the
  // single-slot grid. For each (hub, day, userId), list which occurrences
  // they hold (e.g. ["FIRST", "THIRD"]).
  type DayCell = { userId: string; userName: string; occurrences: string[] };
  function cellsForDay(hubSlug: string, day: DayCode): DayCell[] {
    const bundle = rulesByKey.get(`${hubSlug}::${day}`) ?? [];
    const byUser = new Map<string, DayCell>();
    for (const r of bundle) {
      const existing = byUser.get(r.userId);
      if (existing) {
        existing.occurrences.push(r.occurrence);
      } else {
        byUser.set(r.userId, {
          userId: r.userId,
          userName: displayName(r.userId),
          occurrences: [r.occurrence],
        });
      }
    }
    return Array.from(byUser.values());
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const formatLabel = (() => {
    switch (program.programFormat) {
      case "virtual":
        return "Virtual";
      case "in-person":
        return "In-person";
      case "hybrid":
        return "In-person & virtual";
      default:
        return program.programFormat ?? "—";
    }
  })();

  return (
    <div className="hub-content hub-content--wide ps-page">
      <header className="ps-page__header">
        <Link href={backUrl} className="ps-page__back">
          ← Back to Scheduler
        </Link>
        <h1 className="ps-page__title">Program staffing</h1>
        <p className="ps-page__subtitle">{program.name}</p>
        <p className="ps-page__meta">
          {formatLabel}
          {days.length > 0 && (
            <>
              {" · "}
              {days.map((d) => DAY_LABEL[d]).join(", ")}
            </>
          )}
        </p>
      </header>

      {allHubSlugs.length === 0 ? (
        <p className="ps-empty">No hubs are currently scheduling this program.</p>
      ) : (
        <div className="ps-hubs">
          {allHubSlugs.map((hubSlug) => {
            const hub = hubBySlug.get(hubSlug);
            const isPrimary = hubSlug === primaryHubSlug;
            const isMultiClaim = !!hub?.allowsMultipleAssignments;
            const hubName = hub?.name ?? hubSlug;

            return (
              <section key={hubSlug} className="ps-hub">
                <header className="ps-hub__header">
                  <div className="ps-hub__title-row">
                    <h2 className="ps-hub__name">{hubName}</h2>
                    <span
                      className={
                        "ps-hub__role" +
                        (isPrimary ? " ps-hub__role--primary" : " ps-hub__role--aux")
                      }
                    >
                      {isPrimary ? "Primary host" : "Auxiliary coverage"}
                    </span>
                    {isMultiClaim && <span className="ps-hub__mode">Open sign-up</span>}
                  </div>
                  <Link
                    href={
                      isMultiClaim
                        ? `/tools/schedule?hub=${encodeURIComponent(hubSlug)}`
                        : `/tools/schedule?hub=${encodeURIComponent(hubSlug)}&view=rotations`
                    }
                    className="ps-hub__edit-link"
                  >
                    {isMultiClaim ? `Open ${hubName} schedule →` : `Edit rotation in ${hubName} →`}
                  </Link>
                </header>

                {isMultiClaim ? (
                  /* Multi-claim hubs (greeter): no rotation rules — show next
                     few sessions with current signup counts. */
                  <div className="ps-multi">
                    {upcomingDates.length === 0 ? (
                      <p className="ps-multi__empty">No upcoming sessions in scope.</p>
                    ) : (
                      <ul className="ps-multi__list">
                        {upcomingDates.map((dateStr) => {
                          const count =
                            multiClaimByHubDate.get(hubSlug)?.get(dateStr) ?? 0;
                          const sessionDate = program.startDatetime
                            ? shiftToDate(program.startDatetime.toISOString(), dateStr)
                            : null;
                          const label = sessionDate
                            ? sessionDate.toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                timeZone: TZ,
                              })
                            : dateStr;
                          return (
                            <li key={dateStr} className="ps-multi__row">
                              <span className="ps-multi__date">{label}</span>
                              <span className="ps-multi__count">
                                {count === 0
                                  ? "No one signed up yet"
                                  : count === 1
                                    ? "1 person signed up"
                                    : `${count} people signed up`}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                  /* Single-slot hubs: per-day rotation pattern. Skip days
                     the program doesn't run on. */
                  <div className="ps-grid">
                    {days.length === 0 ? (
                      <p className="ps-grid__empty">
                        This program has no recurring days set.
                      </p>
                    ) : (
                      <table className="ps-grid__table">
                        <thead>
                          <tr>
                            <th scope="col">Day</th>
                            <th scope="col">Host(s)</th>
                            <th scope="col">Pattern</th>
                          </tr>
                        </thead>
                        <tbody>
                          {days.map((d) => {
                            const cells = cellsForDay(hubSlug, d);
                            return (
                              <tr key={d}>
                                <td className="ps-grid__day">{DAY_LABEL[d]}</td>
                                <td className="ps-grid__hosts">
                                  {cells.length === 0 ? (
                                    <span className="ps-grid__empty-cell">— No rotation set —</span>
                                  ) : (
                                    <ul className="ps-grid__host-list">
                                      {cells.map((c) => (
                                        <li key={c.userId}>{c.userName}</li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                                <td className="ps-grid__pattern">
                                  {cells.length === 0 ? (
                                    <span className="ps-grid__empty-cell">—</span>
                                  ) : (
                                    <ul className="ps-grid__pattern-list">
                                      {cells.map((c) => (
                                        <li key={c.userId}>{formatPattern(c.occurrences)}</li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
