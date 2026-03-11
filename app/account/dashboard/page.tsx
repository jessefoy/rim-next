import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { todayVirtualSessionsQuery } from "@/lib/queries";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";
import AlertStrip from "@/components/AlertStrip";

export const metadata = { title: "My Dashboard — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

interface VirtualSession {
  _id: string;
  name: string;
  slug: string;
  startDatetime: string;
  endDatetime: string | null;
  zoomLink: string | null;
}

function todayCT(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
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
      sanityClient.fetch<VirtualSession[]>(todayVirtualSessionsQuery),
      db.registration.findMany({
        where: { userId, status: { not: "CANCELLED" } },
        select: { id: true, programTitle: true, programSlug: true },
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
    ]);

  // Filter to today only (CT date)
  const todaySessionsRaw = allVirtual.filter((p) => {
    if (!p.startDatetime) return false;
    const ctDate = new Date(p.startDatetime).toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
    return ctDate === today;
  });

  const now = new Date();
  const todaySessions = await Promise.all(
    todaySessionsRaw.map(async (p) => {
      const start     = new Date(p.startDatetime);
      const liveStart = new Date(start.getTime() - 15 * 60 * 1000);
      const liveEnd   = p.endDatetime
        ? new Date(p.endDatetime)
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

      return { ...p, isLive, isLaterToday, isRegistered, startTimeCT: fmtTimeCT(p.startDatetime) };
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
      <div className="db2-wrap">
        <AlertStrip />

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
                    <span className="today-later-hdr__note">Join links appear when each session begins.</span>
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
