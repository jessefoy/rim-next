import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { virtualDashboardProgramsQuery } from "@/lib/queries";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import AlertStrip from "@/components/AlertStrip";

export const metadata = { title: "My Dashboard — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

interface VirtualProgram {
  _id: string;
  name: string;
  slug: string;
  startDatetime: string | null;
  endDatetime: string | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[] | null;
  recurrenceCount: number | null;
  zoomLink: string | null;
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
  const anchor = ctDateStr(p.startDatetime);
  if (anchor > today) return false; // hasn't started yet

  if (!p.recurrenceFreq) return anchor === today; // single event

  if (p.recurrenceFreq === "weekly") {
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

  const [allVirtual, upcomingRegistrations, pendingDana, hubMemberships] =
    await Promise.all([
      sanityClient.fetch<VirtualProgram[]>(virtualDashboardProgramsQuery),
      db.registration.findMany({
        where: { userId, status: { not: "CANCELLED" } },
        select: { id: true, programTitle: true, programSlug: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).then(async (regs) => {
        // Enrich with start dates from Sanity
        const slugs = regs.map((r) => r.programSlug);
        const dates = slugs.length
          ? await sanityClient.fetch<{ slug: string; startDatetime: string | null }[]>(
              `*[_type == "programs" && slug.current in $slugs && !(_id in path("drafts.**"))]{
                "slug": slug.current, startDatetime
              }`,
              { slugs }
            )
          : [];
        const dateMap = new Map(dates.map((d) => [d.slug, d.startDatetime]));
        return regs.map((r) => ({ ...r, startDatetime: dateMap.get(r.programSlug) ?? null }));
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
    ]);

  // Filter to programs with an occurrence today, using recurrence logic
  const todaySessionsRaw = allVirtual.filter((p) => isOccurrenceToday(p, today));

  const now = new Date();
  const todaySessions = await Promise.all(
    todaySessionsRaw.map(async (p) => {
      // Shift anchor datetime to today's occurrence so live/later checks are correct
      const start     = shiftToToday(p.startDatetime!, today);
      const liveStart = new Date(start.getTime() - 12 * 60 * 1000);
      const liveEnd   = p.endDatetime
        ? shiftToToday(p.endDatetime, today)
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

      return { ...p, isLive, isLaterToday, isRegistered, startTimeCT: fmtTimeCT(start.toISOString()) };
    })
  );

  const liveSessions  = todaySessions.filter((s) => s.isLive);
  const laterSessions = todaySessions.filter((s) => s.isLaterToday);
  const showTodayCard = liveSessions.length > 0 || laterSessions.length > 0;

  const firstName =
    session.user?.name?.split(" ")[0] ??
    session.user?.email?.split("@")[0] ??
    "there";

  return (
    <AccountLayout>
      <AlertStrip />
      <div className="db2-wrap">

        {/* 1. Greeting */}
        <div className="db2-greeting">
          <h1 className="db2-greeting__name">Welcome back, {firstName}.</h1>
          <p className="db2-greeting__date">{fmtTodayFull()}</p>
        </div>

        {/* 2. Today's Virtual Sessions */}
        {showTodayCard && (
          <div className="db-section">
            <div className="today-card">
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
                    {s.zoomLink && (
                      <a href={s.zoomLink} target="_blank" rel="noopener noreferrer" className="join-btn">
                        Join
                      </a>
                    )}
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
              {upcomingRegistrations.map((r) => (
                <Link key={r.id} href={`/programs/${r.programSlug}`} className="db2-upcoming__item">
                  {r.startDatetime && (() => {
                    const d = new Date(r.startDatetime);
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
              ))}
            </div>
          )}
        </div>

        {/* 4. My Account quick links */}
        <div className="db-section">
          <p className="db-section__label">My Account</p>
          <div className="db2-quicklinks">
            <Link href="/account/dashboard-my-profile" className="db2-quicklink">My Profile</Link>
            <Link href="/account/programs" className="db2-quicklink">My Registrations</Link>
            <Link href="/account/dashboard-my-library" className="db2-quicklink">Course Library</Link>
          </div>
        </div>

        {/* 5. Pending Dana */}
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

        {/* 6. Your Hubs */}
        {hubMemberships.length > 0 && (
          <div className="db-section">
            <p className="db-section__label">Your Hubs</p>
            <div className="db2-hub-grid">
              {hubMemberships.map((m) => (
                <Link key={m.hub.id} href={`/account/hub/${m.hub.slug}`} className="db2-hub-card">
                  <span className="db2-hub-card__name">{m.hub.name}</span>
                  <span className="db2-hub-card__type">
                    {m.hub.type === "OPERATIONAL" ? "Operational" :
                     m.hub.type === "GOVERNANCE"  ? "Governance"  : "Community Group"}
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
