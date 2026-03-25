import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import SiteBannerStrip from "@/components/SiteBannerStrip";
import DashboardAutoRefresh from "@/components/DashboardAutoRefresh";
// VideoRoomEmbed temporarily removed — investigating hydration crash
// import VideoRoomEmbed from "@/components/VideoRoomEmbed";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";

export const metadata = { title: "My Dashboard — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

interface VirtualProgram {
  id: string;
  name: string;
  slug: string;
  startDatetime: Date | null;
  endDatetime: Date | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
  recurrenceCount: number | null;
  programFormat: string;
}

// iCal BYDAY codes indexed by JS getDay() (0=Sun … 6=Sat)
const ICAL_DAY = ["SU","MO","TU","WE","TH","FR","SA"];

/** Convert a UTC ISO string to a CT date string "YYYY-MM-DD". */
function ctDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
}

/** Today's date string "YYYY-MM-DD" in Central Time. */
function todayCT(): string {
  return ctDateStr(new Date().toISOString());
}

/** iCal day code for a "YYYY-MM-DD" string (e.g. "2026-03-14" → "SA"). */
function dateToDayCode(dateStr: string): string {
  // Parse as noon local to avoid midnight-UTC-rollover issues
  return ICAL_DAY[new Date(dateStr + "T12:00:00").getDay()];
}

/**
 * Does this virtual program have an occurrence today?
 * Handles single events, weekly (with optional interval), and falls back to
 * exact-date match for monthly/daily (sufficient for RIM's dashboard use case).
 */
function isOccurrenceToday(p: VirtualProgram, today: string): boolean {
  if (!p.startDatetime) return false;
  const anchor = ctDateStr(p.startDatetime.toISOString());
  if (anchor > today) return false; // hasn't started yet

  if (!p.recurrenceFreq) return anchor === today; // single event

  const freq = p.recurrenceFreq.toLowerCase();
  if (freq === "weekly") {
    const days = p.recurrenceDays ?? [];
    if (days.length > 0 && !days.includes(dateToDayCode(today))) return false;

    const n = p.recurrenceInterval ?? 1;
    if (n > 1) {
      // Is today in an "on" week? Count whole weeks since anchor.
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.round(
        (new Date(today + "T12:00:00").getTime() - new Date(anchor + "T12:00:00").getTime())
        / msPerWeek
      );
      if (weeksDiff % n !== 0) return false;
    }

    // Has the series ended?
    if (p.recurrenceCount && p.recurrenceCount >= 2) {
      const daysPerCycle = p.recurrenceDays?.length ?? 1;
      const cyclesNeeded = Math.ceil((p.recurrenceCount - 1) / daysPerCycle);
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const lastMs = new Date(anchor + "T12:00:00").getTime()
        + cyclesNeeded * (p.recurrenceInterval ?? 1) * msPerWeek;
      if (new Date(today + "T12:00:00").getTime() > lastMs) return false;
    }

    return true;
  }

  // Monthly / daily — exact match is sufficient for RIM's current programs
  return anchor === today;
}

/**
 * Shift an anchor ISO datetime to the same wall-clock time on a different CT date.
 * Used so the live/later check works on today's occurrence, not the first occurrence.
 */
