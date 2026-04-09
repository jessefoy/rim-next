import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Flame } from "lucide-react";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import SiteBannerStrip from "@/components/SiteBannerStrip";
import DashboardAutoRefresh from "@/components/DashboardAutoRefresh";
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

const ICAL_DAY = ["SU","MO","TU","WE","TH","FR","SA"];

function ctDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
}

function todayCT(): string {
  return ctDateStr(new Date().toISOString());
}

function dateToDayCode(dateStr: string): string {
  return ICAL_DAY[new Date(dateStr + "T12:00:00").getDay()];
}

function isOccurrenceToday(p: VirtualProgram, today: string): boolean {
  if (!p.startDatetime) return false;
  const anchor = ctDateStr(p.startDatetime.toISOString());
  if (anchor > today) return false;
  if (!p.recurrenceFreq) return anchor === today;
  const freq = p.recurrenceFreq.toLowerCase();
  if (freq === "weekly") {
    const days = p.recurrenceDays ?? [];
    if (days.length > 0 && !days.includes(dateToDayCode(today))) return false;
    const n = p.recurrenceInterval ?? 1;
    if (n > 1) {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.round(
        (new Date(today + "T12:00:00").getTime() - new Date(anchor + "T12:00:00").getTime()) / msPerWeek
      );
      if (weeksDiff % n !== 0) return false;
    }
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
  return anchor === today;
}

function shiftToToday(anchorISO: string, today: string): Date {
  const anchor = new Date(anchorISO);
  const anchorCTDate = ctDateStr(anchorISO);
  if (anchorCTDate === today) return anchor;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (new Date(today + "T12:00:00").getTime() - new Date(anchorCTDate + "T12:00:00").getTime()) / msPerDay
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

  const [allVirtual, upcomingRegistrations, hubMemberships, onboardingEnrollments, seriesEnrollments, activeBanner] =
    await Promise.all([
      db.program.findMany({
        where: {
          programFormat: { in: ["virtual", "hybrid"] },
          removeFromProgramList: false,
        },
        select: {
          id: true, name: true, slug: true,
          startDatetime: true, endDatetime: true,
          recurrenceFreq: true, recurrenceInterval: true,
          recurrenceDays: true, recurrenceCount: true,
          programFormat: true,
        },
        orderBy: { sortOrder: "asc" },
      }),
      // Include donationStatus so we can show dana inline
      db.registration.findMany({
        where: { userId, status: { not: "CANCELLED" } },
        select: {
          id: true,
          programTitle: true,
          programSlug: true,
          donationStatus: true,
          program: { select: { startDatetime: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.hubMember.findMany({
        where: { userId },
        include: { hub: { select: { id: true, slug: true, name: true, type: true } } },
        orderBy: { joinedAt: "asc" },
      }),
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
      db.siteBanner.findFirst({
        where: { isActive: true },
        include: { dismissals: { where: { userId } } },
      }),
    ]);

  // Series progress
  const seriesLessonIds = [...new Set(seriesEnrollments.flatMap((e) => e.course.lessons.map((l) => l.lessonId)))];
  const seriesProgressRecords = seriesLessonIds.length > 0
    ? await db.lessonProgress.findMany({ where: { userId, lessonId: { in: seriesLessonIds } }, select: { lessonId: true } })
    : [];
  const completedLessonIdSet = new Set(seriesProgressRecords.map((p) => p.lessonId));

  // Today's sessions
  const todaySessionsRaw = allVirtual.filter((p) => isOccurrenceToday(p, today));
  const now = new Date();

  const todaySessions = await Promise.all(
    todaySessionsRaw.map(async (p) => {
      const startIso = p.startDatetime!.toISOString();
      const start     = shiftToToday(startIso, today);
      const liveStart = new Date(start.getTime() - 12 * 60 * 1000);
      const endIso    = p.endDatetime?.toISOString() ?? null;
      const liveEnd   = endIso ? shiftToToday(endIso, today) : new Date(start.getTime() + 90 * 60 * 1000);
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

      // Compute countdown for later sessions
      const minsUntilStart = Math.round((start.getTime() - now.getTime()) / 60000);
      const minsUntilJoin  = Math.round((liveStart.getTime() - now.getTime()) / 60000);
      let countdownText = "";
      if (isLaterToday) {
        if (minsUntilJoin <= 0) {
          countdownText = "Join opens now";
        } else if (minsUntilJoin <= 60) {
          countdownText = `Join opens in ${minsUntilJoin} min`;
        } else {
          countdownText = `Starts at ${fmtTimeCT(start.toISOString())}`;
        }
      }

      return {
        ...p, _id: p.id, isLive, isLaterToday, isRegistered,
        startTimeCT: fmtTimeCT(start.toISOString()),
        liveStartEpoch: liveStart.getTime(),
        liveStartTimeCT: fmtTimeCT(liveStart.toISOString()),
        countdownText,
      };
    })
  );

  const liveSessions  = todaySessions.filter((s) => s.isLive);
  const laterSessions = todaySessions.filter((s) => s.isLaterToday);
  const showTodayCard = liveSessions.length > 0 || laterSessions.length > 0;
  const laterEpochs   = laterSessions.map((s) => s.liveStartEpoch);

  const isAdmin = (session.user.roles ?? []).includes("ADMIN");

  const dashboardHubs = isAdmin
    ? await db.hub.findMany({ select: { id: true, slug: true, name: true, type: true }, orderBy: { name: "asc" } })
    : hubMemberships.map((m) => m.hub);

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
      let unreadAlerts = 0;
      if (membership.hub.slug === "host-team") {
        unreadAlerts = await db.alert.count({
          where: { userId, read: false, type: { in: ["SUB_REQUEST", "SUB_CLAIMED", "NEW_THREAD", "NEW_REPLY", "UNASSIGNED_SESSION"] } },
        });
      }
      hubUnreadCounts[membership.hub.id] = unreadThreads + unreadAlerts;
    }
  }

  const showBanner = activeBanner && activeBanner.dismissals.length === 0;
  const bannerData = showBanner
    ? { id: activeBanner.id, bodyHtml: await renderFormattedTextAsync(activeBanner.body) }
    : null;

  const firstName =
    session.user?.name?.split(" ")[0] ??
    session.user?.email?.split("@")[0] ??
    "there";

  // Contextual greeting summary
  const pendingDanaCount = upcomingRegistrations.filter((r) => r.donationStatus === "PENDING").length;
  const sessionCount = liveSessions.length + laterSessions.length;
  const summaryParts: string[] = [];
  if (sessionCount > 0) summaryParts.push(`${sessionCount} session${sessionCount > 1 ? "s" : ""} today`);
  if (pendingDanaCount > 0) summaryParts.push(`${pendingDanaCount} dana offering${pendingDanaCount > 1 ? "s" : ""} to complete`);
  const summaryLine = summaryParts.length > 0
    ? `You have ${summaryParts.join(" and ")}.`
    : fmtTodayFull();

  return (
    <AccountLayout>
      <div className="db2-wrap">

        <SiteBannerStrip banner={bannerData} />

        {/* Greeting */}
        <div className="db2-greeting">
          <h1 className="db2-greeting__name">Good {timeOfDay()}, {firstName}.</h1>
          <p className="db2-greeting__date">{summaryLine}</p>
        </div>

        {/* Today's Sessions */}
        {showTodayCard && (
          <div className="db-section">
            <p className="db-section__label">Today</p>
            <div className="today-card">
              <DashboardAutoRefresh liveStartEpochs={laterEpochs} />
              {liveSessions.map((s) => (
                <div key={s._id} className="today-row today-row--live">
                  <div className="today-row__left">
                    <span className="today-live-badge">Live Now</span>
                    <span className="today-row__title">{s.name}</span>
                  </div>
                  <div className="today-row__right">
                    {s.isRegistered && <span className="today-registered">Registered</span>}
                    {(s.programFormat === "virtual" || s.programFormat === "hybrid") && (
                      <a href={`/session/${s.slug}`} className="join-btn">
                        Join now
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {laterSessions.map((s) => (
                <div key={s._id} className="today-row today-row--later">
                  <div className="today-row__left">
                    <span className="today-row__time">{s.startTimeCT}</span>
                    <span className="today-row__title">{s.name}</span>
                  </div>
                  <div className="today-row__right">
                    {s.isRegistered && <span className="today-registered">Registered</span>}
                    <span className="today-row__countdown">{s.countdownText}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your Programs (with inline dana status) */}
        <div className="db-section">
          <p className="db-section__label">Your Programs</p>
          {upcomingRegistrations.length === 0 ? (
            <div className="db2-empty-card">
              <p className="db2-empty-card__text">No upcoming programs yet.</p>
              <Link href="/community-programs" className="db2-empty-card__link">Browse programs →</Link>
            </div>
          ) : (
            <div className="db2-upcoming">
              {upcomingRegistrations.map((r) => {
                const startDt = r.program?.startDatetime;
                const hasPendingDana = r.donationStatus === "PENDING";
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

        {/* Onboarding welcome */}
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

        {/* Enrolled series */}
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

        {/* Your Hubs */}
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
