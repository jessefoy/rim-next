import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Flame } from "lucide-react";
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
      };
  });

  const liveSessions  = todaySessions.filter((s) => s.isLive);
  const setupSessions = todaySessions.filter((s) => s.isSetupOpen);
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

  // In-person sessions the user is registered for that happen today. Hybrid
  // programs are already covered by `todaySessions` via `allVirtual` (which
  // includes virtual + hybrid). Strictly in-person registrations are not.
  // Surfacing them in the Today card keeps every today-commitment in one place.
  const inPersonTodayRegistrations = registrationsWithNext.filter(
    (r) => r.nextDateStr === today && r.program?.programFormat === "in-person",
  );

  const showTodayCard =
    liveSessions.length > 0 ||
    laterSessions.length > 0 ||
    inPersonTodayRegistrations.length > 0;

  // "Coming up for you" excludes today's sessions — they live in the Today
  // card above. Drop registrations with no future occurrence too (past
  // programs).
  const sortedRegistrations = registrationsWithNext
    .filter((r): r is typeof r & { nextDateStr: string } => r.nextDateStr !== null && r.nextDateStr !== today)
    .sort((a, b) => a.nextDateStr.localeCompare(b.nextDateStr))
    .slice(0, 5);

  // Your teams: the hubs you're actually a member of. Unread badges live here.
  const myHubs = hubMemberships.map((m) => m.hub);
  const myHubIds = new Set(myHubs.map((h) => h.id));

  // Oversight reach: ADMIN (technical) + GUIDING_TEACHER (dharma) can enter
  // every hub. Shown as a quieter, clearly-labeled group — reach without
  // pretending these are your teams. Mirrors lib/hubAuth.ts::canAccessHub
  // (GT passes the access door; ADMIN does too here since it can still
  // configure any hub from /admin/hubs).
  const canSeeAllHubs = isAdmin || (session.user.roles ?? []).includes("GUIDING_TEACHER");
  const oversightHubs = canSeeAllHubs
    ? (
        await db.hub.findMany({
          select: { id: true, slug: true, name: true, type: true },
          orderBy: { name: "asc" },
        })
      ).filter((h) => !myHubIds.has(h.id))
    : [];

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
  const sessionCount =
    liveSessions.filter((s) => s.isRegistered).length +
    laterSessions.filter((s) => s.isRegistered).length +
    inPersonTodayRegistrations.length;
  const summaryParts: string[] = [];
  if (sessionCount > 0) summaryParts.push(`${sessionCount} session${sessionCount > 1 ? "s" : ""} today`);
  if (pendingDanaCount > 0) summaryParts.push(`${pendingDanaCount} dana offering${pendingDanaCount > 1 ? "s" : ""} to complete`);
  const summaryLine = summaryParts.length > 0
    ? `You have ${summaryParts.join(" and ")}.`
    : fmtTodayFull();

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

        {/* Today's Sessions */}
        {showTodayCard && (
          <div className="db-section">
            <p className="db-section__label">Today</p>
            <div className="today-card">
              <DashboardAutoRefresh liveStartEpochs={laterEpochs} earlyOpenEpochs={earlyEpochs} />
              {liveSessions.map((s) => (
                <div key={s._id} className="today-row today-row--live">
                  <div className="today-row__left">
                    <span className="today-live-badge">Zoom open</span>
                    <span className="today-row__details">
                      <span className="today-row__title">{s.name}</span>
                      <span className="today-row__meta">Online on Zoom</span>
                    </span>
                  </div>
                  <div className="today-row__right">
                    {s.isRegistered && <span className="today-registered">Registered</span>}
                    {(s.programFormat === "virtual" || s.programFormat === "hybrid") && (
                      <a href={`/session/${s.slug}/enter`} className="join-btn">
                        Join on Zoom
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {setupSessions.map((s) => (
                <div key={s._id} className="today-row today-row--setup">
                  <div className="today-row__left">
                    <span className="today-setup-badge">Host entry open</span>
                    <span className="today-row__details">
                      <span className="today-row__title">{s.name}</span>
                      <span className="today-row__meta">Online on Zoom</span>
                    </span>
                  </div>
                  <div className="today-row__right">
                    <span className="today-row__countdown">Member entry opens at {s.liveStartTimeCT}</span>
                    {(s.programFormat === "virtual" || s.programFormat === "hybrid") && (
                      <a href={`/session/${s.slug}/enter`} className="join-btn join-btn--setup">
                        Enter Zoom as host
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {laterSessions.map((s, index) => (
                <div key={s._id} className={`today-row today-row--later${index === 0 ? " today-row--next" : ""}`}>
                  <div className="today-row__left">
                    <span className="today-row__time">{s.startTimeCT}</span>
                    <span className="today-row__details">
                      <span className="today-row__title">{s.name}</span>
                      <span className="today-row__meta">Online on Zoom</span>
                    </span>
                  </div>
                  <div className="today-row__right">
                    {s.isRegistered && <span className="today-registered">Registered</span>}
                    <span className="today-row__countdown">{s.countdownText}</span>
                  </div>
                </div>
              ))}
              {inPersonTodayRegistrations.map((r) => (
                <div key={r.id} className="today-row today-row--later">
                  <div className="today-row__left">
                    <span className="today-row__time">{r.nextTimeCT}</span>
                    <span className="today-row__title">{r.programTitle}</span>
                  </div>
                  <div className="today-row__right">
                    <span className="today-registered">In-person</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coming up for you (with inline dana status) */}
        <div className="db-section">
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
                  <Link key={r.id} href={`/account/programs/${r.programSlug}`} className="db2-upcoming__item">
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
                        ? <span title="You're invited to offer dana for this program — a voluntary gift, welcomed with gratitude.">
                            <Flame size={16} strokeWidth={1.75} className="db2-dana-icon" />
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

        {/* Personal destinations are present without competing with the day. */}
        <div className="db-section db2-practice">
          <p className="db-section__label">Your practice</p>
          <div className="db2-practice__links">
            <Link href="/account/programs">My registrations <span aria-hidden="true">→</span></Link>
            <Link href="/account/courses">Library <span aria-hidden="true">→</span></Link>
            <Link href="/account/documents">Documents <span aria-hidden="true">→</span></Link>
            <Link href="/account/mindmaps">Mind maps <span aria-hidden="true">→</span></Link>
          </div>
        </div>

        {/* Your teams — hubs you're a member of */}
        {myHubs.length > 0 && (
          <div className="db-section">
            <p className="db-section__label">Your teams</p>
            <div className="db2-hub-grid">
              {myHubs.map((hub) => {
                const unread = hubUnreadCounts[hub.id] ?? 0;
                return (
                  <Link key={hub.id} href={`/account/hub/${hub.slug}`} className="db2-hub-card">
                    <span className="db2-hub-card__name">{hub.name}</span>
                    <span className="db2-hub-card__type">
                      {hub.type === "OPERATIONAL" ? "Operational" :
                       hub.type === "GOVERNANCE"  ? "Governance"  : "Community Group"}
                    </span>
                    {unread > 0 && (
                      <span className="db2-hub-card__unread">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Oversight — every other hub, for guiding-teacher / admin reach.
            Quieter group: no unread badges, muted treatment, so your own
            teams above stay the primary thing the eye lands on. */}
        {oversightHubs.length > 0 && (
          <div className="db-section">
            <p className="db-section__label">
              {myHubs.length > 0 ? "Other hubs — oversight" : "All hubs — oversight"}
            </p>
            <div className="db2-hub-grid db2-hub-grid--oversight">
              {oversightHubs.map((hub) => (
                <Link
                  key={hub.id}
                  href={`/account/hub/${hub.slug}`}
                  className="db2-hub-card db2-hub-card--oversight"
                >
                  <span className="db2-hub-card__name">{hub.name}</span>
                  <span className="db2-hub-card__type">
                    {hub.type === "OPERATIONAL" ? "Operational" :
                     hub.type === "GOVERNANCE"  ? "Governance"  : "Community Group"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </AccountLayout>
  );
}