function shiftToToday(anchorISO: string, today: string): Date {
  const anchor = new Date(anchorISO);
  const anchorCTDate = ctDateStr(anchorISO);
  if (anchorCTDate === today) return anchor;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (new Date(today + "T12:00:00").getTime() - new Date(anchorCTDate + "T12:00:00").getTime())
    / msPerDay
  );
  return new Date(anchor.getTime() + daysDiff * msPerDay);
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

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user.id;
  const today  = todayCT();

  const [allVirtual, upcomingRegistrations, pendingDana, hubMemberships, onboardingEnrollments, seriesEnrollments, activeBanner] =
    await Promise.all([
      db.program.findMany({
        where: {
          programFormat: { in: ["virtual", "hybrid"] },
          removeFromProgramList: false,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          startDatetime: true,
          endDatetime: true,
          recurrenceFreq: true,
          recurrenceInterval: true,
          recurrenceDays: true,
          recurrenceCount: true,
          programFormat: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
      db.registration.findMany({
        where: { userId, status: { not: "CANCELLED" } },
        select: {
          id: true,
          programTitle: true,
          programSlug: true,
          program: { select: { startDatetime: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.registration.findMany({
        where: { userId, donationStatus: "PENDING" },
        select: { id: true, programTitle: true, programSlug: true },
        orderBy: { createdAt: "desc" },
      }),
      db.hubMember.findMany({
        where: { userId },
        include: { hub: { select: { id: true, slug: true, name: true, type: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      // Onboarding series: enrolled via ONBOARDING source, not yet completed
      db.seriesEnrollment.findMany({
        where: {
          userId,
          enrollmentSource: "ONBOARDING",
          completedAt: null,
          course: { isActive: true },
        },
        select: {
          courseId: true,
          course: { select: { id: true, slug: true, title: true } },
        },
      }),
      // All non-onboarding enrollments for "Your Series" cards
      db.seriesEnrollment.findMany({
        where: {
          userId,
          enrollmentSource: { not: "ONBOARDING" },
          course: { isActive: true },
        },
        include: {
          course: {
            include: {
              lessons: {
                select: { lessonId: true, lesson: { select: { slug: true } } },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      }),
      // Active site banner + dismissal check
      db.siteBanner.findFirst({
        where: { isActive: true },
        include: {
          dismissals: { where: { userId } },
        },
      }),
    ]);

  // Fetch lesson progress for the series cards
  const seriesLessonIds = [...new Set(seriesEnrollments.flatMap((e) => e.course.lessons.map((l) => l.lessonId)))];
  const seriesProgressRecords = seriesLessonIds.length > 0
    ? await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: seriesLessonIds } },
        select: { lessonId: true },
      })
    : [];
  const completedLessonIdSet = new Set(seriesProgressRecords.map((p) => p.lessonId));

  // Filter to programs with an occurrence today, using recurrence logic
  const todaySessionsRaw = allVirtual.filter((p) => isOccurrenceToday(p, today));

  const now = new Date();
  const todaySessions = await Promise.all(
    todaySessionsRaw.map(async (p) => {
      const startIso = p.startDatetime!.toISOString();
      // Shift anchor datetime to today's occurrence so live/later checks are correct
      const start     = shiftToToday(startIso, today);
      const liveStart = new Date(start.getTime() - 12 * 60 * 1000);
      const endIso    = p.endDatetime?.toISOString() ?? null;
      const liveEnd   = endIso
        ? shiftToToday(endIso, today)
        : new Date(start.getTime() + 90 * 60 * 1000);
      const isLive       = now >= liveStart && now <= liveEnd;
      const isLaterToday = !isLive && start > now;

      let isRegistered = false;
      if (isLive || isLaterToday) {
        const reg = await db.registration.findFirst({
          where: { userId, programSlug: p.slug, status: { not: "CANCELLED" } },
          select: { id: true },
        });
        isRegistered = !!reg;
      }

      return { ...p, _id: p.id, isLive, isLaterToday, isRegistered, startTimeCT: fmtTimeCT(start.toISOString()), liveStartEpoch: liveStart.getTime() };
    })
  );

  const liveSessions  = todaySessions.filter((s) => s.isLive);
  const laterSessions = todaySessions.filter((s) => s.isLaterToday);
  const showTodayCard = liveSessions.length > 0 || laterSessions.length > 0;

  // Epoch ms values for each Later Today session's live window open time.
  // Passed to DashboardAutoRefresh so it can fire router.refresh() at the exact moment.
  const laterEpochs = laterSessions.map((s) => s.liveStartEpoch);

  const isAdmin = (session.user.roles ?? []).includes("ADMIN");

  // Admins bypass HubMember — show all hubs on the dashboard card
  const dashboardHubs = isAdmin
    ? await db.hub.findMany({
        select: { id: true, slug: true, name: true, type: true },
        orderBy: { name: "asc" },
      })
    : hubMemberships.map((m) => m.hub);

  // Compute unread counts per hub (skip for admin — they can check hubs directly)
  const hubUnreadCounts: Record<string, number> = {};
  if (!isAdmin) {
    for (const membership of hubMemberships) {
      const lastVisited = membership.lastVisitedAt ?? new Date(0);
      const unreadThreads = await db.hubConversationThread.count({
        where: {
          hubId: membership.hub.id,
          status: { not: "ARCHIVED" },
          OR: [
            { createdAt: { gt: lastVisited } },
            { replies: { some: { createdAt: { gt: lastVisited } } } },
          ],
        },
      });

      // For host-team hub, also count unread alerts
      let unreadAlerts = 0;
      if (membership.hub.slug === "host-team") {
        unreadAlerts = await db.alert.count({
          where: {
            userId,
            read: false,
            type: { in: ["SUB_REQUEST", "SUB_CLAIMED", "NEW_THREAD", "NEW_REPLY", "UNASSIGNED_SESSION"] },
          },
        });
      }

      hubUnreadCounts[membership.hub.id] = unreadThreads + unreadAlerts;
    }
  }

  // Site banner
  const showBanner = activeBanner && activeBanner.dismissals.length === 0;
  const bannerData = showBanner
    ? { id: activeBanner.id, bodyHtml: await renderFormattedTextAsync(activeBanner.body) }
    : null;

  const firstName =
    session.user?.name?.split(" ")[0] ??
    session.user?.email?.split("@")[0] ??
    "there";

  return (
    <AccountLayout>
      <div className="db2-wrap">

        {/* Site-wide banner */}
        <SiteBannerStrip banner={bannerData} />

        {/* 1. Greeting */}
        <div className="db2-greeting">
          <h1 className="db2-greeting__name">Welcome back, {firstName}.</h1>
          <p className="db2-greeting__date">{fmtTodayFull()}</p>
        </div>

        {/* 2. Today's Virtual Sessions */}
        {showTodayCard && (
          <div className="db-section">
            <div className="today-card">
              {/* Auto-refreshes the page when a Later Today session enters its live window */}
              <DashboardAutoRefresh liveStartEpochs={laterEpochs} />
              <div className="today-card__header">
                <span className="today-card__heading">Today&apos;s Virtual Sessions</span>
                <span className="today-card__date">{fmtTodayFull()}</span>
              </div>
              {liveSessions.map((s) => (
                <div key={s._id} className="today-row today-row--live">
                  <div className="today-row__left">
                    <span className="today-live-badge">Live Now</span>
                    <span className="today-row__title">{s.name}</span>
                  </div>
                  <div className="today-row__right">
                    {s.isRegistered && <span className="today-registered">Registered</span>}
                    {/* VideoRoomEmbed temporarily removed — investigating hydration crash */}
                  </div>
                </div>
              ))}
              {laterSessions.length > 0 && (
                <>
                  <div className="today-later-hdr">
                    <span className="today-later-hdr__label">Later Today</span>
                    <span className="today-later-hdr__note">Join link appears when the session opens, about 12 minutes before start.</span>
                  </div>
                  {laterSessions.map((s) => (
                    <div key={s._id} className="today-row today-row--later">
                      <span className="today-row__time">{s.startTimeCT}</span>
                      <span className="today-row__title today-row__title--muted">{s.name}</span>
                      <div className="today-row__right">
                        {s.isRegistered && <span className="today-registered">Registered</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* 3. Your Upcoming Programs */}
        <div className="db-section">
          <p className="db-section__label">Your Upcoming Programs</p>
          {upcomingRegistrations.length === 0 ? (
            <div className="db2-empty-card">
              <p className="db2-empty-card__text">You have no upcoming programs.</p>
              <Link href="/community-programs" className="db2-empty-card__link">Browse programs →</Link>
            </div>
          ) : (
            <div className="db2-upcoming">
              {upcomingRegistrations.map((r) => {
                const startDt = r.program?.startDatetime;
                return (
                  <Link key={r.id} href={`/programs/${r.programSlug}`} className="db2-upcoming__item">
                    {startDt && (() => {
                      const d = new Date(startDt);
                      const mon = d.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short" }).toUpperCase();
                      const day = d.toLocaleDateString("en-US", { timeZone: "America/Chicago", day: "numeric" });
                      return (
                        <span className="db2-upcoming__date-block">
                          <span className="db2-upcoming__date-month">{mon}</span>
                          <span className="db2-upcoming__date-day">{day}</span>
                        </span>
                      );
                    })()}
                    <span className="db2-upcoming__title">{r.programTitle}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. My Account quick links */}
        <div className="db-section">
          <p className="db-section__label">My Account</p>
          <div className="db2-quicklinks">
            <Link href="/account/dashboard-my-profile" className="db2-quicklink">My Profile</Link>
            <Link href="/account/programs" className="db2-quicklink">My Registrations</Link>
            <Link href="/account/courses" className="db2-quicklink">My Courses</Link>
          </div>
        </div>

        {/* 5. Onboarding welcome (only if incomplete onboarding series exist) */}
        {onboardingEnrollments.length > 0 && (
          <div className="db-section">
            <div className="db2-welcome-prompt">
              <p className="db2-welcome-prompt__heading">Welcome to RIM — here&apos;s where to begin</p>
              <div className="db2-welcome-prompt__list">
                {onboardingEnrollments.map((e) => (
                  <Link key={e.courseId} href={`/course/${e.course.slug}`} className="db2-welcome-prompt__item">
                    {e.course.title} <span>Start →</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5b. Enrolled series */}
        {seriesEnrollments.length > 0 && (
          <div className="db-section">
            <p className="db-section__label">Your Series</p>
            <div className="ls-dash-list">
              {seriesEnrollments.map((enrollment) => {
                const lessons = enrollment.course.lessons;
                const totalCount = lessons.length;
                const completedCount = lessons.filter((l) => completedLessonIdSet.has(l.lessonId)).length;
                const isFullyComplete = enrollment.completedAt != null;
                const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                // First lesson not yet completed, for "Continue →"
                const firstIncomplete = lessons.find((l) => !completedLessonIdSet.has(l.lessonId)) as typeof lessons[0] | undefined;

                return (
                  <div key={enrollment.id} className="ls-dash-card">
                    <Link href={`/course/${enrollment.course.slug}`} className="ls-dash-card__title">
                      {enrollment.course.title}
                    </Link>
                    {isFullyComplete ? (
                      <span className="ls-dash-card__complete">Completed</span>
                    ) : (
                      <>
                        <div className="ls-dash-card__progress">
                          <div className="ls-dash-card__bar-wrap">
                            <div className="ls-dash-card__bar" style={{ width: `${progressPct}%` }} />
                          </div>
                          <span className="ls-dash-card__count">{completedCount} of {totalCount}</span>
                        </div>
                        {firstIncomplete && (
                          <Link
                            href={`/lessons/${firstIncomplete.lesson.slug}?course=${enrollment.course.slug}`}
                            className="ls-dash-card__continue"
                          >
                            Continue →
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Pending Dana */}
        {pendingDana.length > 0 && (
          <div className="db-section">
            <div className="db-dana-reminder" style={{ marginTop: 0 }}>
              <p className="db-dana-reminder__label">Dana Offering Pending</p>
              <p className="db-dana-reminder__desc">
                A spot opened up for the following program{pendingDana.length > 1 ? "s" : ""}.
                Visit the program page to complete your dana offering.
              </p>
              <div className="db-dana-reminder__items">
                {pendingDana.map((r) => (
                  <Link key={r.id} href={`/programs/${r.programSlug}/register`} className="db-dana-reminder__item">
                    {r.programTitle}
                    <span className="db-dana-reminder__arrow">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7. Your Hubs */}
        {dashboardHubs.length > 0 && (
          <div className="db-section">
            <p className="db-section__label">Your Hubs</p>
            <div className="db2-hub-grid">
              {dashboardHubs.map((hub) => {
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

      </div>
    </AccountLayout>
  );
}
