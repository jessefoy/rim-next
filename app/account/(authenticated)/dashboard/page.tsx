import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ctDateStr, isOccurrenceOnDate, nextOccurrenceOnOrAfter, shiftToDate } from "@/lib/scheduleUtils";
import { hasOpenEntry } from "@/lib/programOffering";
import { getHubCoverageCopy } from "@/lib/programHub";
import { EARLY_OPEN_MIN, MEMBER_JOIN_MIN, FALLBACK_DURATION_MIN } from "@/lib/sessionWindowConstants";
import AccountLayout from "@/components/AccountLayout";
import DashboardAutoRefresh from "@/components/DashboardAutoRefresh";
import HostWelcomePanel from "@/components/HostWelcomePanel";
import HandfulHomeCard from "@/components/HandfulHomeCard";

export const metadata = { title: "My Home - Rooted In Mindfulness" };
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
  /** The session's end, when the program has one. */
  endTimeCT?: string | null;
  startEpoch: number;
  formatLabel: string;
  isRegistered: boolean;
  stage: "open" | "setup" | "in-person" | "later";
  statusText?: string;
  actionHref?: string;
  actionLabel?: string;
  contextText?: string;
  note?: string | null;
  announcement?: string | null;
};

export default async function DashboardPage({ searchParams }: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const query = await searchParams;
  const upcomingView = query.view === "upcoming";
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
          // An archived program has no live sessions; /enter refuses it, so a
          // Join button for it would only lead to "This program has ended".
          archivedAt: null,
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
          programFormat: true, earlyArrivalMessage: true, specialAnnouncement: true,
          // Open entry drives Today placement: only a program with open entry
          // shows a public Join to non-registrants. (registrationEnabled and
          // the old category are read only while openEntry is still empty.)
          registrationEnabled: true,
          openEntry: true,
          category: { select: { slug: true, kind: true } },
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
          status: true,
          donationStatus: true,
          program: {
            select: {
              programFormat: true, earlyArrivalMessage: true, specialAnnouncement: true,
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
          // Waitlisted isn't a place in the session: no Join until promoted.
          status: { notIn: ["CANCELLED", "PENDING_PAYMENT", "WAITLISTED"] },
        },
        select: { programSlug: true },
      })
    ).map((r) => r.programSlug),
  );

  // What belongs in "Today": programs with open entry for everyone, PLUS anything the viewer is registered for
  // or hosting/teaching (ADMIN sees all as a safety override). A
  // registration-required class/event/retreat never offers a public Join to a
  // non-registrant — it surfaces in "Coming up for you" instead.
  const visibleTodayRaw = todaySessionsRaw.filter(
    (p) =>
      hasOpenEntry(p) ||
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
          countdownText = `Opens at ${fmtTimeCT(liveStart.toISOString())}`;
        }
      }

      return {
        ...p, _id: p.id, isLive, isSetupOpen, isLaterToday, isHostOrTeacher, isRegistered,
        startTimeCT: fmtTimeCT(start.toISOString()),
        endTimeCT: endIso ? fmtTimeCT(liveEnd.toISOString()) : null,
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
      note: s.earlyArrivalMessage, announcement: s.specialAnnouncement,
      name: s.name,
      startTimeCT: s.startTimeCT,
      endTimeCT: s.endTimeCT,
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
      r.status === "WAITLISTED" ||
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
      note: p.earlyArrivalMessage, announcement: p.specialAnnouncement,
      name: r.programTitle,
      startTimeCT: fmtTimeCT(start.toISOString()),
      endTimeCT: p.endDatetime ? fmtTimeCT(end.toISOString()) : null,
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
    ;
  const pageCount = Math.max(1, Math.ceil(sortedRegistrations.length / 20));
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(query.page) || 1)));
  const visibleRegistrations = sortedRegistrations.slice((page - 1) * 20, page * 20);

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

  return (
    <AccountLayout>
      <div className="db2-wrap">

        {/* A personal orientation, then the day itself — not a generic dashboard. */}
        <header className="db2-greeting">
          <p className="db2-greeting__date">{fmtTodayFull()}</p>
          <h1 className="db2-greeting__name">{upcomingView ? "Your upcoming programs" : `Good ${timeOfDay()}, ${firstName}.`}</h1>
          {upcomingView && <Link href="/account/dashboard" className="pp-btn pp-btn--ghost">Back to My Home</Link>}
        </header>

        {/* First-login host recognition — one-time, dismissible (session 143) */}
        {!upcomingView && hostWelcomeHref && <HostWelcomePanel scheduleHref={hostWelcomeHref} coverageNoun={hostWelcomeNoun} />}

        {/* Today groups sessions by their truthful state, then orders within it. */}
        {!upcomingView && showTodayCard && (
          <section className="db-section db2-today">
            <div className="db-section__heading">
              <p className="db-section__label">Today</p>
            </div>
            <div className="today-card">
              <DashboardAutoRefresh liveStartEpochs={laterEpochs} earlyOpenEpochs={earlyEpochs} />
              {activeTodayItems.map((item) => (
                <article key={item.key} className={`today-focus today-focus--${item.stage}`}>
                  <div className="today-focus__time">
                    <time>{item.startTimeCT}</time>
                    {item.endTimeCT && <span className="today-focus__until">until {item.endTimeCT}</span>}
                    <span className={`today-state today-state--${item.stage}`}>{stateLabel(item)}</span>
                  </div>
                  <div className="today-focus__details">
                    <h2>{item.name}</h2>
                    <p className="today-focus__meta">{item.formatLabel}</p>
                    <SessionNotes item={item} />
                  </div>
                  <div className="today-focus__action">
                    {item.actionHref && item.actionLabel && (
                      <a href={item.actionHref} className={`join-btn${item.stage === "setup" ? " join-btn--setup" : ""}`}>
                        {item.actionLabel}
                      </a>
                    )}
                    {item.isRegistered && <span className="today-focus__context">You&rsquo;re registered</span>}
                    {item.contextText && <span className="today-focus__context">{item.contextText}</span>}
                  </div>
                </article>
              ))}

              {laterTodayItems.length > 0 && (
                <div className="today-later">
                  {laterTodayItems.map((item) => (
                    <div key={item.key} className="today-list__item">
                      <div className="today-list__time">
                        <time>{item.startTimeCT}</time>
                        <span>Later today</span>
                      </div>
                      <div className="today-list__details">
                        <span className="today-list__title">{item.name}</span>
                        <span className="today-list__meta">{item.formatLabel}{item.isRegistered && <> · Registered</>}</span>
                        <SessionNotes item={item} />
                      </div>
                      <div className="today-list__action">
                        {item.contextText && <span className="today-list__context">{item.contextText}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {!upcomingView && <>
          {!showTodayCard && <section className="rim-empty"><h2>There are no more sessions today.</h2><p>You can find the next gathering in the full schedule.</p></section>}
          {/* The next three registrations, as rows: the next useful thing,
              not a feed (RIM_Member_Area.md, design decisions). The full list
              is a destination. */}
          {sortedRegistrations.length > 0 && (
            <section className="db-section db2-coming-up">
              <div className="db-section__heading">
                <p className="db-section__label">Coming up</p>
              </div>
              <div className="db2-upcoming">
                {sortedRegistrations.slice(0, 3).map((r) => <UpcomingRow key={r.id} r={r} />)}
              </div>
            </section>
          )}
          <nav className="rim-home-links" aria-label="More programs">
            {sortedRegistrations.length > 0 && (
              <Link href="/account/dashboard?view=upcoming" className="pp-btn pp-btn--ghost">All upcoming programs <span aria-hidden="true">→</span></Link>
            )}
            <Link href="/this-week" className="pp-btn pp-btn--ghost">This week&rsquo;s schedule <span aria-hidden="true">→</span></Link>
          </nav>
          <HandfulHomeCard />
        </>}
        {/* Existing registration information remains reachable, without self-cancellation. */}
        {upcomingView && (
        <div className="db-section db2-coming-up">

          {sortedRegistrations.length === 0 ? (
            <div className="db2-empty-card">
              <p className="db2-empty-card__text">No upcoming programs yet.</p>
              <Link href="/community-programs" className="pp-btn pp-btn--ghost">Browse programs <span aria-hidden="true">→</span></Link>
            </div>
          ) : (
            <div className="db2-upcoming">
              {visibleRegistrations.map((r) => <UpcomingRow key={r.id} r={r} />)}
            </div>
          )}
        </div>

        )}
        {upcomingView && pageCount > 1 && <nav className="rim-pagination" aria-label="Upcoming programs pages">
          {page > 1 && <Link href={`/account/dashboard?view=upcoming&page=${page - 1}`}>Previous</Link>}
          <span>Page {page} of {pageCount}</span>
          {page < pageCount && <Link href={`/account/dashboard?view=upcoming&page=${page + 1}`}>Next</Link>}
        </nav>}

      </div>
    </AccountLayout>
  );
}

/** The state a member reads at the left edge of a Today row (Jesse, 2026-10-09:
    "Open now" and "Opens at 5:50" as written). */
function stateLabel(item: TodayDisplayItem): string {
  if (item.stage === "open") return "Open now";
  if (item.stage === "in-person") return "Happening now";
  if (item.stage === "setup") return "Host entry open";
  return "Later today";
}

type UpcomingRowData = {
  id: string;
  programSlug: string;
  programTitle: string;
  nextDateStr: string;
  nextTimeCT: string | null;
  donationStatus: string | null;
  program: { programFormat: string | null } | null;
};

/** One upcoming registration as a row: date and time, title and place, the
    chip. Shared by My Home's "Coming up" and the full upcoming view. The
    date is the projected next occurrence, not the program's anchor. */
function UpcomingRow({ r }: { r: UpcomingRowData }) {
  const d = new Date(r.nextDateStr + "T12:00:00");
  const dateLabel = d.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" });
  const fmt = r.program?.programFormat;
  const place = fmt === "virtual" ? "Online on Zoom" : fmt === "hybrid" ? "In person and on Zoom" : fmt === "in-person" ? "In person" : null;
  const hasPendingDana = r.donationStatus === "PENDING";
  return (
    <Link href={`/programs/${r.programSlug}`} className="db2-upcoming__item">
      <span className="db2-upcoming__when">
        <span className="db2-upcoming__date">{dateLabel}</span>
        {r.nextTimeCT && <span className="db2-upcoming__time">{r.nextTimeCT}</span>}
      </span>
      <span className="db2-upcoming__title">
        <span>{r.programTitle}</span>
        {place && <span className="db2-upcoming__meta">{place}</span>}
      </span>
      <span className="db2-upcoming__status">
        {hasPendingDana
          ? <span className="db2-chip-stack">
              {/* Visible words, not a title tooltip — touch devices and
                  screen readers never saw it. */}
              <span className="db2-chip db2-chip--dana">Dana invitation</span>
              <span className="db2-chip-note">A voluntary gift, never required</span>
            </span>
          : <span className="db2-chip db2-chip--registered">Registered</span>}
      </span>
    </Link>
  );
}

function SessionNotes({ item }: { item: TodayDisplayItem }) {
  return <>
    {item.announcement && <p className="rim-session-update"><strong>Update:</strong> {item.announcement}</p>}
    {item.note && <details className="rim-session-notes"><summary>Good to know</summary><p>{item.note}</p></details>}
  </>;
}
