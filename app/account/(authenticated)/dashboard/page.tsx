import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { activeHubThreadWhere } from "@/lib/hubQueries";
import { ctDateStr, isOccurrenceOnDate, nextOccurrenceOnOrAfter, shiftToDate } from "@/lib/scheduleUtils";
import { isOpenlyDroppable } from "@/lib/programKind";
import { getHubCoverageCopy } from "@/lib/programHub";
import { EARLY_OPEN_MIN, MEMBER_JOIN_MIN, FALLBACK_DURATION_MIN } from "@/lib/sessionWindowConstants";
import AccountLayout from "@/components/AccountLayout";
import DashboardAutoRefresh from "@/components/DashboardAutoRefresh";
import HostWelcomePanel from "@/components/HostWelcomePanel";

export const metadata = { title: "My Home — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

function todayCT(): string {
  return ctDateStr(new Date().toISOString());
}

function fmtTimeCT(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtTodayFull() {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long", month: "long", day: "numeric",
  });
}

function timeOfDay(): string {
  const h = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false });
  const hour = parseInt(h, 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

type TodayDisplayItem = {
  key: string;
  name: string;
  startTimeCT: string;
  startEpoch: number;
  formatLabel: string;
  isRegistered: boolean;
  stage: "open" | "setup" | "in-person" | "later";
  statusText?: string;
  actionHref?: string;
  actionLabel?: string;
  contextText?: string;
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user.id;
  const today  = todayCT();

  // Dashboard is sessions-only as of session 117: courses live in the Library
  // (`/account/courses`). Onboarding welcome and "Where you're studying" both
  // moved there. The dashboard surfaces today's commitments, upcoming
  // registrations, and hub presence — nothing else.
  const [allVirtual, upcomingRegistrations, hubMemberships] =
    await Promise.all([
      db.program.findMany({
        where: {
          programFormat: { in: ["virtual", "hybrid"] },
          OR: [
            { removeFromProgramList: false },
            { dashboardShowAt: { lte: new Date() } },
          ],
        },
        select: {
          id: true, name: true, slug: true,
          startDatetime: true, endDatetime: true,
          recurrenceFreq: true, recurrenceInterval: true,
          recurrenceDays: true, recurrenceCount: true,
          programFormat: true,
          // Offering kind (via category) + registration drive Today placement:
          // only openly-droppable kinds show a public Join to non-registrants.
          registrationEnabled: true,
          category: { select: { kind: true } },
        },
        orderBy: { sortOrder: "asc" },
      }),
      // Include donationStatus so we can show dana inline.
      // Include recurrence fields so we can compute each program's next occurrence.
      // We sort by next-occurrence in JS below — Prisma can't express "next
      // upcoming session" for a recurring program directly.
      db.registration.findMany({
        // PENDING_PAYMENT is a held, unpaid registration — not a real commitment
        // until the Stripe webhook completes it, so keep it off the dashboard.
        where: { userId, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } },
        select: {
          id: true,
          programTitle: true,
          programSlug: true,
          donationStatus: true,
          program: {
            select: {
              programFormat: true,
              startDatetime: true,
              endDatetime: true,
              recurrenceFreq: true,
              recurrenceInterval: true,
              recurrenceDays: true,
              recurrenceCount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.hubMember.findMany({
        where: { userId },
        include: { hub: { select: { id: true, slug: true, name: true, type: true } } },
        orderBy: { joinedAt: "asc" },
      }),
    ]);

  // Today's sessions
  const todaySessionsRaw = allVirtual.filter((p) => isOccurrenceOnDate(p, today));
  const now = new Date();

  // Host/teacher detection: the Session Host (HostAssignment for today) and the
  // ProgramTeacher get an early-open window (EARLY_OPEN_MIN = 30 min before
  // start) for prep + emergencies, before the regular member join opens
  // (MEMBER_JOIN_MIN = 10 min before). ADMIN gets the same affordance as a
  // safety override. One batched query per surface (host + teacher), then we
  // match per session in JS using the CT date string for HostAssignment.
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  const todayProgramSlugs = todaySessionsRaw.map((p) => p.slug);
  const todayProgramIds   = todaySessionsRaw.map((p) => p.id);
  // Prisma `{ in: [] }` returns no rows, so the queries are safe to always run.
  const [myHostAssignments, myTeacherPrograms] = await Promise.all([
    db.hostAssignment.findMany({
      where: { userId, programSlug: { in: todayProgramSlugs } },
      select: { programSlug: true, sessionDate: true },
    }),
    db.programTeacher.findMany({
      where: { userId, programId: { in: todayProgramIds } },
      select: { programId: true },
    }),
  ]);
  // A host matches today's occurrence if either the assignment's sessionDate
  // is set to today (the normal per-occurrence case) OR sessionDate is null
  // (a legacy "standing" assignment — covers every occurrence).
  const hostedSlugsToday = new Set(
    myHostAssignments
      .filter((a) => !a.sessionDate || ctDateStr(a.sessionDate.toISOString()) === today)
      .map((a) => a.programSlug),
  );
  const teacherProgramIds = new Set(myTeacherPrograms.map((t) => t.programId));

  // Which of today's candidate programs the viewer is registered for (batched).
  const todayRegSlugs = new Set(
    (
      await db.registration.findMany({
        where: {
          userId,
          programSlug: { in: todayProgramSlugs },
          status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] },
        },
        select: { programSlug: true },
      })
    ).map((r) => r.programSlug),
  );

  // What belongs in "Today": openly-droppable offerings (drop-ins / open
  // community groups) for everyone, PLUS anything the viewer is registered for
  // or hosting/teaching (ADMIN sees all as a safety override). A
  // registration-required class/event/retreat never offers a public Join to a
  // non-registrant — it surfaces in "Coming up for you" instead.
  const visibleTodayRaw = todaySessionsRaw.filter(
    (p) =>
      isOpenlyDroppable(p.category?.kind ?? null, p.registrationEnabled) ||
      todayRegSlugs.has(p.slug) ||
      isAdmin ||
      hostedSlugsToday.has(p.slug) ||
      teacherProgramIds.has(p.id),
  );

  const todaySessions = visibleTodayRaw.map((p) => {
      const startIso = p.startDatetime!.toISOString();
      const start     = shiftToDate(startIso, today);
      const liveStart = new Date(start.getTime() - MEMBER_JOIN_MIN * 60 * 1000);
      const endIso    = p.endDatetime?.toISOString() ?? null;
      const liveEnd   = endIso ? shiftToDate(endIso, today) : new Date(start.getTime() + FALLBACK_DURATION_MIN * 60 * 1000);
      const isHostOrTeacher =
        isAdmin ||
        hostedSlugsToday.has(p.slug) ||
        teacherProgramIds.has(p.id);
      const earlyOpenStart = new Date(start.getTime() - EARLY_OPEN_MIN * 60 * 1000);
      const isLive       = now >= liveStart && now <= liveEnd;
      const isSetupOpen  = !isLive && isHostOrTeacher && now >= earlyOpenStart && now < liveStart;
      const isLaterToday = !isLive && !isSetupOpen && start > now;

      const isRegistered = todayRegSlugs.has(p.slug);

      // Compute countdown for later sessions (regular members and host/teacher
      // before their early-open window).
      const minsUntilEarly = Math.round((earlyOpenStart.getTime() - now.getTime()) / 60000);
      let countdownText = "";
      if (isLaterToday) {
        if (isHostOrTeacher && minsUntilEarly > 0 && minsUntilEarly <= 60) {
          countdownText = `Host entry opens in ${minsUntilEarly} min`;
        } else {
          countdownText = `Zoom opens at ${fmtTimeCT(liveStart.toISOString())}`;
        }
      }

      return {
        ...p, _id: p.id, isLive, isSetupOpen, isLaterToday, isHostOrTeacher, isRegistered,
        startTimeCT: fmtTimeCT(start.toISOString()),
        liveStartEpoch: liveStart.getTime(),
        liveStartTimeCT: fmtTimeCT(liveStart.toISOString()),
        earlyOpenEpoch: earlyOpenStart.getTime(),
        countdownText,
        startEpoch: start.getTime(),
      };
  }).sort((a, b) => a.startEpoch - b.startEpoch);

  const laterSessions = todaySessions.filter((s) => s.isLaterToday);
  const laterEpochs   = laterSessions.map((s) => s.liveStartEpoch);
  // Refresh epochs for the host/teacher early-open transition: any "later"
  // session the viewer is hosting/teaching that hasn't yet hit setup time.
  const earlyEpochs   = laterSessions
    .filter((s) => s.isHostOrTeacher && s.earlyOpenEpoch > now.getTime())
    .map((s) => s.earlyOpenEpoch);

  // Project each registration to its next upcoming occurrence — date plus the
  // session start time on that date. Members think in "what's coming next," not
  // "what did I sign up for most recently."
  const registrationsWithNext = upcomingRegistrations.map((r) => {
    const p = r.program;
    let nextDateStr: string | null = null;
    let nextTimeCT: string | null = null;
    if (p?.startDatetime) {
      nextDateStr = nextOccurrenceOnOrAfter(
        {
          id: "",
          name: r.programTitle,
          slug: r.programSlug,
          programFormat: null,
          startDatetime: p.startDatetime,
          endDatetime: p.endDatetime ?? null,
          recurrenceFreq: p.recurrenceFreq ?? null,
          recurrenceInterval: p.recurrenceInterval ?? null,
          recurrenceDays: p.recurrenceDays ?? [],
          recurrenceCount: p.recurrenceCount ?? null,
        },
        today,
        365
      );
      if (nextDateStr) {
        const projected = shiftToDate(p.startDatetime.toISOString(), nextDateStr);
        nextTimeCT = fmtTimeCT(projected.toISOString());
      }
    }
    return { ...r, nextDateStr, nextTimeCT };
  });

  // Project every online session into a common display shape. State remains a
  // property of its own session — a second live or host-entry session must
  // never be demoted beneath a generic "Later today" heading.
  const onlineTodayItems: TodayDisplayItem[] = todaySessions
    .filter((s) => s.isLive || s.isSetupOpen || s.isLaterToday)
    .map((s) => ({
      key: `program-${s._id}`,
      name: s.name,
      startTimeCT: s.startTimeCT,
      startEpoch: s.startEpoch,
      formatLabel: "Online on Zoom",
      isRegistered: s.isRegistered,
      stage: s.isLive ? "open" : s.isSetupOpen ? "setup" : "later",
      statusText: s.isSetupOpen ? "Host entry is open" : undefined,
      actionHref: s.isLive || s.isSetupOpen ? `/session/${s.slug}/enter` : undefined,
      actionLabel: s.isLive ? "Join on Zoom" : s.isSetupOpen ? "Enter Zoom as host" : undefined,
      contextText: s.isSetupOpen
        ? `Member entry opens at ${s.liveStartTimeCT}`
        : s.isLaterToday
          ? s.countdownText
          : undefined,
    }));

  // Strictly in-person registrations are not in `allVirtual`. Place current
  // and future occurrences into the same chronology, and drop an occurrence
  // once its session window has passed.
  const inPersonTodayItems: TodayDisplayItem[] = registrationsWithNext.flatMap((r) => {
    const p = r.program;
    if (
      r.nextDateStr !== today ||
      p?.programFormat !== "in-person" ||
      !p.startDatetime
    ) return [];

    const start = shiftToDate(p.startDatetime.toISOString(), today);
    const end = p.endDatetime
      ? shiftToDate(p.endDatetime.toISOString(), today)
      : new Date(start.getTime() + FALLBACK_DURATION_MIN * 60 * 1000);
    if (now > end) return [];

    const isHappeningNow = now >= start;
    return [{
      key: `registration-${r.id}`,
      name: r.programTitle,
      startTimeCT: fmtTimeCT(start.toISOString()),
      startEpoch: start.getTime(),
      formatLabel: "In person",
      isRegistered: true,
      stage: isHappeningNow ? "in-person" : "later",
      statusText: isHappeningNow ? "Happening now" : undefined,
    }];
  });

  const activeTodayItems = [...onlineTodayItems, ...inPersonTodayItems]
    .filter((item) => item.stage !== "later")
    .sort((a, b) => a.startEpoch - b.startEpoch);
  const laterTodayItems = [...onlineTodayItems, ...inPersonTodayItems]
    .filter((item) => item.stage === "later")
    .sort((a, b) => a.startEpoch - b.startEpoch);
  const showTodayCard = activeTodayItems.length > 0 || laterTodayItems.length > 0;

  // "Coming up for you" excludes today's sessions — they live in the Today
  // card above. Drop registrations with no future occurrence too (past
  // programs).
  const sortedRegistrations = registrationsWithNext
    .filter((r): r is typeof r & { nextDateStr: string } => r.nextDateStr !== null && r.nextDateStr !== today)
    .sort((a, b) => a.nextDateStr.localeCompare(b.nextDateStr))
    .slice(0, 5);

  // Your teams: the hubs you're actually a member of. Unread badges live here.
  const myHubs = hubMemberships.map((m) => m.hub);

  // Unread counts only for your own teams (membership-scoped — oversight
  // hubs don't track your unread because you're stewarding, not participating).
  const hubUnreadCounts: Record<string, number> = {};
  for (const membership of hubMemberships) {
    const lastVisited = membership.lastVisitedAt ?? new Date(0);
    const unreadThreads = await db.hubConversationThread.count({
      where: {
        ...activeHubThreadWhere(membership.hub.id),
        OR: [
          { createdAt: { gt: lastVisited } },
          { replies: { some: { createdAt: { gt: lastVisited } } } },
        ],
      },
    });
    hubUnreadCounts[membership.hub.id] = unreadThreads;
  }
  const hubsWithUnread = myHubs.filter((hub) => (hubUnreadCounts[hub.id] ?? 0) > 0);

  // First-login host recognition (session 143, backlog 2026-06-08-003): a host
  // can be pre-staged — role assigned, schedule built — before they ever log in.
  // When they finally do, everything's attached but nothing points to it. Show a
  // one-time panel the first time. Gate on the dismissal flag AND on hub
  // membership (a pre-staged host is always a HubMember of their hub) so the
  // hosting lookups never run for the large population of pure participants who
  // belong to no hub and can't be hosts.
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { hostWelcomeSeenAt: true },
  });
  let hostWelcomeHref: string | null = null;
  let hostWelcomeNoun = "Host";
  if (me && me.hostWelcomeSeenAt === null && hubMemberships.length > 0) {
    // Any future single-host/greeter assignment OR any active standing rotation,
    // across any hub. findFirst — existence is all we need; hubSlug points the
    // CTA at the right Scheduler view.
    const [anyAssignment, anyRotation] = await Promise.all([
      db.hostAssignment.findFirst({
        where: { userId, OR: [{ sessionDate: null }, { sessionDate: { gte: now } }] },
        select: { hubSlug: true },
      }),
      db.standingAssignment.findFirst({
        where: { userId, OR: [{ endsOn: null }, { endsOn: { gte: now } }] },
        select: { hubSlug: true },
      }),
    ]);
    const hub = anyAssignment?.hubSlug ?? anyRotation?.hubSlug ?? null;
    if (hub) {
      hostWelcomeHref = `/tools/schedule?hub=${encodeURIComponent(hub)}`;
      hostWelcomeNoun = (await getHubCoverageCopy(hub)).noun;
    }
  }

  const firstName =
    session.user?.name?.split(" ")[0] ??
    session.user?.email?.split("@")[0] ??
    "there";

  // Contextual greeting summary
  const pendingDanaCount = upcomingRegistrations.filter((r) => r.donationStatus === "PENDING").length;
  // sessionCount reflects the member's own commitments — not every community
  // program running today. The Today card itself still shows all virtual/hybrid
  // community programs (its job is "what you can drop into today"), but the
  // greeting reads in first person and must mean what it says.
  const sessionCount = [...activeTodayItems, ...laterTodayItems]
    .filter((item) => item.isRegistered).length;
  const summaryParts: string[] = [];
  if (sessionCount > 0) summaryParts.push(`${sessionCount} session${sessionCount > 1 ? "s" : ""} today`);
  if (pendingDanaCount > 0) summaryParts.push(`${pendingDanaCount} dana invitation${pendingDanaCount > 1 ? "s" : ""}`);
  const summaryLine = summaryParts.length > 0
    ? `You have ${summaryParts.join(" and ")}.`
    : "You have nothing scheduled today.";

  return (
    <AccountLayout>
      <div className="db2-wrap">

        {/* A personal orientation, then the day itself — not a generic dashboard. */}
        <header className="db2-greeting">
          <p className="db2-greeting__date">{fmtTodayFull()}</p>
          <h1 className="db2-greeting__name">Good {timeOfDay()}, {firstName}.</h1>
          <p className="db2-greeting__summary">{summaryLine}</p>
        </header>

        {/* First-login host recognition — one-time, dismissible (session 143) */}
        {hostWelcomeHref && <HostWelcomePanel scheduleHref={hostWelcomeHref} coverageNoun={hostWelcomeNoun} />}

        {/* Today groups sessions by their truthful state, then orders within it. */}
        {showTodayCard && (
          <section className="db-section db2-today">
            <div className="db-section__heading">
              <p className="db-section__label">Today</p>
              <Link href="/this-week" className="db-section__link">Full schedule</Link>
            </div>
            <div className="today-card">
              <DashboardAutoRefresh liveStartEpochs={laterEpochs} earlyOpenEpochs={earlyEpochs} />
              {activeTodayItems.map((item) => (
                <article key={item.key} className={`today-focus today-focus--${item.stage}`}>
                  <div className="today-focus__time">
                    <time>{item.startTimeCT}</time>
                  </div>
                  <div className="today-focus__details">
                    <h2>{item.name}</h2>
                    <div className="today-focus__meta">
                      <span>{item.formatLabel}</span>
                      {item.isRegistered && <span className="today-registered">Registered</span>}
                    </div>
                  </div>
                  <div className="today-focus__action">
                    {item.statusText && <span className="today-focus__status">{item.statusText}</span>}
                    {item.actionHref && item.actionLabel && (
                      <a href={item.actionHref} className={`join-btn${item.stage === "setup" ? " join-btn--setup" : ""}`}>
                        {item.actionLabel}
                      </a>
                    )}
                    {item.contextText && <span className="today-focus__context">{item.contextText}</span>}
                  </div>
                </article>
              ))}

              {laterTodayItems.length > 0 && (
                <div className="today-later">
                  <p className="today-later__heading">Later today</p>
                  <div className="today-list">
                    {laterTodayItems.map((item) => (
                      <div key={item.key} className="today-list__item">
                        <time>{item.startTimeCT}</time>
                        <div>
                          <span className="today-list__title">{item.name}</span>
                          <span className="today-list__meta">
                            <span>{item.formatLabel}</span>
                            {item.isRegistered && <span className="today-registered">Registered</span>}
                          </span>
                        </div>
                        <div className="today-list__action">
                          {item.contextText && <span className="today-list__context">{item.contextText}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Coming up for you (with inline dana status) */}
        <div className="db-section db2-coming-up">
          <p className="db-section__label">Coming up for you</p>
          {sortedRegistrations.length === 0 ? (
            <div className="db2-empty-card">
              <p className="db2-empty-card__text">No upcoming programs yet.</p>
              <Link href="/community-programs" className="db2-empty-card__link">Browse programs →</Link>
            </div>
          ) : (
            <div className="db2-upcoming">
              {sortedRegistrations.map((r) => {
                // Date pill shows the projected next-occurrence date, not the
                // program's anchor — anchor is the first-ever occurrence, often
                // long in the past for recurring programs.
                const dateForPill = new Date(r.nextDateStr + "T12:00:00");
                const hasPendingDana = r.donationStatus === "PENDING";
                return (
                  <Link key={r.id} href={`/programs/${r.programSlug}`} className="db2-upcoming__item">
                    {(() => {
                      const mon = dateForPill.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short" }).toUpperCase();
                      const day = dateForPill.toLocaleDateString("en-US", { timeZone: "America/Chicago", day: "numeric" });
                      return (
                        <span className="db2-upcoming__date-block">
                          <span className="db2-upcoming__date-month">{mon}</span>
                          <span className="db2-upcoming__date-day">{day}</span>
                        </span>
                      );
                    })()}
                    <span className="db2-upcoming__title">
                      <span>{r.programTitle}</span>
                      <span className="db2-upcoming__meta">
                        {r.nextTimeCT && <span>{r.nextTimeCT}</span>}
                        {(r.program?.programFormat === "virtual" || r.program?.programFormat === "hybrid") && <span>Online on Zoom</span>}
                      </span>
                    </span>
                    <span className="db2-upcoming__status">
                      {hasPendingDana
                        ? <span className="db2-chip-stack">
                            {/* Visible words, not a title tooltip — touch
                                devices and screen readers never saw it. */}
                            <span className="db2-chip db2-chip--dana">
                              Dana invitation
                            </span>
                            <span className="db2-chip-note">
                              A voluntary gift — never required
                            </span>
                          </span>
                        : <span className="db2-chip db2-chip--registered">Registered</span>
                      }
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Teams belong in the sidebar. Surface only work that needs attention here. */}
        {hubsWithUnread.length > 0 && (
          <div className="db-section">
            <p className="db-section__label">From your teams</p>
            <div className="db2-team-updates">
              {hubsWithUnread.map((hub) => {
                const unread = hubUnreadCounts[hub.id] ?? 0;
                return (
                  <Link key={hub.id} href={`/account/hub/${hub.slug}`} className="db2-team-update">
                    <span>{hub.name}</span>
                    <span>{unread > 9 ? "9+" : unread} unread</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </AccountLayout>
  );
}
