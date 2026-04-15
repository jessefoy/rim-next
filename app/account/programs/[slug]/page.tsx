import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AccountLayout from "@/components/AccountLayout";
import CancelRegistrationButton from "@/components/CancelRegistrationButton";
import { buildDateLabel } from "@/lib/dateLabel";
import { resolveLocation } from "@/lib/locations";
import { buildGoogleCalendarUrl, buildIcsUrl, describeRecurrence } from "@/lib/calendarLinks";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await db.program.findUnique({ where: { slug }, select: { name: true } });
  return { title: program ? `${program.name} — Rooted In Mindfulness` : "Program Not Found" };
}

/* ── Status badge (reused from my-programs list) ── */
const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registered",
  APPROVED: "Approved",
  WAITLISTED: "Waitlisted",
};

function StatusBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    REGISTERED: "mr-badge mr-badge--green",
    APPROVED: "mr-badge mr-badge--blue",
    WAITLISTED: "mr-badge mr-badge--amber",
  };
  return (
    <span className={classMap[status] ?? "mr-badge mr-badge--gray"}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default async function MemberProgramDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // ── Auth ──
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // ── Data ──
  const [program, registration] = await Promise.all([
    db.program.findUnique({
      where: { slug },
      include: {
        category: true,
        programTeachers: {
          orderBy: { order: "asc" },
          include: { user: { select: { firstName: true, lastName: true, preferredName: true } } },
        },
      },
    }) as any,
    db.registration.findFirst({
      where: {
        userId: session.user.id,
        programSlug: slug,
        status: { not: "CANCELLED" },
      },
    }),
  ]);

  // ── Access control ──
  if (!program || program.archivedAt) notFound();

  // Registration programs require an active registration
  if (program.registrationEnabled && !registration) {
    redirect(`/programs/${slug}`);
  }

  // ── Pre-render rich text ──
  const danaMessageHtml = program.danaMessage
    ? await renderFormattedTextAsync(program.danaMessage).catch(() => "")
    : null;

  // ── Computed values ──
  const startIso = program.startDatetime?.toISOString() ?? null;
  const endIso = program.endDatetime?.toISOString() ?? null;

  const timeLabel = program.timeText || (() => {
    if (!program.startDatetime) return null;
    const TZ = "America/Chicago";
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(d);
    const start = fmt(program.startDatetime);
    if (!program.endDatetime) return `${start} CT`;
    return `${start}–${fmt(program.endDatetime)} CT`;
  })();

  const scheduleLabel = (() => {
    if (program.dateText) return program.dateText;
    const full = buildDateLabel({
      startDatetime: startIso,
      endDatetime: endIso,
      recurrenceFreq: program.recurrenceFreq,
      recurrenceInterval: program.recurrenceInterval,
      recurrenceDays: program.recurrenceDays,
    });
    if (!full) return null;
    if (timeLabel && full.includes(" · ")) return full.split(" · ")[0];
    return full;
  })();

  const location = resolveLocation(program.venue, program.locationText, program.locationLink);
  const locationLabel =
    program.programFormat === "virtual"
      ? `Online (${location.text || "Zoom"}) only`
      : program.programFormat === "hybrid"
        ? `${location.text || "Hybrid"} + Online`
        : location.text;

  const hasCalendar = !!startIso;
  const rec = hasCalendar
    ? describeRecurrence(program.recurrenceFreq, program.recurrenceInterval, program.recurrenceDays, program.recurrenceCount)
    : { googleLabel: "", icsLabel: "" };
  const googleCalUrl = hasCalendar
    ? buildGoogleCalendarUrl({
        title: program.name,
        startDatetime: startIso!,
        endDatetime: endIso,
        location: location.emailText ?? undefined,
        programSlug: slug,
        recurrenceFreq: program.recurrenceFreq,
        recurrenceInterval: program.recurrenceInterval,
        recurrenceDays: program.recurrenceDays,
        recurrenceCount: program.recurrenceCount,
      })
    : null;

  const isVirtual = program.programFormat === "virtual" || program.programFormat === "hybrid";
  const isInPerson = program.programFormat === "in-person" || program.programFormat === "hybrid";
  const teacherDisplayNames = program.programTeachers.length > 0
    ? program.programTeachers.map((pt: any) => `${pt.user.preferredName || pt.user.firstName || ""} ${pt.user.lastName || ""}`.trim())
    : program.teacherFacilitators;
  const hasFacilitators = teacherDisplayNames.length > 0;

  return (
    <AccountLayout>
      <div className="mpd-page">

        {/* ── Back link ── */}
        <Link href="/account/programs" className="mpd-back">← My Programs</Link>

        {/* ── Header ── */}
        <div className="mpd-header">
          <h1 className="mpd-title">{program.name}</h1>
          {registration && <StatusBadge status={registration.status} />}
        </div>
        {program.category && (
          <Link href="/community-programs" className="mpd-category">{program.category.name}</Link>
        )}

        {/* ── Special announcement ── */}
        {program.specialAnnouncement && (
          <div className="mpd-notice">
            {program.specialAnnouncement}
          </div>
        )}

        {/* ── Pending dana action ── */}
        {registration?.donationStatus === "PENDING" && (
          <div className="mpd-dana">
            {danaMessageHtml
              ? <div className="mpd-dana__text man-body" dangerouslySetInnerHTML={{ __html: danaMessageHtml }} />
              : <p className="mpd-dana__text">Please complete your dana offering for this program.</p>
            }
            <Link href={`/programs/${slug}/register`} className="mpd-dana__link">
              Complete Dana Offering →
            </Link>
          </div>
        )}

        {/* ── Quick info card ── */}
        <div className="mpd-info">
          {scheduleLabel && (
            <div className="mpd-info__row">
              <svg className="mpd-info__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>{scheduleLabel}</span>
            </div>
          )}
          {timeLabel && (
            <div className="mpd-info__row">
              <svg className="mpd-info__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>{timeLabel}</span>
            </div>
          )}
          {locationLabel && (
            <div className="mpd-info__row">
              <svg className="mpd-info__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>
                {locationLabel}
                {location.link && <a href={location.link} target="_blank" rel="noopener noreferrer" className="mpd-info__ext"> ↗</a>}
              </span>
            </div>
          )}
          {program.danaText && (
            <div className="mpd-info__row">
              <svg className="mpd-info__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>{program.danaText}</span>
            </div>
          )}
        </div>

        {/* ── Join section ── */}
        <div className="mpd-join">
          {isVirtual && program.livekitRoom && (
            <a href={`/session/${slug}`} className="mpd-join__btn">
              Join Session →
            </a>
          )}
          {isVirtual && !program.livekitRoom && (
            <p className="mpd-join__note">Session link will appear here when available.</p>
          )}
          {isInPerson && (
            <p className="mpd-join__note">
              Simply arrive in person{location.text ? ` at ${location.text}` : ""}.
              {program.programFormat === "hybrid" && program.livekitRoom && (
                <> Or <a href={`/session/${slug}`} className="mpd-join__inline-link">join online</a>.</>
              )}
            </p>
          )}
        </div>

        {/* ── Early arrival message ── */}
        {program.earlyArrivalMessage && (
          <div className="mpd-notice mpd-notice--soft">
            {program.earlyArrivalMessage}
          </div>
        )}

        {/* ── Calendar links ── */}
        {hasCalendar && (
          <div className="mpd-calendar">
            {googleCalUrl && (
              <a href={googleCalUrl} target="_blank" rel="noopener noreferrer" className="mpd-calendar__link">
                + Google Calendar{rec.googleLabel ? ` (${rec.googleLabel})` : ""}
              </a>
            )}
            <a href={buildIcsUrl(slug)} className="mpd-calendar__link">
              + Apple / Outlook{rec.icsLabel ? ` (${rec.icsLabel})` : ""}
            </a>
          </div>
        )}

        {/* ── Facilitators ── */}
        {hasFacilitators && (
          <div className="mpd-facilitators">
            <p className="mpd-label">Facilitators</p>
            <p className="mpd-facilitators__names">
              {teacherDisplayNames.join(", ")}
            </p>
          </div>
        )}

        {/* ── Registration details ── */}
        {registration && (
          <div className="mpd-reg">
            <p className="mpd-label">Registration</p>
            <p className="mpd-reg__date">
              Registered {new Date(registration.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>

            {registration.status === "WAITLISTED" && registration.waitlistPosition != null && (
              <p className="mpd-reg__waitlist">Position #{registration.waitlistPosition} on waitlist</p>
            )}

            {registration.donationStatus === "COMPLETED" && registration.donationAmount && (
              <p className="mpd-reg__dana-complete">
                Dana offering: ${(registration.donationAmount / 100).toFixed(2)}
              </p>
            )}

            {/* Custom field answers */}
            {registration.customFields && typeof registration.customFields === "object" && (
              <div className="mpd-reg__fields">
                {Object.entries(registration.customFields as Record<string, string>).map(([key, val]) => (
                  <div key={key} className="mpd-reg__field">
                    <span className="mpd-reg__field-label">{key}</span>
                    <span className="mpd-reg__field-value">{String(val)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mpd-reg__actions">
              <CancelRegistrationButton id={registration.id} programTitle={program.name} />
            </div>
          </div>
        )}

      </div>
    </AccountLayout>
  );
}
